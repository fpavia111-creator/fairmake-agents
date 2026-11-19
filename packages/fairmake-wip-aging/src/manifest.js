import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { WO_FIELDS, WO_PROFILES, DEFAULTS, SETTINGS_SCHEMA, wipAging, wipReviewText } from './wip.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  work_orders: { type: 'string', description: 'Work order list under --root: status, release, due and last activity dates, WIP value and quantities' },
  as_of: { type: 'string', format: 'date', description: 'Date to age from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'wip',
  description: 'Ages every work order holding work in process: buckets by days since release, flags stale work orders with WIP and closed ones still holding WIP, lists past-due and over-completed orders, and drafts a WIP review for production control. Closes nothing and posts nothing.',
  args, required: ['work_orders'],
  sources: { work_orders: { label: 'Work orders', args: ['work_orders'], fields: WO_FIELDS, profiles: WO_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => wipAging(read('work_orders'), s, a.as_of),
  line: (r) => `${r.work_orders} work order(s) as of ${r.as_of}, ${r.open} open, ${r.wip_total} in WIP: ${r.stale_wip} on stale orders, ${r.closed_wip} on closed ones. ${r.flag} to act on, ${r.review} to review, ${r.watch} past due, ${r.ok} fine.`,
  item: { key: 'work_order', arg: 'work_order', label: 'work order' },
  check: { title: 'Age work in process', description: 'Age every work order by days since release and bucket the WIP. Flags open orders holding WIP with no activity past the stale limit, closed orders still holding WIP and negative WIP; lists past-due and over-completed orders.' },
  report: {
    base: 'wip-aging', title: (r) => `WIP aging as of ${r.as_of}`,
    rows: (r) => r.items.map((i) => ({ work_order: i.work_order, item: i.item, wo_status: i.wo_status, release_date: i.release_date, due_date: i.due_date, last_activity: i.last_activity, days_open: i.age_days, age_bucket: i.age_bucket, wip_value: i.wip_value, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['work_order', 'item', 'wo_status', 'days_open', 'age_bucket', 'wip_value', 'status', 'reasons'],
    sections: (r) => [{ title: 'By age', rows: r.by_age, columns: ['age_bucket', 'count', 'wip_value'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['WIP value is the figure in your export; the agent does not recompute it from issues, labor and completions.'],
  },
  draft: {
    noun: 'wip_review', verb: 'send', category: 'binding_send', actor: 'the cost accountant',
    description: 'Write drafts/wip_review-open.md: every work order to act on or review, with WIP, idle days and reason, asking production control to confirm each. Marked DRAFT. Sending goes through wip_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.items.some((i) => i.status === 'flag' || i.status === 'review')) throw new Error('no work order needs a decision'); return { id: 'open', text: wipReviewText(r, a), amount: Math.round((r.stale_wip + r.closed_wip) * 100) / 100 }; },
  },
  refused: [
    { name: 'erp_close_work_order', category: 'production_deploy', description: 'Never closes, completes or cancels a work order in the ERP.' },
    { name: 'erp_post_journal', category: 'move_money', description: 'Never posts a WIP write-off or any journal.' },
  ],
  prompt: { name: 'wip_aging_review', title: 'Review aging WIP', text: 'You are helping a cost accountant with fairmake-wip-aging. Call wip_check with the work order list and the period-end date as as_of. Lead with WIP on closed orders and stale orders, then the age buckets. Offer wip_write_report and wip_draft_wip_review. Closing work orders and posting write-offs are refused.' },
});

export const DEMO = {
  intro: 'Fairmake WIP Aging demo: ten fictional work orders aged as of 2026-11-30.',
  files: { work_orders: 'work-orders.csv', settings: 'settings.json', as_of: '2026-11-30' },
  explain: { work_order: 'WO-2004' },
  draft: { from: 'Casey Controller (fictional)' },
};
