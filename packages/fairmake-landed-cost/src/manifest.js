import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { RECEIPT_FIELDS, CHARGE_FIELDS, RECEIPT_PROFILES, DEFAULTS, SETTINGS_SCHEMA, landedCost, adjustmentText } from './landed.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  receipts: { type: 'string', description: 'Purchase receipts under --root: receipt, supplier, goods value and landed cost already allocated into item cost' },
  charges: { type: 'string', description: 'Freight, duty and brokerage bills under --root: bill id, the receipt it applies to, vendor, type and amount' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'landed_cost',
  description: 'Matches freight-in, duty and brokerage bills to the receipts they belong to and to the landed cost allocated into item cost: flags bills not allocated, reviews allocations with no bill, freight-collect receipts with no freight bill and bills that match no receipt, and lists receipts whose landed cost share is far above the median. Not a three-way match of goods invoices; posts nothing.',
  args, required: ['receipts', 'charges'],
  sources: { receipts: { label: 'Purchase receipts', args: ['receipts'], fields: RECEIPT_FIELDS, profiles: RECEIPT_PROFILES }, charges: { label: 'Freight, duty and brokerage bills', args: ['charges'], fields: CHARGE_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => landedCost({ receipts: read('receipts'), charges: read('charges') }, s),
  line: (r) => `${r.receipts} receipt(s), ${r.goods_value} of goods, ${r.billed} of landed cost billed and ${r.allocated} allocated: ${r.not_allocated} not allocated, ${r.unmatched} on bills matching no receipt. ${r.flag} to allocate, ${r.review} to review, ${r.watch} to watch.`,
  item: { key: 'reference', arg: 'reference', label: 'receipt or bill' },
  check: { title: 'Check landed cost and freight-in', description: 'Match every freight, duty and brokerage bill to its receipt and compare with the landed cost allocated into item cost. Flags billed landed cost not allocated; reviews allocations with no bill, receipts from freight-collect suppliers with no freight bill, and bills matching no receipt; lists receipts whose landed cost share is far above the median.' },
  report: {
    base: 'landed-cost', title: 'Landed cost and freight-in',
    rows: (r) => r.items.map((i) => ({ reference: i.reference, kind: i.kind, supplier: i.supplier, goods_value: i.goods_value, billed: i.billed, allocated: i.allocated, landed_pct: i.landed_pct, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['reference', 'kind', 'supplier', 'goods_value', 'billed', 'allocated', 'landed_pct', 'status', 'reasons'],
    sections: (r) => [{ title: 'Unmatched charges', rows: r.unmatched_charges, columns: ['reference', 'supplier', 'billed'] }, { title: 'By supplier', rows: r.by_supplier, columns: ['supplier', 'receipts', 'goods_value', 'billed', 'landed_pct'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Bills are matched to receipts by the receipt reference on the bill. Goods invoice matching (PO, receipt, invoice) is a different job and is not done here.'],
  },
  draft: {
    noun: 'landed_cost_adjustment', verb: 'approve', category: 'move_money', actor: 'the accountant',
    description: 'Write drafts/landed_cost_adjustment-open.md: every receipt with landed cost billed and not allocated, with the bills behind it. Marked DRAFT. Approving goes through landed_cost_request_approve (one click); the accountant posts it in the ERP.',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.not_allocated) throw new Error('no billed landed cost is waiting to be allocated'); return { id: 'open', text: adjustmentText(r, a), amount: r.not_allocated }; },
  },
  refused: [
    { name: 'erp_post_landed_cost', category: 'move_money', description: 'Never posts landed cost, freight or duty allocations in the ERP.' },
    { name: 'ap_pay_invoice', category: 'move_money', description: 'Never pays a freight, duty or brokerage bill.' },
  ],
  prompt: { name: 'landed_cost_review', title: 'Review landed cost and freight-in', text: 'You are helping an accountant at a manufacturer or distributor with fairmake-landed-cost. Call landed_cost_check with receipts and freight, duty and brokerage bills. Lead with billed cost not allocated into inventory, then bills matching no receipt and receipts from freight-collect suppliers with no bill. Offer landed_cost_write_report and landed_cost_draft_landed_cost_adjustment; posting is a person\'s job.' },
});

export const DEMO = {
  intro: 'Fairmake Landed Cost demo: eight fictional receipts and nine freight, duty and brokerage bills.',
  files: { receipts: 'receipts.csv', charges: 'charges.csv', settings: 'settings.json' },
  explain: { reference: 'RCV-701' },
  draft: { from: 'Casey Controller (fictional)' },
};
