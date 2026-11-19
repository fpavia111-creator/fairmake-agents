import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { WO_FIELDS, WO_PROFILES, DEFAULTS, SETTINGS_SCHEMA, costVariance, reviewText } from './variance.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = { work_orders: { type: 'string', description: 'Work order cost export under --root (CSV, Excel or JSON): standard and actual material, labor and overhead per work order or job' } };

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'cost_variance',
  description: 'Compares standard and actual cost on every work order, element by element (material, labor, overhead), flags what is over tolerance, sends loose standards and work orders closed with no output for review, and drafts a variance review for the production manager. Posts nothing.',
  args, required: ['work_orders'],
  sources: { work_orders: { label: 'Work order costs', args: ['work_orders'], fields: WO_FIELDS, profiles: WO_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => costVariance(read('work_orders'), s),
  line: (r) => `${r.work_orders} work order(s): standard ${r.standard}, actual ${r.actual}, variance ${r.variance}. ${r.flag} over tolerance (${r.flagged_over}), ${r.review} to review, ${r.ok} within tolerance.`,
  item: { key: 'work_order', arg: 'work_order', label: 'work order', describe: (i) => `${i.work_order} (${i.item || 'no item'}): standard ${i.standard}, actual ${i.actual}, variance ${i.variance}. ${i.elements.map((e) => `${e.element} ${e.actual} vs ${e.standard}`).join('; ')}. ${i.findings.map((f) => f.detail).join(' ') || 'Within tolerance.'}` },
  check: { title: 'Check work order cost variances', description: 'Compare standard and actual cost on every work order by element (material, labor, overhead). Flags elements over both the percentage and the amount tolerance, reviews large favorable variances and work orders with no standard, and flags work orders closed with cost and no output. Returns totals by element and by finding.' },
  report: {
    base: 'cost-variance', title: 'Standard against actual cost by work order',
    rows: (r) => r.items.map((i) => ({ work_order: i.work_order, item: i.item, status: i.status, standard: i.standard, actual: i.actual, variance: i.variance, variance_pct: i.variance_pct, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['work_order', 'item', 'status', 'standard', 'actual', 'variance', 'variance_pct', 'reasons'],
    sections: (r) => [{ title: 'By cost element', rows: r.by_element, columns: ['element', 'standard', 'actual', 'variance'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Variances are actual minus standard as your export states them. The agent does not split price and usage, and does not know your costing method.'],
  },
  draft: {
    noun: 'variance_review', verb: 'send', category: 'binding_send', actor: 'the cost accountant',
    description: 'Write drafts/variance_review-<id>.md: every work order over tolerance or needing a look, with the element, amount and reason, addressed to the production manager. Marked DRAFT. Sending goes through cost_variance_request_send (one click); a person sends it.',
    args: { to: { type: 'string', description: 'Who the review goes to (name or role)' }, from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.items.some((i) => i.status !== 'ok')) throw new Error('every work order is within tolerance; there is nothing to review'); return { id: 'open', text: reviewText(r, a), amount: r.flagged_over }; },
  },
  refused: [
    { name: 'erp_post_journal', category: 'move_money', description: 'Never posts variance journals, closes work orders or changes the books in the ERP; your accountant does that.' },
    { name: 'erp_update_standard_cost', category: 'production_deploy', description: 'Never changes standard costs in the item master.' },
  ],
  prompt: { name: 'work_order_variance_review', title: 'Review work order cost variances', text: 'You are helping a cost accountant review work order variances with fairmake-cost-variance. Call cost_variance_check on the export, lead with the flagged work orders and the elements driving them, then the ones to review (missing or loose standards). Offer cost_variance_write_report and, when asked, cost_variance_draft_variance_review. Never post journals or change standards: those tools are refused.' },
});

export const DEMO = {
  intro: 'Fairmake Cost Variance demo: ten fictional work orders at a fictional machine shop.',
  files: { work_orders: 'work-orders.csv', settings: 'settings.json' },
  explain: { work_order: 'WO-1003' },
  draft: { from: 'Casey Controller (fictional)' },
};
