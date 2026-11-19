import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { ORDER_FIELDS, INVOICE_FIELDS, INVOICE_PROFILES, DEFAULTS, SETTINGS_SCHEMA, rowsFromX12, invoiceCheck, correctionText } from './invoice.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  edi: { type: 'string', description: 'X12 file under --root with the customer\'s 850 purchase orders and your 810 invoices (instead of orders and invoices)' },
  orders: { type: 'string', description: 'Customer purchase order lines under --root (when there is no X12 file): PO, line, item, quantity, unit price' },
  invoices: { type: 'string', description: 'Your invoice lines to the customer under --root (when there is no X12 file): invoice, PO, line, item, quantity, unit price, date' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'edi_invoice',
  description: 'Checks your invoices to customers (EDI 810 or tables) against their purchase orders (850): prices that differ from the PO, quantities invoiced beyond the PO, items not on the PO, POs not found, possible duplicate invoices and 810 totals that do not add up, with the amount a customer is likely to deduct. Drafts a correction list for billing. Transmits and credits nothing.',
  args, required: [],
  sources: { orders: { label: 'Customer PO lines', args: ['orders'], fields: ORDER_FIELDS }, invoices: { label: 'Invoice lines', args: ['invoices'], fields: INVOICE_FIELDS, profiles: INVOICE_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s, ctx }) => {
    if (!a.edi && !a.orders && !a.invoices) throw new Error('pass edi (an X12 file with 850s and 810s), or orders and invoices as tables');
    const x = a.edi ? rowsFromX12(ctx.readText(a.edi)) : { orders: [], invoices: [], totals: [], problems: [] };
    const r = invoiceCheck({ orders: [...x.orders, ...read('orders')], invoices: [...x.invoices, ...read('invoices')], totals: x.totals }, s);
    return { ...r, x12_problems: x.problems.map((p) => `${p.code}: ${p.message}`) };
  },
  line: (r) => `${r.invoices} invoice(s) against ${r.orders} customer PO(s), ${r.invoiced} invoiced: ${r.flag} differ from the PO (${r.at_risk} at risk), ${r.review} to check, ${r.ok} match.${r.x12_problems.length ? ` ${r.x12_problems.length} X12 envelope problem(s).` : ''}`,
  item: { key: 'invoice', arg: 'invoice', label: 'invoice' },
  check: { title: 'Check invoices against customer orders', description: 'Match every invoice line to the customer\'s PO line by PO and item. Flags unit prices off the PO beyond the tolerance, quantities invoiced beyond the PO across invoices, items not on the PO and POs not found; reviews invoices with the same lines as an earlier one and 810 totals that do not equal their lines. Reads an X12 file with 850s and 810s, or CSV tables.' },
  report: {
    base: 'edi-invoice-check', title: 'Customer invoices against customer orders',
    rows: (r) => r.items.map((i) => ({ invoice: i.invoice, po_number: i.po_number, invoice_date: i.invoice_date, lines: i.lines, value: i.value, at_risk: i.at_risk, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['invoice', 'po_number', 'invoice_date', 'value', 'at_risk', 'status', 'reasons'],
    sections: (r) => [{ title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Lines are matched by PO and item; partial shipments across several invoices are added up in invoice date order.', 'X12 element positions follow the public 004010 structure as recalled; check the first file read with your EDI provider.'],
  },
  draft: {
    noun: 'invoice_correction', verb: 'send', category: 'binding_send', actor: 'the billing lead',
    description: 'Write drafts/invoice_correction-open.md: every invoice that differs from the customer PO, with the amount at risk, for billing to correct before the customer deducts. Marked DRAFT. Sending goes through edi_invoice_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review === 0) throw new Error('every invoice matches its PO'); return { id: 'open', text: correctionText(r, a), amount: r.at_risk }; },
  },
  refused: [
    { name: 'edi_transmit', category: 'binding_send', description: 'Never sends, resends or cancels an EDI invoice.' },
    { name: 'ar_issue_credit', category: 'move_money', description: 'Never issues a credit memo or changes an invoice in AR.' },
  ],
  prompt: { name: 'edi_invoice_review', title: 'Check invoices against customer orders', text: 'You are helping a billing or AR lead at a supplier with fairmake-edi-invoice-check. Call edi_invoice_check with the X12 file (or the order and invoice tables). Lead with price and quantity differences and the amount a customer is likely to deduct, then items not on the PO. Offer edi_invoice_write_report and edi_invoice_draft_invoice_correction. Sending EDI and issuing credits are refused.' },
});

export const DEMO = {
  intro: 'Fairmake EDI Invoice Check demo: fictional customer POs and invoices.',
  files: { orders: 'orders.csv', invoices: 'invoices.csv', settings: 'settings.json' },
  explain: { invoice: 'INV-4002' },
  draft: { from: 'Alex AR (fictional)' },
};
