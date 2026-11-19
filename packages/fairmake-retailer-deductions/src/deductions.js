// Customer deductions and chargebacks: each deduction sorted by reason, checked against shipment evidence, with a dispute-by date.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, partyKey, groupBy, addDays, asOfDate, hoursBetween, yes } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const DEDUCTION_FIELDS = Object.freeze({
  deduction: t(['Deduction', 'Deduction ID', 'Deduction Number', 'Chargeback ID', 'Debit Memo'], { required: true }),
  customer: t(['Customer', 'Retailer', 'Trading Partner', 'Customer Name'], { required: true }),
  deduction_date: t(['Date', 'Deduction Date', 'Check Date', 'Remittance Date'], { type: 'date' }),
  amount: t(['Amount', 'Deduction Amount', 'Chargeback Amount'], { type: 'money' }),
  reason_code: t(['Reason Code', 'Reason', 'Deduction Code', 'Code']),
  reference: t(['Reference', 'Invoice Number', 'Invoice', 'Invoice No.']),
  description: t(['Description', 'Reason Description', 'Memo']),
});
export const SHIP_FIELDS = Object.freeze({
  invoice: t(['Invoice', 'Invoice Number', 'Invoice No.'], { required: true }),
  po_number: t(['PO Number', 'Customer PO', 'PO']),
  ship_date: t(['Ship Date', 'Shipped', 'Ship Datetime'], { type: 'datetime' }),
  asn_sent: t(['ASN Sent', 'ASN Sent At', 'ASN Date', '856 Sent'], { type: 'datetime' }),
  pod: t(['POD', 'Clean POD', 'Signed Clean', 'Proof of Delivery']),
  qty_shipped: t(['Qty Shipped', 'Shipped Qty', 'Units Shipped'], { type: 'number' }),
  qty_invoiced: t(['Qty Invoiced', 'Invoiced Qty', 'Units Invoiced'], { type: 'number' }),
});
/** Generic retailer remittance with deductions. Written from knowledge of such portals; not checked against a live account. */
export const DEDUCTION_PROFILES = Object.freeze([
  exportProfile('retailer_remittance', { deduction: { from: ['Check Number', 'Invoice Number', 'Reason Code'], compute: (_r, get) => ['Check Number', 'Invoice Number', 'Reason Code'].map((k) => String(get(k) ?? '').trim()).join('/') }, customer: 'Retailer', deduction_date: 'Check Date', amount: 'Deduction Amount', reason_code: 'Reason Code', reference: 'Invoice Number', description: 'Reason Description' }, { note: 'Retailer remittance detail: one row per deduction line; the deduction id is the check, invoice and reason code.' }),
]);

export const DEFAULTS = Object.freeze({
  default_window_days: 30, dispute_window_days: {}, small_amount: 50, asn_grace_hours: 24,
  reason_map: { ASN: 'asn_late', LBL: 'label', RTE: 'routing', SHT: 'shortage', PRC: 'pricing', PRM: 'promotion', DMG: 'damage' },
});
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    default_window_days: { type: 'integer', minimum: 1, maximum: 730, description: 'Days from the deduction date to dispute it, for customers not named below' },
    dispute_window_days: { type: 'object', additionalProperties: { type: 'integer', minimum: 1, maximum: 730 }, description: 'Dispute window in days by customer (from your trading partner terms)' },
    small_amount: { type: 'number', minimum: 0, description: 'Deductions under this amount are listed as write-off candidates (a person decides)' },
    asn_grace_hours: { type: 'number', minimum: 0, maximum: 240, description: 'An ASN sent within this many hours after shipping counts as on time' },
    reason_map: { type: 'object', additionalProperties: { type: 'string', enum: ['asn_late', 'label', 'routing', 'shortage', 'pricing', 'promotion', 'damage', 'other'] }, description: 'Retailer reason code to category' },
  },
});

/** Every deduction. Finding codes: disputable, needs_evidence, window_closed, no_reference, unknown_reason, small_amount. */
export function deductions({ rows, shipments }, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf);
  const SH = new Map(shipments.filter((x) => str(x.invoice)).map((x) => [itemKey(x.invoice), x]));
  const map = Object.fromEntries(Object.entries(s.reason_map || {}).map(([k, v]) => [k.toUpperCase(), v]));
  const win = new Map(Object.entries(s.dispute_window_days || {}).map(([c, d]) => [partyKey(c), d]));
  const items = [...groupBy(rows.filter((r) => str(r.deduction) && str(r.customer)), (r) => itemKey(r.deduction)).values()].map((ls) => {
    const r = ls[0]; const amt = round2(ls.reduce((x, l) => x + Math.abs(Number(l.amount) || 0), 0)); const code = str(r.reason_code).toUpperCase(); const cat = map[code] || null;
    const days = win.has(partyKey(r.customer)) ? win.get(partyKey(r.customer)) : s.default_window_days; const by = r.deduction_date ? addDays(r.deduction_date, days) : null;
    const sh = str(r.reference) ? SH.get(itemKey(r.reference)) : null; const f = [];
    if (!cat) f.push(finding('unknown_reason', null, `Reason code "${str(r.reason_code)}" is not in the reason map; classify it before deciding.`, 'review'));
    if (!str(r.reference)) f.push(finding('no_reference', null, `Deduction ${r.deduction} names no invoice.`, 'review'));
    else if (shipments.length && !sh) f.push(finding('no_reference', null, `Invoice ${r.reference} is not in the shipment file.`, 'review'));
    let disputable = false;
    if (cat === 'asn_late' && sh && sh.asn_sent && sh.ship_date) { const h = hoursBetween(sh.ship_date, sh.asn_sent); if (h !== null && h <= s.asn_grace_hours) { disputable = true; f.push(finding('disputable', amt, `${r.customer} charged ${amt} for a late ASN, but the ASN for invoice ${r.reference} went at ${sh.asn_sent}, ${h <= 0 ? 'before or at' : `${h} hours after`} shipping (${sh.ship_date}).`)); } }
    if (cat === 'shortage' && sh && yes(sh.pod) && sh.qty_shipped !== null && sh.qty_invoiced !== null && sh.qty_shipped >= sh.qty_invoiced) { disputable = true; f.push(finding('disputable', amt, `${r.customer} deducted ${amt} for a shortage on invoice ${r.reference}, but ${sh.qty_shipped} shipped against ${sh.qty_invoiced} invoiced with a clean proof of delivery.`)); }
    if (!disputable && cat && cat !== 'other') f.push(finding('needs_evidence', null, `${cat.replace(/_/g, ' ')} deduction of ${amt}: gather ${cat === 'pricing' ? 'the price agreement and the PO' : cat === 'promotion' ? 'the promotion agreement' : cat === 'damage' ? 'the proof of delivery and photos' : cat === 'shortage' ? 'the proof of delivery and pick records' : 'the routing guide, label and ASN records'} before deciding.`, 'review'));
    if (by && by < today) f.push(finding('window_closed', null, `The dispute window (${days} days) closed on ${by}.`, 'watch'));
    if (amt < s.small_amount && !disputable) f.push(finding('small_amount', null, `${amt} is under ${s.small_amount}: a write-off candidate if a person agrees.`, 'watch'));
    const status = by && by < today && disputable ? 'watch' : statusOf(f);
    return { deduction: str(r.deduction), customer: str(r.customer), deduction_date: r.deduction_date, amount: amt, reason_code: str(r.reason_code), category: cat || 'unknown', reference: str(r.reference), dispute_by: by, status, findings: f };
  }).sort((a, b) => (itemKey(a.deduction) < itemKey(b.deduction) ? -1 : 1));
  const open = items.filter((i) => !(i.dispute_by && i.dispute_by < today));
  const roll = (key) => [...groupBy(items, (i) => (key === 'customer' ? partyKey(i.customer) : i.category)).values()].map((xs) => ({ [key === 'customer' ? 'customer' : 'reason']: key === 'customer' ? xs[0].customer : xs[0].category, deductions: xs.length, amount: round2(xs.reduce((x, i) => x + i.amount, 0)), disputable: round2(xs.filter((i) => i.findings.some((f) => f.code === 'disputable')).reduce((x, i) => x + i.amount, 0)) })).sort((a, b) => b.amount - a.amount);
  return {
    as_of: today, deductions: items.length, amount: round2(items.reduce((x, i) => x + i.amount, 0)),
    disputable_open: round2(open.filter((i) => i.findings.some((f) => f.code === 'disputable')).reduce((x, i) => x + i.amount, 0)),
    disputable_lost: round2(items.filter((i) => i.dispute_by && i.dispute_by < today && i.findings.some((f) => f.code === 'disputable')).reduce((x, i) => x + i.amount, 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_customer: roll('customer'), by_reason: roll('reason'), by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function disputeText(list, { customer, from, vendor_number }) {
  const rows = list.filter((i) => i.status === 'flag');
  const total = round2(rows.reduce((x, i) => x + i.amount, 0));
  return { rows, total, text: [`# Deduction dispute: ${customer}`, '', `**To:** [TO CONFIRM ${customer} deductions or vendor relations contact]`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, `**Vendor number:** ${vendor_number || '[TO CONFIRM your vendor number]'}`, '',
    `We dispute the ${rows.length} deduction(s) below, ${total} in total, each inside its dispute window. Supporting documents are attached. [ATTACH proof of delivery and ASN records]`, '',
    '| Deduction | Invoice | Date | Amount | Dispute by | Why it should be reversed |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.deduction} | ${i.reference} | ${i.deduction_date || ''} | ${i.amount} | ${i.dispute_by || ''} | ${i.findings.filter((f) => f.code === 'disputable').map((f) => f.detail).join(' ')} |`)].join('\n') };
}
