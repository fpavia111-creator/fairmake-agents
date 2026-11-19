// Supplier scorecards: on-time delivery, quality (rejects in parts per million) and price against PO, weighted into one score.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, pct, str, partyKey, groupBy, daysBetween } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const RECEIPT_FIELDS = Object.freeze({
  receipt: t(['Receipt', 'Receipt Line', 'Receipt Nbr.', 'GRN'], { required: true }),
  supplier: t(['Supplier', 'Vendor', 'Vendor Name'], { required: true }),
  item: t(['Item', 'Part', 'Inventory ID', 'Part Number']),
  due_date: t(['Due Date', 'Promised On', 'Promise Date', 'Requested Date'], { type: 'date' }),
  receipt_date: t(['Receipt Date', 'Date', 'Received Date'], { type: 'date' }),
  qty_received: t(['Qty Received', 'Receipt Qty.', 'Received Qty', 'Quantity'], { type: 'number' }),
  qty_rejected: t(['Qty Rejected', 'Rejected', 'Rejected Qty', 'Returned Qty'], { type: 'number' }),
  unit_price: t(['Unit Price', 'Unit Cost', 'Invoice Price', 'Price'], { type: 'money' }),
  po_price: t(['PO Price', 'PO Unit Cost', 'Agreed Price', 'Contract Price'], { type: 'money' }),
});
/** Acumatica purchase receipts. Written from knowledge of the export; not checked against a live system. */
export const RECEIPT_PROFILES = Object.freeze([
  exportProfile('acumatica_purchase_receipts', { receipt: { from: ['Receipt Nbr.', 'Inventory ID'], compute: (_r, get) => `${String(get('Receipt Nbr.') ?? '').trim()}/${String(get('Inventory ID') ?? '').trim()}` }, supplier: 'Vendor', item: 'Inventory ID', due_date: 'Promised On', receipt_date: 'Date', qty_received: 'Receipt Qty.', qty_rejected: 'Rejected Qty.', unit_price: 'Unit Cost', po_price: 'PO Unit Cost' }, { note: 'Acumatica purchase receipt lines: the receipt line id is the receipt number and item.' }),
]);

export const DEFAULTS = Object.freeze({ weights: { on_time: 50, quality: 30, price: 20 }, grace_days: 0, min_receipts: 3, on_time_target: 95, ppm_target: 5000 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    weights: { type: 'object', additionalProperties: { type: 'number', minimum: 0, maximum: 100 }, description: 'Weight of on_time, quality and price in the score' },
    grace_days: { type: 'integer', minimum: 0, maximum: 30, description: 'Days after the due date that still count as on time' },
    min_receipts: { type: 'integer', minimum: 1, maximum: 1000, description: 'Fewer receipts than this make the score a weak signal' },
    on_time_target: { type: 'number', minimum: 0, maximum: 100, description: 'On-time % below this is flagged' },
    ppm_target: { type: 'number', minimum: 0, description: 'Rejects in parts per million above this are flagged' },
  },
});

/** One scorecard per supplier. Finding codes: low_on_time, high_ppm, price_over_po, few_receipts. */
export function scorecards(rows, s = DEFAULTS) {
  const w = { on_time: 50, quality: 30, price: 20, ...(s.weights || {}) }; const wsum = (w.on_time + w.quality + w.price) || 1;
  const cards = [...groupBy(rows.filter((r) => str(r.receipt) && str(r.supplier)), (r) => partyKey(r.supplier)).values()].map((xs) => {
    const name = str(xs[0].supplier); const timed = xs.filter((r) => r.due_date && r.receipt_date);
    const onTime = timed.filter((r) => daysBetween(r.due_date, r.receipt_date) <= s.grace_days).length; const otp = timed.length ? pct(onTime, timed.length) : null;
    const rec = xs.reduce((x, r) => x + (Number(r.qty_received) || 0), 0), rej = xs.reduce((x, r) => x + (Number(r.qty_rejected) || 0), 0); const ppm = rec ? Math.round((rej / rec) * 1e6) : null;
    const priced = xs.filter((r) => r.unit_price !== null && r.unit_price !== undefined && r.po_price);
    const base = priced.reduce((x, r) => x + r.po_price * (Number(r.qty_received) || 0), 0); const over = priced.reduce((x, r) => x + (r.unit_price - r.po_price) * (Number(r.qty_received) || 0), 0);
    const pv = base ? round2((over / base) * 100) : null;
    const sOn = otp ?? 100, sQ = ppm === null ? 100 : Math.max(0, 100 - ppm / 500), sP = pv === null ? 100 : Math.max(0, 100 - Math.max(0, pv) * 5);
    const score = round2((sOn * w.on_time + sQ * w.quality + sP * w.price) / wsum); const f = [];
    if (otp !== null && otp < s.on_time_target) f.push(finding('low_on_time', null, `${name} delivered ${onTime} of ${timed.length} receipts on time (${otp}%, target ${s.on_time_target}%).`));
    if (ppm !== null && ppm > s.ppm_target) f.push(finding('high_ppm', null, `${name}: ${rej} rejected of ${rec} received (${ppm} ppm, target ${s.ppm_target}).`));
    if (pv !== null && pv > 1) f.push(finding('price_over_po', round2(over), `${name} invoiced ${round2(over)} above PO prices (${pv}%).`, 'watch'));
    if (xs.length < s.min_receipts) f.push(finding('few_receipts', null, `${name} has ${xs.length} receipt(s); the score rests on little data.`, 'review'));
    return { supplier: name, receipts: xs.length, on_time_pct: otp, ppm, price_variance_pct: pv, score, rank: 0, status: statusOf(f), findings: f };
  }).sort((a, b) => b.score - a.score || (a.supplier < b.supplier ? -1 : 1));
  cards.forEach((c, i) => { c.rank = i + 1; });
  return {
    suppliers: cards.length, receipts: rows.length, flag: cards.filter((c) => c.status === 'flag').length, review: cards.filter((c) => c.status === 'review').length, watch: cards.filter((c) => c.status === 'watch').length, ok: cards.filter((c) => c.status === 'ok').length,
    weights_used: w, by_finding: tallyFindings(cards), by_status: countBy(cards), items: cards,
  };
}

export function scorecardText(c, { from, period } = {}) {
  return [`# Supplier scorecard: ${c.supplier}`, '', `**To:** [TO CONFIRM ${c.supplier} account or quality contact]`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `Your performance on our receipts${period ? ` for ${period}` : ''}:`, '',
    '| Measure | Result |', '| --- | --- |', `| On-time delivery | ${c.on_time_pct ?? 'n/a'}% |`, `| Rejects | ${c.ppm ?? 'n/a'} ppm |`, `| Price against PO | ${c.price_variance_pct ?? 'n/a'}% |`, `| Score | ${c.score} (rank ${c.rank}) |`, '',
    c.findings.length ? `Points to work on: ${c.findings.map((f) => f.detail).join(' ')}` : 'No points to raise this period.', '', 'Please reply with your corrective actions where a point is raised.'].join('\n');
}
