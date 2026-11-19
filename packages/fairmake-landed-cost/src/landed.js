// Landed cost and freight-in: freight, duty and brokerage bills matched to receipts and to what was allocated into item cost.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, pct, str, itemKey, partyKey, groupBy } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const RECEIPT_FIELDS = Object.freeze({
  receipt: t(['Receipt', 'Receipt No.', 'Receipt Nbr.', 'Receipt Number', 'GRN'], { required: true }),
  supplier: t(['Supplier', 'Vendor', 'Vendor Name']),
  receipt_date: t(['Receipt Date', 'Date', 'Received Date'], { type: 'date' }),
  goods_value: t(['Goods Value', 'Ext. Cost', 'Extended Cost', 'Receipt Value', 'Amount'], { type: 'money' }),
  landed_allocated: t(['Landed Allocated', 'Landed Cost', 'Freight Allocated', 'Landed Cost Amount'], { type: 'money' }),
});
export const CHARGE_FIELDS = Object.freeze({
  charge_id: t(['Charge ID', 'Bill Number', 'Invoice Number', 'Freight Bill', 'Reference'], { required: true }),
  receipt: t(['Receipt', 'Receipt No.', 'Receipt Nbr.', 'Applies To', 'Related Receipt']),
  vendor: t(['Vendor', 'Carrier', 'Broker', 'Bill From']),
  charge_type: t(['Charge Type', 'Type', 'Cost Type', 'Description']),
  amount: t(['Amount', 'Charge Amount', 'Total', 'Bill Amount'], { type: 'money' }),
  invoice_date: t(['Invoice Date', 'Bill Date', 'Date'], { type: 'date' }),
});
/** Acumatica purchase receipts. Written from knowledge of the export; not checked against a live system. */
export const RECEIPT_PROFILES = Object.freeze([
  exportProfile('acumatica_purchase_receipts', { receipt: 'Receipt Nbr.', supplier: 'Vendor', receipt_date: 'Date', goods_value: 'Ext. Cost', landed_allocated: 'Landed Cost' }, { note: 'Acumatica purchase receipt lines: lines of one receipt are summed.' }),
]);

export const DEFAULTS = Object.freeze({ min_amount: 25, outlier_factor: 2, collect_suppliers: [] });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    min_amount: { type: 'number', minimum: 0, description: 'Differences between billed and allocated landed cost below this amount are ignored' },
    outlier_factor: { type: 'number', minimum: 1, maximum: 100, description: 'A receipt whose landed cost share of goods value is this many times the median share is listed to watch' },
    collect_suppliers: { type: 'array', items: { type: 'string' }, description: 'Suppliers whose freight you pay (collect or FOB origin): a receipt from them with no freight bill is reviewed' },
  },
});
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

/** Match charges to receipts. Finding codes: not_allocated, over_allocated, no_freight_bill, landed_pct_outlier, unmatched_charge. */
export function landedCost({ receipts, charges }, s = DEFAULTS) {
  const R = groupBy(receipts.filter((r) => str(r.receipt)), (r) => itemKey(r.receipt));
  const C = groupBy(charges.filter((c) => str(c.charge_id)), (c) => itemKey(c.receipt));
  const collect = new Set((s.collect_suppliers || []).map(partyKey));
  const recs = [...R.entries()].map(([k, ls]) => {
    const cs = C.get(k) || []; const goods = round2(ls.reduce((x, l) => x + (Number(l.goods_value) || 0), 0));
    const billed = round2(cs.reduce((x, c) => x + (Number(c.amount) || 0), 0)); const allocated = round2(ls.reduce((x, l) => x + (Number(l.landed_allocated) || 0), 0));
    return { reference: str(ls[0].receipt), kind: 'receipt', supplier: ls[0].supplier || '', receipt_date: ls[0].receipt_date, goods_value: goods, billed, allocated, landed_pct: pct(billed, goods), charges: cs.map((c) => `${c.charge_id} ${c.charge_type || ''} ${c.amount}`.replace(/\s+/g, ' ').trim()) };
  });
  const med = median(recs.filter((r) => r.billed > 0 && r.goods_value > 0).map((r) => r.billed / r.goods_value));
  for (const r of recs) {
    const f = []; const gap = round2(r.billed - r.allocated);
    if (gap > s.min_amount) f.push(finding('not_allocated', gap, `Receipt ${r.reference}: ${r.billed} of freight, duty and brokerage billed, ${r.allocated} allocated into item cost. ${gap} is sitting outside inventory.`));
    else if (-gap > s.min_amount) f.push(finding('over_allocated', null, `Receipt ${r.reference}: ${r.allocated} allocated into item cost against ${r.billed} billed. Check for an estimate that was never trued up.`, 'review'));
    if (!r.billed && collect.has(partyKey(r.supplier))) f.push(finding('no_freight_bill', null, `${r.supplier} ships freight collect and receipt ${r.reference} has no freight bill yet. Accrue it or chase the carrier.`, 'review'));
    if (med && r.billed > 0 && r.goods_value > 0 && r.billed / r.goods_value > s.outlier_factor * med) f.push(finding('landed_pct_outlier', null, `Landed cost is ${r.landed_pct}% of goods value on receipt ${r.reference}, against a median of ${round2(med * 100)}%.`, 'watch'));
    r.findings = f; r.status = statusOf(f);
  }
  const orphans = [...C.entries()].filter(([k]) => !R.has(k)).flatMap(([, cs]) => cs).map((c) => {
    const f = [finding('unmatched_charge', c.amount, `${c.charge_type || 'Charge'} ${c.charge_id} from ${c.vendor || 'a vendor'} for ${c.amount} ${str(c.receipt) ? `names receipt ${c.receipt}, which is not in the receipts file` : 'names no receipt'}. Match it before it lands in a variance account.`, 'review')];
    return { reference: str(c.charge_id), kind: 'charge', supplier: c.vendor || '', receipt_date: c.invoice_date, goods_value: null, billed: c.amount, allocated: null, landed_pct: null, charges: [], status: statusOf(f), findings: f };
  });
  const items = [...recs, ...orphans].sort((a, b) => (`${a.kind}|${itemKey(a.reference)}` < `${b.kind}|${itemKey(b.reference)}` ? -1 : 1));
  const by_supplier = [...groupBy(recs, (r) => partyKey(r.supplier) || '(none)').values()].map((xs) => { const g = round2(xs.reduce((x, r) => x + r.goods_value, 0)); const b = round2(xs.reduce((x, r) => x + r.billed, 0)); return { supplier: xs[0].supplier || '(none)', receipts: xs.length, goods_value: g, billed: b, landed_pct: pct(b, g) }; }).sort((a, b) => (a.supplier < b.supplier ? -1 : 1));
  return {
    receipts: recs.length, charges: charges.length, goods_value: round2(recs.reduce((x, r) => x + r.goods_value, 0)), billed: round2(charges.reduce((x, c) => x + (Number(c.amount) || 0), 0)), allocated: round2(recs.reduce((x, r) => x + r.allocated, 0)),
    not_allocated: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'not_allocated').reduce((y, f) => y + f.amount, 0), 0)), unmatched: round2(orphans.reduce((x, o) => x + (Number(o.billed) || 0), 0)),
    median_landed_pct: med === null ? null : round2(med * 100),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_supplier, unmatched_charges: orphans.map((o) => ({ reference: o.reference, supplier: o.supplier, billed: o.billed })), by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function adjustmentText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.findings.some((f) => f.code === 'not_allocated'));
  return ['# Landed cost to allocate', '', '**To:** [TO CONFIRM accountant who posts landed cost]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `Freight, duty and brokerage billed against these receipts and not yet in item cost: ${r.not_allocated} in total. Allocate to the receipts (or to cost of goods sold for stock already used) after checking each bill.`, '',
    '| Receipt | Supplier | Goods value | Billed | Allocated | To allocate | Bills |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.reference} | ${i.supplier} | ${i.goods_value} | ${i.billed} | ${i.allocated} | ${round2(i.billed - i.allocated)} | ${i.charges.join('; ')} |`)].join('\n');
}
