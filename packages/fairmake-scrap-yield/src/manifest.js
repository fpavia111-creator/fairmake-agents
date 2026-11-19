import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { PROD_FIELDS, STD_FIELDS, PROD_PROFILES, DEFAULTS, SETTINGS_SCHEMA, scrapYield, scrapReviewText } from './scrap.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  production: { type: 'string', description: 'Production counts under --root (ERP completions or an MES export): work order, item, work center, quantities started, good and scrapped, unit cost and scrap reason' },
  standards: { type: 'string', description: 'Optional standard scrap % per item under --root (items without one use the default in settings)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'scrap',
  description: 'Measures scrap and yield on every work order against each item\'s standard scrap rate: flags scrap well above standard with the cost of the excess, reviews scrap with no reason and counts that do not add up, and totals scrap by work center and by reason. Posts no scrap and changes no machine.',
  args, required: ['production'],
  sources: { production: { label: 'Production counts', args: ['production'], fields: PROD_FIELDS, profiles: PROD_PROFILES }, standards: { label: 'Standard scrap rates', args: ['standards'], fields: STD_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => scrapYield({ production: read('production'), standards: read('standards') }, s),
  line: (r) => `${r.work_orders} work order(s), ${r.started} started, ${r.scrap} scrapped (${r.scrap_pct}%, ${r.scrap_cost}): ${r.excess_cost} above standard on ${r.flag} order(s), ${r.review} to review, ${r.ok} within standard.`,
  item: { key: 'work_order', arg: 'work_order', label: 'work order' },
  check: { title: 'Check scrap and yield', description: 'Compare each work order\'s scrap rate with its item\'s standard (or the default). Flags scrap above the standard times the alert factor with the cost of the excess; reviews scrap with no reason, good plus scrap not equal to started and yield over 100%. Totals by work center and reason.' },
  report: {
    base: 'scrap-yield', title: 'Scrap and yield',
    rows: (r) => r.items.map((i) => ({ work_order: i.work_order, item: i.item, work_center: i.work_center, started: i.started, good: i.good, scrap: i.scrap, scrap_pct: i.scrap_pct, std_scrap_pct: i.std_scrap_pct, scrap_cost: i.scrap_cost, reason: i.reasons, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['work_order', 'item', 'work_center', 'started', 'scrap', 'scrap_pct', 'std_scrap_pct', 'scrap_cost', 'status', 'reasons'],
    sections: (r) => [{ title: 'By work center', rows: r.by_work_center, columns: ['work_center', 'work_orders', 'started', 'scrap', 'scrap_pct', 'scrap_cost'] }, { title: 'By reason', rows: r.by_reason, columns: ['reason', 'scrap', 'scrap_cost'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Scrap cost is scrapped quantity times the unit cost in your file; rework and downgraded parts are not counted separately.'],
  },
  draft: {
    noun: 'scrap_review', verb: 'send', category: 'binding_send', actor: 'the plant manager',
    description: 'Write drafts/scrap_review-open.md: the work orders with scrap above standard or with missing reasons, for the quality manager to give causes and actions. Marked DRAFT. Sending goes through scrap_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review === 0) throw new Error('every work order is within its scrap standard'); return { id: 'open', text: scrapReviewText(r, a), amount: r.excess_cost }; },
  },
  refused: [
    { name: 'erp_post_scrap', category: 'move_money', description: 'Never posts scrap transactions or inventory write-offs.' },
    { name: 'mes_change_setpoint', category: 'production_deploy', description: 'Never changes machine settings, recipes or MES configuration.' },
  ],
  prompt: { name: 'scrap_yield_review', title: 'Review scrap and yield', text: 'You are helping a plant or quality manager with fairmake-scrap-yield. Call scrap_check with production counts and, if available, standard scrap rates. Lead with the work orders whose scrap cost most above standard, then work centers and reasons. Offer scrap_write_report and scrap_draft_scrap_review. Posting scrap and changing machines are refused.' },
});

export const DEMO = {
  intro: 'Fairmake Scrap Yield demo: ten fictional work orders on four work centers.',
  files: { production: 'production.csv', standards: 'standards.csv', settings: 'settings.json' },
  explain: { work_order: 'WO-4002' },
  draft: { from: 'Morgan Plant Manager (fictional)' },
};
