import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { COUNT_FIELDS, COUNT_PROFILES, DEFAULTS, SETTINGS_SCHEMA, cycleCounts, adjustmentText } from './counts.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = { counts: { type: 'string', description: 'Cycle count results under --root: count line, item, location, system and counted quantity, unit cost and ABC class' } };

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'counts',
  description: 'Compares every cycle count with the system quantity using tolerances by ABC class and a value floor: flags lines out of tolerance, reviews lines not counted and negative system stock, lists items that vary count after count, works out count accuracy by class and drafts the adjustments for approval. Posts no adjustment and moves no stock.',
  args, required: ['counts'],
  sources: { counts: { label: 'Cycle count results', args: ['counts'], fields: COUNT_FIELDS, profiles: COUNT_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => cycleCounts(read('counts'), s),
  line: (r) => `${r.lines} count line(s), ${r.counted} counted: accuracy ${r.accuracy_pct}%, net variance ${r.net_variance_value}, ${r.out_of_tolerance_value} out of tolerance on ${r.flag} line(s), ${r.review} to review, ${r.watch} repeat variances.`,
  item: { key: 'count_id', arg: 'count_id', label: 'count line' },
  check: { title: 'Check cycle count variance', description: 'For each count line, compare counted with system quantity. Flags variances over the class tolerance % and over the value floor; reviews lines with no count and negative system stock; lists items with a variance on several counts. Returns accuracy and variance value by ABC class.' },
  report: {
    base: 'cycle-counts', title: 'Cycle count variance',
    rows: (r) => r.items.map((i) => ({ count_id: i.count_id, item: i.item, location: i.location, abc_class: i.abc_class, system_qty: i.system_qty, counted_qty: i.counted_qty, variance_qty: i.variance_qty, variance_value: i.variance_value, variance_pct: i.variance_pct, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['count_id', 'item', 'location', 'abc_class', 'system_qty', 'counted_qty', 'variance_value', 'status', 'reasons'],
    sections: (r) => [{ title: 'By class', rows: r.by_class, columns: ['class', 'lines', 'accuracy_pct', 'net_value', 'abs_value'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Variance value is variance quantity times the unit cost in your file. Transactions between the snapshot and the count are not reconciled.'],
  },
  draft: {
    noun: 'inventory_adjustment', verb: 'approve', category: 'move_money', actor: 'the controller',
    description: 'Write drafts/inventory_adjustment-open.md: the count lines out of tolerance with quantity and value, to be recounted and then approved. Marked DRAFT. Approving goes through counts_request_approve (one click); a person posts adjustments in the ERP.',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.flag) throw new Error('no count line is out of tolerance'); return { id: 'open', text: adjustmentText(r, a), amount: r.out_of_tolerance_value }; },
  },
  refused: [
    { name: 'erp_post_inventory_adjustment', category: 'move_money', description: 'Never posts inventory adjustments or write-offs.' },
    { name: 'wms_move_stock', category: 'production_deploy', description: 'Never moves stock between bins or changes the WMS.' },
  ],
  prompt: { name: 'cycle_count_review', title: 'Review cycle count variance', text: 'You are helping an inventory manager or controller with fairmake-cycle-counts. Call counts_check on the count results. Lead with the out-of-tolerance value by class, then repeat variances (process causes) and lines not counted. Offer counts_write_report and counts_draft_inventory_adjustment; adjustments are posted by a person after a recount.' },
});

export const DEMO = {
  intro: 'Fairmake Cycle Counts demo: twelve fictional count lines across A, B and C items.',
  files: { counts: 'counts.csv', settings: 'settings.json' },
  explain: { count_id: 'CC-1003' },
  draft: { from: 'Casey Controller (fictional)' },
};
