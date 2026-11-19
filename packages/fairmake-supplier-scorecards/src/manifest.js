import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows, partyIs } from 'fairmake-core';
import { RECEIPT_FIELDS, RECEIPT_PROFILES, DEFAULTS, SETTINGS_SCHEMA, scorecards, scorecardText } from './scorecard.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = { receipts: { type: 'string', description: 'Purchase receipts under --root: receipt, supplier, item, due and receipt dates, quantity received and rejected, invoice and PO price' } };

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'scorecard',
  description: 'Scores every supplier on on-time delivery, rejects in parts per million and price against PO, weighted into one ranked score; flags suppliers below the on-time or quality target, lists invoicing above PO price, reviews thin data, and drafts a scorecard for a supplier. Disqualifies nobody and holds no payment.',
  args, required: ['receipts'],
  sources: { receipts: { label: 'Purchase receipts', args: ['receipts'], fields: RECEIPT_FIELDS, profiles: RECEIPT_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => scorecards(read('receipts'), s),
  line: (r) => `${r.suppliers} supplier(s) over ${r.receipts} receipt line(s): ${r.flag} below target, ${r.review} with too few receipts, ${r.watch} invoicing above PO, ${r.ok} on target.`,
  item: { key: 'supplier', arg: 'supplier', label: 'supplier' },
  check: { title: 'Score suppliers', description: 'Per supplier: on-time % (received by the due date plus grace), rejects in ppm, price variance against PO, and a weighted score (weights in settings) ranked best first. Flags on-time below target and ppm above target; lists price above PO; reviews suppliers with few receipts.' },
  report: {
    base: 'supplier-scorecards', title: 'Supplier scorecard',
    rows: (r) => r.items.map((i) => ({ rank: i.rank, supplier: i.supplier, receipts: i.receipts, on_time_pct: i.on_time_pct, ppm: i.ppm, price_variance_pct: i.price_variance_pct, score: i.score, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['rank', 'supplier', 'receipts', 'on_time_pct', 'ppm', 'price_variance_pct', 'score', 'status'],
    labels: { on_time_pct: 'On-time %', price_variance_pct: 'Price variance %', ppm: 'Rejects (ppm)' },
    sections: (r) => [{ title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['The score is arithmetic on your receipts with the weights you set. It says nothing about a supplier\'s finances or compliance.'],
  },
  draft: {
    noun: 'scorecard', verb: 'send', category: 'binding_send', actor: 'the purchasing manager',
    description: 'Write drafts/scorecard-<supplier>.md: one supplier\'s on-time, quality, price and score with the points to work on. Marked DRAFT. Sending goes through scorecard_request_send (one click).',
    required: ['receipts', 'supplier'],
    args: { supplier: { type: 'string', description: 'Supplier as it appears in the receipts' }, from: { type: 'string', description: 'Your name and company' }, period: { type: 'string', description: 'Period the scorecard covers, for the text' } },
    build: (r, a) => { const is = partyIs(a.supplier); const c = r.items.find((i) => is(i.supplier)); if (!c) throw new Error(`no receipts for supplier "${String(a.supplier).slice(0, 80)}"`); return { id: c.supplier, text: scorecardText(c, a) }; },
  },
  refused: [
    { name: 'supplier_disqualify', category: 'production_deploy', description: 'Never blocks, disqualifies or changes a supplier in the ERP.' },
    { name: 'ap_hold_payments', category: 'move_money', description: 'Never holds or changes payments to a supplier.' },
  ],
  prompt: { name: 'supplier_scorecard_review', title: 'Score suppliers', text: 'You are helping a purchasing or quality manager with fairmake-supplier-scorecards. Call scorecard_check on the receipts. Lead with the lowest-ranked suppliers and why (on-time, ppm, price), and say when a score rests on few receipts. Offer scorecard_write_report and, per supplier, scorecard_draft_scorecard.' },
});

export const DEMO = {
  intro: 'Fairmake Supplier Scorecards demo: fourteen fictional receipt lines from five suppliers.',
  files: { receipts: 'receipts.csv', settings: 'settings.json' },
  explain: { supplier: 'Demo Castings LLC' },
  draft: { supplier: 'Demo Castings LLC', from: 'Robin Buyer (fictional)', period: 'October and November 2026' },
};
