import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows, partyIs } from 'fairmake-core';
import { PO_FIELDS, PO_PROFILES, DEFAULTS, SETTINGS_SCHEMA, openPurchaseOrders, expediteText } from './openpo.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  po_lines: { type: 'string', description: 'Open purchase order lines under --root: line, PO, supplier, item, order, due, promise and need dates, quantities ordered and received, price' },
  as_of: { type: 'string', format: 'date', description: 'Date to measure from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'open_po',
  description: 'Reviews every open purchase order line: flags lines past their promise or due date with the value still open and promises that land after production needs the part, reviews lines never confirmed and over-receipts, lists promises later than requested, totals by supplier and drafts a delivery status request per supplier. Changes no PO and sends nothing.',
  args, required: ['po_lines'],
  sources: { po_lines: { label: 'Open purchase order lines', args: ['po_lines'], fields: PO_FIELDS, profiles: PO_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => openPurchaseOrders(read('po_lines'), s, a.as_of),
  line: (r) => `${r.lines} PO line(s) as of ${r.as_of}, ${r.open_lines} open worth ${r.open_value}: ${r.past_due_value} past due. ${r.flag} late or at risk, ${r.review} unconfirmed or over-received, ${r.watch} promised late, ${r.ok} on track.`,
  item: { key: 'po_line', arg: 'po_line', label: 'PO line' },
  check: { title: 'Check open purchase orders', description: 'For each open line: flags lines past the promise date (or the due date when there is no promise) and promises after the production need date; reviews lines with no promise some days after ordering and lines received over the ordered quantity; lists promises later than the requested date. Totals by supplier.' },
  report: {
    base: 'late-purchase-orders', title: (r) => `Open purchase orders as of ${r.as_of}`,
    rows: (r) => r.items.map((i) => ({ po_line: i.po_line, po_number: i.po_number, supplier: i.supplier, item: i.item, due_date: i.due_date, promise_date: i.promise_date, need_date: i.need_date, qty_open: i.qty_open, open_value: i.open_value, days: i.days_late, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['po_number', 'supplier', 'item', 'due_date', 'promise_date', 'qty_open', 'open_value', 'days', 'status', 'reasons'],
    sections: (r) => [{ title: 'By supplier', rows: r.by_supplier, columns: ['supplier', 'lines', 'open_value', 'past_due_lines', 'past_due_value'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Receipts are as of your export; goods in transit are not seen.'],
  },
  draft: {
    noun: 'expedite_request', verb: 'send', category: 'binding_send', actor: 'the buyer',
    description: 'Write drafts/expedite_request-<supplier>.md: one supplier\'s past-due, unconfirmed and at-risk lines, asking for confirmed ship dates. Marked DRAFT. Sending goes through open_po_request_send (one click); the buyer sends it.',
    required: ['po_lines', 'supplier'],
    args: { supplier: { type: 'string', description: 'Supplier as it appears in the PO lines' }, from: { type: 'string', description: 'Your name and company' } },
    build: (r, a) => {
      const is = partyIs(a.supplier); const mine = r.items.filter((i) => is(i.supplier));
      if (!mine.length) throw new Error(`no PO lines for supplier "${String(a.supplier).slice(0, 80)}"`);
      const d = expediteText(mine, { supplier: mine[0].supplier, from: a.from });
      if (!d.rows.length) throw new Error(`nothing to chase with ${mine[0].supplier}`);
      return { id: mine[0].supplier, text: d.text, amount: Math.round(d.rows.reduce((x, i) => x + i.open_value, 0) * 100) / 100 };
    },
  },
  refused: [
    { name: 'supplier_portal_update', category: 'production_deploy', description: 'Never logs in to or updates a supplier portal.' },
    { name: 'erp_cancel_po', category: 'production_deploy', description: 'Never changes, re-dates or cancels a purchase order.' },
  ],
  prompt: { name: 'open_po_review', title: 'Review open purchase orders', text: 'You are helping a buyer with fairmake-late-purchase-orders. Call open_po_check with the open PO lines, as_of today. Lead with past-due value by supplier and promises after the production need date, then unconfirmed lines. Offer open_po_write_report and, per supplier, open_po_draft_expedite_request. Changing POs is refused.' },
});

export const DEMO = {
  intro: 'Fairmake Late Purchase Orders demo: ten fictional open PO lines from four suppliers, as of 2026-11-18.',
  files: { po_lines: 'po-lines.csv', settings: 'settings.json', as_of: '2026-11-18' },
  explain: { po_line: 'PO-601-1' },
  draft: { supplier: 'Northwind Metals', from: 'Robin Buyer (fictional)' },
};
