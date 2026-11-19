import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows, partyIs } from 'fairmake-core';
import { ORDER_FIELDS, ORDER_PROFILES, DEFAULTS, SETTINGS_SCHEMA, orderBacklog, promiseUpdateText } from './backlog.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  orders: { type: 'string', description: 'Open sales order lines under --root: line, order, customer, item, order, requested and promise dates, open quantity, price, status' },
  as_of: { type: 'string', format: 'date', description: 'Date to measure from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'backlog',
  description: 'Reviews the customer order backlog line by line: flags lines past their promise date with the value at stake, lists lines due soon and promises later than the customer asked for, reviews lines never promised and lines on hold, totals backlog by promise month and customer, and drafts an order status update per customer. Changes no promise date and sends nothing.',
  args, required: ['orders'],
  sources: { orders: { label: 'Open sales order lines', args: ['orders'], fields: ORDER_FIELDS, profiles: ORDER_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => orderBacklog(read('orders'), s, a.as_of),
  line: (r) => `${r.open_lines} open line(s) as of ${r.as_of}, ${r.backlog_value} of backlog: ${r.past_due_value} past due on ${r.flag} line(s), ${r.review} not promised or on hold, ${r.watch} due soon or promised late, ${r.ok} on schedule.`,
  item: { key: 'order_line', arg: 'order_line', label: 'order line' },
  check: { title: 'Check order backlog and promise dates', description: 'For each open line (open quantity, not closed): flags lines past the promise date (or the requested date when there is no promise); lists lines due within the at-risk window and promises later than requested; reviews lines with no promise and lines on hold. Totals by promise month and customer.' },
  report: {
    base: 'order-backlog', title: (r) => `Order backlog and promise dates as of ${r.as_of}`,
    rows: (r) => r.items.map((i) => ({ order_line: i.order_line, order_number: i.order_number, customer: i.customer, item: i.item, requested_date: i.requested_date, promise_date: i.promise_date, qty_open: i.qty_open, open_value: i.open_value, days: i.days_to_promise, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['order_number', 'customer', 'item', 'requested_date', 'promise_date', 'qty_open', 'open_value', 'status', 'reasons'],
    sections: (r) => [{ title: 'By promise month', rows: r.by_month, columns: ['month', 'lines', 'open_value'] }, { title: 'By customer', rows: r.by_customer, columns: ['customer', 'lines', 'open_value', 'past_due_value'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Backlog value is open quantity times line price; discounts, freight and tax are not added.'],
  },
  draft: {
    noun: 'promise_update', verb: 'send', category: 'binding_send', actor: 'customer service',
    description: 'Write drafts/promise_update-<customer>.md: one customer\'s late, unpromised and later-than-asked lines, with a reminder to check new dates with production. Marked DRAFT. Sending goes through backlog_request_send (one click).',
    required: ['orders', 'customer'],
    args: { customer: { type: 'string', description: 'Customer as it appears in the order lines' }, from: { type: 'string', description: 'Your name and company' } },
    build: (r, a) => {
      const is = partyIs(a.customer); const mine = r.items.filter((i) => is(i.customer));
      if (!mine.length) throw new Error(`no open lines for customer "${String(a.customer).slice(0, 80)}"`);
      const d = promiseUpdateText(mine, { customer: mine[0].customer, from: a.from });
      if (!d.rows.length) throw new Error(`every open line for ${mine[0].customer} is on schedule`);
      return { id: mine[0].customer, text: d.text, amount: Math.round(d.rows.reduce((x, i) => x + i.open_value, 0) * 100) / 100 };
    },
  },
  refused: [
    { name: 'erp_change_promise_date', category: 'production_deploy', description: 'Never changes promise or ship dates in the ERP.' },
    { name: 'customer_email_send', category: 'binding_send', description: 'Never emails or messages a customer.' },
  ],
  prompt: { name: 'backlog_review', title: 'Review order backlog', text: 'You are helping customer service or a planner with fairmake-order-backlog. Call backlog_check with the open order lines, as_of today. Lead with past-due value by customer, then lines with no promise, then lines due this week. Offer backlog_write_report and, per customer, backlog_draft_promise_update. New dates are a person\'s decision.' },
});

export const DEMO = {
  intro: 'Fairmake Order Backlog demo: ten fictional open order lines for four customers, as of 2026-11-18.',
  files: { orders: 'orders.csv', settings: 'settings.json', as_of: '2026-11-18' },
  explain: { order_line: 'SO-501-1' },
  draft: { customer: 'Example Pumps Co', from: 'Sam Service (fictional)' },
};
