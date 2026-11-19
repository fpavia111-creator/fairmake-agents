import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows, partyIs } from 'fairmake-core';
import { RECEIPT_FIELDS, RECEIPT_PROFILES, DEFAULTS, SETTINGS_SCHEMA, priceVariance, priceQueryText } from './ppv.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = { receipts: { type: 'string', description: 'Purchase receipt lines under --root (CSV, Excel or JSON): item, supplier, quantity, unit price and standard cost per receipt line' } };

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'ppv',
  description: 'Measures purchase price variance on every receipt line against standard cost, flags lines over tolerance, lists price jumps from the same supplier and likely unit-of-measure slips, names the standards to review, and drafts a price query to a supplier. Changes no standard and pays nothing.',
  args, required: ['receipts'],
  sources: { receipts: { label: 'Purchase receipt lines', args: ['receipts'], fields: RECEIPT_FIELDS, profiles: RECEIPT_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => priceVariance(read('receipts'), s),
  line: (r) => `${r.lines} receipt line(s), ${r.received} received: purchase price variance ${r.ppv_total}. ${r.flag} over tolerance (${r.unfavorable_flagged}), ${r.review} to review, ${r.watch} to watch, ${r.ok} clean; ${r.standards_to_review.length} standard(s) to review.`,
  item: { key: 'receipt', arg: 'receipt', label: 'receipt line' },
  check: { title: 'Check purchase price variance', description: 'Measure every receipt line against standard cost. Flags lines over both the percentage and the amount tolerance, lists price jumps from the same supplier, likely unit-of-measure slips and items with no standard, and names standards that every receipt disagrees with. Returns totals by supplier.' },
  report: {
    base: 'purchase-price-variance', title: 'Purchase price variance',
    rows: (r) => r.items.map((i) => ({ receipt: i.receipt, po_number: i.po_number, item: i.item, supplier: i.supplier, receipt_date: i.receipt_date, qty: i.qty, unit_price: i.unit_price, std_cost: i.std_cost, ppv: i.ppv, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['receipt', 'item', 'supplier', 'qty', 'unit_price', 'std_cost', 'ppv', 'status', 'reasons'],
    sections: (r) => [{ title: 'By supplier', rows: r.by_supplier, columns: ['supplier', 'lines', 'received', 'ppv'] }, { title: 'Standards to review', rows: r.standards_to_review, columns: ['item', 'receipts', 'std_cost', 'avg_price', 'change_pct'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Variance is (receipt price minus standard) times quantity, from the prices in your export. Landed cost, freight and currency are not added.'],
  },
  draft: {
    noun: 'price_query', verb: 'send', category: 'binding_send', actor: 'the buyer',
    description: 'Write drafts/price_query-<supplier>.md: the receipt lines from one supplier priced over standard or up from the last price, asking for the agreed price or a credit note. Marked DRAFT. Sending goes through ppv_request_send (one click); the buyer sends it.',
    required: ['receipts', 'supplier'],
    args: { supplier: { type: 'string', description: 'Supplier as it appears in the receipts' }, from: { type: 'string', description: 'Your name and company' } },
    build: (r, a) => {
      const is = partyIs(a.supplier); const mine = r.items.filter((i) => is(i.supplier));
      if (!mine.length) throw new Error(`no receipt lines for supplier "${String(a.supplier).slice(0, 80)}"`);
      const d = priceQueryText(mine, { supplier: mine[0].supplier, from: a.from });
      if (!d.rows.length) throw new Error(`nothing to query with ${mine[0].supplier}: no line is over standard or up from the last price`);
      return { id: mine[0].supplier, text: d.text, amount: Math.round(d.rows.reduce((x, i) => x + i.findings.filter((f) => f.code === 'ppv_unfavorable').reduce((y, f) => y + f.amount, 0), 0) * 100) / 100 };
    },
  },
  refused: [
    { name: 'erp_update_standard_cost', category: 'production_deploy', description: 'Never changes standard costs in the item master; the cost accountant does that after review.' },
    { name: 'ap_pay_invoice', category: 'move_money', description: 'Never pays, holds or short-pays a supplier invoice.' },
  ],
  prompt: { name: 'purchase_price_variance_review', title: 'Review purchase price variance', text: 'You are helping a buyer or cost accountant review purchase price variance with fairmake-purchase-price-variance. Call ppv_check, lead with the lines over tolerance by supplier, then unit-of-measure slips and missing standards, then the standards every receipt disagrees with. Offer ppv_write_report and, per supplier, ppv_draft_price_query. Never change standards or pay invoices.' },
});

export const DEMO = {
  intro: 'Fairmake Purchase Price Variance demo: twelve fictional receipt lines from four fictional suppliers.',
  files: { receipts: 'receipts.csv', settings: 'settings.json' },
  explain: { receipt: 'RC-1003-1' },
  draft: { supplier: 'North Example Metals', from: 'Robin Buyer (fictional)' },
};
