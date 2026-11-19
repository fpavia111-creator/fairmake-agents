// Open purchase orders and late supplier deliveries: past due lines, lines never confirmed, promises that miss
// the production need date, over-receipts.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, partyKey, groupBy, daysBetween, asOfDate } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const PO_FIELDS = Object.freeze({
  po_line: t(['PO Line', 'Line ID', 'PO Line ID'], { required: true }),
  po_number: t(['PO Number', 'PO', 'Purchase Order', 'Document Number']),
  supplier: t(['Supplier', 'Vendor', 'Vendor Name', 'Supplier Name']),
  item: t(['Item', 'Part', 'Item No.', 'Part Number']),
  order_date: t(['Order Date', 'PO Date', 'Posting Date', 'Created'], { type: 'date' }),
  due_date: t(['Due Date', 'Delivery Date', 'Requested Date', 'Required Date'], { type: 'date' }),
  promise_date: t(['Promise Date', 'Promised Date', 'Confirmed Date', 'Supplier Promise'], { type: 'date' }),
  qty_ordered: t(['Qty Ordered', 'Quantity', 'Order Qty'], { type: 'number' }),
  qty_received: t(['Qty Received', 'Received', 'Received Qty'], { type: 'number' }),
  unit_price: t(['Unit Price', 'Price', 'Rate'], { type: 'money' }),
  need_date: t(['Need Date', 'Required by Production', 'MRP Need Date', 'Demand Date'], { type: 'date' }),
});
/** SAP Business One open purchase orders. Written from knowledge of the export; not checked against a live system. */
export const PO_PROFILES = Object.freeze([
  exportProfile('sap_b1_open_po', { po_line: { from: ['Document Number', 'Row Number'], compute: (_r, get) => `${String(get('Document Number') ?? '').trim()}-${String(get('Row Number') ?? '').trim()}` }, po_number: 'Document Number', supplier: 'Vendor Name', item: 'Item No.', order_date: 'Posting Date', due_date: 'Delivery Date', qty_ordered: 'Quantity', qty_received: { from: ['Quantity', 'Open Qty'], compute: (_r, get) => String((Number(String(get('Quantity') ?? '').replace(/,/g, '')) || 0) - (Number(String(get('Open Qty') ?? '').replace(/,/g, '')) || 0)) }, unit_price: 'Price' }, { note: 'SAP Business One open items list: received quantity is quantity less open quantity; no promise date column.' }),
]);

export const DEFAULTS = Object.freeze({ confirm_days: 3, grace_days: 0 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    confirm_days: { type: 'integer', minimum: 0, maximum: 90, description: 'An open line with no promise date this many days after ordering is unconfirmed' },
    grace_days: { type: 'integer', minimum: 0, maximum: 60, description: 'Days past the promise (or due) date before a line counts as past due' },
  },
});

/** Every open line. Finding codes: past_due, no_promise, promise_after_need, promise_after_due, over_received. */
export function openPurchaseOrders(rows, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf);
  const items = [...groupBy(rows.filter((r) => str(r.po_line)), (r) => itemKey(r.po_line)).values()].map((ls) => {
    const r = ls[0]; const ord = r.qty_ordered ?? 0, rec = r.qty_received ?? 0; const open = Math.max(0, round2(ord - rec)); const value = round2(open * (r.unit_price ?? 0));
    const target = r.promise_date || r.due_date; const late = target && open > 0 ? daysBetween(target, today) : null; const f = [];
    if (late !== null && late > s.grace_days) f.push(finding('past_due', value || null, `${r.po_number || r.po_line} ${r.item || ''}: ${open} still open ${late} days after the ${r.promise_date ? 'promise' : 'due'} date ${target}${value ? ` (${value})` : ''}.`.replace(/\s+/g, ' ')));
    if (open > 0 && !r.promise_date && r.order_date && daysBetween(r.order_date, today) > s.confirm_days) f.push(finding('no_promise', null, `${r.po_number || r.po_line} ${r.item || ''}: no promise date ${daysBetween(r.order_date, today)} days after ordering.`.replace(/\s+/g, ' '), 'review'));
    if (open > 0 && r.promise_date && r.need_date && r.promise_date > r.need_date) f.push(finding('promise_after_need', null, `${r.po_number || r.po_line} ${r.item || ''}: promised ${r.promise_date}, production needs it ${r.need_date} (${daysBetween(r.need_date, r.promise_date)} days late).`.replace(/\s+/g, ' ')));
    else if (open > 0 && r.promise_date && r.due_date && r.promise_date > r.due_date) f.push(finding('promise_after_due', null, `${r.po_number || r.po_line} ${r.item || ''}: promised ${r.promise_date}, after the requested ${r.due_date}.`.replace(/\s+/g, ' '), 'watch'));
    if (rec > ord && ord > 0) f.push(finding('over_received', null, `${r.po_number || r.po_line} ${r.item || ''}: ${rec} received against ${ord} ordered.`.replace(/\s+/g, ' '), 'review'));
    return { po_line: str(r.po_line), po_number: str(r.po_number), supplier: str(r.supplier), item: str(r.item), due_date: r.due_date || null, promise_date: r.promise_date || null, need_date: r.need_date || null, qty_open: open, open_value: value, days_late: late !== null && late > 0 ? late : 0, status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.po_line) < itemKey(b.po_line) ? -1 : 1));
  const by_supplier = [...groupBy(items, (i) => partyKey(i.supplier) || '(none)').values()].map((xs) => { const pd = xs.filter((i) => i.findings.some((f) => f.code === 'past_due')); return { supplier: xs[0].supplier || '(none)', lines: xs.length, open_value: round2(xs.reduce((x, i) => x + i.open_value, 0)), past_due_lines: pd.length, past_due_value: round2(pd.reduce((x, i) => x + i.open_value, 0)) }; }).sort((a, b) => b.past_due_value - a.past_due_value || (a.supplier < b.supplier ? -1 : 1));
  return {
    as_of: today, lines: items.length, open_lines: items.filter((i) => i.qty_open > 0).length, open_value: round2(items.reduce((x, i) => x + i.open_value, 0)),
    past_due_value: round2(items.filter((i) => i.findings.some((f) => f.code === 'past_due')).reduce((x, i) => x + i.open_value, 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_supplier, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function expediteText(lines, { supplier, from }) {
  const rows = lines.filter((i) => i.findings.some((f) => ['past_due', 'no_promise', 'promise_after_need'].includes(f.code)));
  return { rows, text: [`# Delivery status request: ${supplier}`, '', `**To:** [TO CONFIRM ${supplier} order desk or account contact]`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    'Please confirm a ship date for each open line below, and tell us about any line you cannot meet.', '',
    '| PO | Line | Item | Open qty | Due | Your promise | Note |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.po_number} | ${i.po_line} | ${i.item} | ${i.qty_open} | ${i.due_date || ''} | ${i.promise_date || 'not confirmed'} | ${i.findings.filter((f) => ['past_due', 'no_promise', 'promise_after_need'].includes(f.code)).map((f) => f.code.replace(/_/g, ' ')).join(', ')} |`)].join('\n') };
}
