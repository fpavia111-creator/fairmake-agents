// Customer order backlog and promise dates: open lines past due, due soon, never promised, promised after the
// customer's requested date, on hold; backlog value by promise month and customer.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, partyKey, groupBy, daysBetween, asOfDate } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const ORDER_FIELDS = Object.freeze({
  order_line: t(['Order Line', 'Line ID', 'SO Line', 'Order Line ID'], { required: true }),
  order_number: t(['Order Number', 'Sales Order', 'SO', 'Document Number', 'Order No.']),
  customer: t(['Customer', 'Customer Name', 'Sold To', 'Bill To']),
  item: t(['Item', 'Part', 'Part Number', 'SKU']),
  order_date: t(['Order Date', 'Date', 'Entered'], { type: 'date' }),
  requested_date: t(['Requested Date', 'Customer Requested Date', 'Need By', 'Request Date'], { type: 'date' }),
  promise_date: t(['Promise Date', 'Promised Date', 'Expected Ship Date', 'Committed Date', 'Ship By'], { type: 'date' }),
  qty_open: t(['Qty Open', 'Open Qty', 'Quantity Remaining', 'Backorder Qty', 'Remaining'], { type: 'number' }),
  unit_price: t(['Unit Price', 'Price', 'Rate'], { type: 'money' }),
  line_status: t(['Status', 'Line Status', 'Order Status']),
});
/** NetSuite open sales order lines. Written from knowledge of the export; not checked against a live account. */
export const ORDER_PROFILES = Object.freeze([
  exportProfile('netsuite_open_sales_orders', { order_line: { from: ['Document Number', 'Line ID'], compute: (_r, get) => `${String(get('Document Number') ?? '').trim()}-${String(get('Line ID') ?? '').trim()}` }, order_number: 'Document Number', customer: 'Customer', item: 'Item', order_date: 'Date', promise_date: 'Expected Ship Date', qty_open: 'Quantity Remaining', unit_price: 'Rate', line_status: 'Status' }, { note: 'NetSuite open sales order lines: no requested-date column by default.' }),
]);

export const DEFAULTS = Object.freeze({ at_risk_days: 7 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: { note: { type: 'string', description: 'Free text for your own records' }, at_risk_days: { type: 'integer', minimum: 1, maximum: 90, description: 'An open line promised within this many days is listed as due soon' } },
});
const CLOSED = /clos|cancel|complete|shipped|invoiced|fulfilled/i;
const HOLD = /hold/i;

/** Every open line. Finding codes: past_due, due_soon, no_promise, promised_after_request, on_hold. */
export function orderBacklog(rows, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf);
  const items = [...groupBy(rows.filter((r) => str(r.order_line)), (r) => itemKey(r.order_line)).values()].map((ls) => ls[0])
    .filter((r) => (r.qty_open ?? 0) > 0 && !CLOSED.test(str(r.line_status)))
    .map((r) => {
      const value = round2((r.qty_open ?? 0) * (r.unit_price ?? 0)); const target = r.promise_date || r.requested_date; const f = [];
      const days = target ? daysBetween(today, target) : null;
      if (days !== null && days < 0) f.push(finding('past_due', value || null, `${r.order_number || r.order_line} ${r.item || ''} for ${r.customer || '?'}: ${r.qty_open} open, ${r.promise_date ? 'promised' : 'requested'} ${target} (${-days} days ago), ${value} of backlog.`.replace(/\s+/g, ' ')));
      else if (days !== null && days <= s.at_risk_days) f.push(finding('due_soon', null, `${r.order_number || r.order_line} ${r.item || ''} is due ${target} (in ${days} days).`.replace(/\s+/g, ' '), 'watch'));
      if (!r.promise_date) f.push(finding('no_promise', null, `${r.order_number || r.order_line} ${r.item || ''} has no promise date.`.replace(/\s+/g, ' '), 'review'));
      else if (r.requested_date && r.promise_date > r.requested_date) f.push(finding('promised_after_request', null, `${r.order_number || r.order_line} ${r.item || ''}: promised ${r.promise_date}, the customer asked for ${r.requested_date} (${daysBetween(r.requested_date, r.promise_date)} days later).`.replace(/\s+/g, ' '), 'watch'));
      if (HOLD.test(str(r.line_status))) f.push(finding('on_hold', null, `${r.order_number || r.order_line} is on hold (${str(r.line_status)}).`, 'review'));
      return { order_line: str(r.order_line), order_number: str(r.order_number), customer: str(r.customer), item: str(r.item), requested_date: r.requested_date || null, promise_date: r.promise_date || null, qty_open: r.qty_open, open_value: value, days_to_promise: days, month: (r.promise_date || r.requested_date || 'none').slice(0, 7), status: statusOf(f), findings: f };
    }).sort((a, b) => (itemKey(a.order_line) < itemKey(b.order_line) ? -1 : 1));
  const months = [...groupBy(items, (i) => i.month).entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([m, xs]) => ({ month: m, lines: xs.length, open_value: round2(xs.reduce((x, i) => x + i.open_value, 0)) }));
  const by_customer = [...groupBy(items, (i) => partyKey(i.customer) || '(none)').values()].map((xs) => ({ customer: xs[0].customer || '(none)', lines: xs.length, open_value: round2(xs.reduce((x, i) => x + i.open_value, 0)), past_due_value: round2(xs.filter((i) => i.findings.some((f) => f.code === 'past_due')).reduce((x, i) => x + i.open_value, 0)) })).sort((a, b) => b.past_due_value - a.past_due_value || b.open_value - a.open_value);
  return {
    as_of: today, open_lines: items.length, backlog_value: round2(items.reduce((x, i) => x + i.open_value, 0)), past_due_value: round2(items.filter((i) => i.findings.some((f) => f.code === 'past_due')).reduce((x, i) => x + i.open_value, 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_month: months, by_customer, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function promiseUpdateText(lines, { customer, from }) {
  const rows = lines.filter((i) => i.findings.some((f) => ['past_due', 'promised_after_request', 'no_promise'].includes(f.code)));
  return { rows, text: [`# Order status update: ${customer}`, '', `**To:** [TO CONFIRM ${customer} buyer]`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    'An update on your open order lines below. New ship dates are [CHECK with production before sending].', '',
    '| Order | Item | Open qty | You asked for | Our date | Status |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.order_number} | ${i.item} | ${i.qty_open} | ${i.requested_date || ''} | ${i.promise_date || 'to be confirmed'} | ${i.findings.some((f) => f.code === 'past_due') ? 'late' : i.promise_date ? 'scheduled' : 'being scheduled'} |`)].join('\n') };
}
