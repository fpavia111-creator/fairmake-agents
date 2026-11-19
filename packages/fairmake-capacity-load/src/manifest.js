import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { OP_FIELDS, CAL_FIELDS, OP_PROFILES, DEFAULTS, SETTINGS_SCHEMA, capacityLoad, capacityReviewText } from './capacity.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  operations: { type: 'string', description: 'Open work order operations under --root: work order, operation, work center, due date and hours remaining' },
  calendar: { type: 'string', description: 'Work center calendar under --root: hours per day, days per week and efficiency %' },
  as_of: { type: 'string', format: 'date', description: 'Start of the horizon, YYYY-MM-DD (default today); loading starts on the Monday of that week' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'capacity',
  description: 'Loads open operation hours by work center and week (by due date) against each work center\'s available hours: flags overloaded weeks, lists weeks near capacity, reviews past-due load and work centers with no calendar, and drafts a capacity review for the planner. Reschedules nothing and changes no promise date.',
  args, required: ['operations', 'calendar'],
  sources: { operations: { label: 'Open operations', args: ['operations'], fields: OP_FIELDS, profiles: OP_PROFILES }, calendar: { label: 'Work center calendar', args: ['calendar'], fields: CAL_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => capacityLoad({ operations: read('operations'), calendar: read('calendar') }, s, a.as_of),
  line: (r) => `${r.work_centers} work center(s), ${r.open_hours} open hours, ${r.horizon}: ${r.flag} overloaded, ${r.review} to review, ${r.watch} near capacity, ${r.ok} with room.`,
  item: { key: 'work_center', arg: 'work_center', label: 'work center' },
  check: { title: 'Check capacity load', description: 'Put each open operation\'s remaining hours in the week of its due date (past-due ones in the first week) and compare each week with the work center\'s available hours (hours per day times days per week times efficiency). Flags overloaded weeks, lists weeks near capacity, reviews past-due load and work centers with no calendar.' },
  report: {
    base: 'capacity-load', title: 'Capacity load against available hours',
    rows: (r) => r.items.map((i) => ({ work_center: i.work_center, available_per_week: i.available_per_week, open_hours: i.open_hours, past_due_hours: i.past_due_hours, beyond_horizon_hours: i.beyond_horizon_hours, peak_load_pct: i.peak_load_pct, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['work_center', 'available_per_week', 'open_hours', 'past_due_hours', 'peak_load_pct', 'status', 'reasons'],
    sections: (r) => [{ title: 'By week', rows: r.by_week, columns: ['work_center', 'week', 'load', 'available', 'load_pct'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['Load is placed by due date only (infinite loading, no sequencing or setup grouping); holidays are not in the calendar file.'],
  },
  draft: {
    noun: 'capacity_review', verb: 'send', category: 'binding_send', actor: 'the operations manager',
    description: 'Write drafts/capacity_review-open.md: the overloaded and near-capacity work centers with their weeks, for the production planner to decide on overtime, shifts or new dates. Marked DRAFT. Sending goes through capacity_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review + r.watch === 0) throw new Error('every work center has room in the horizon'); return { id: 'open', text: capacityReviewText(r, a) }; },
  },
  refused: [
    { name: 'erp_reschedule_orders', category: 'production_deploy', description: 'Never reschedules work orders or operations in the ERP.' },
    { name: 'customer_promise_send', category: 'binding_send', description: 'Never sends new promise dates to customers.' },
  ],
  prompt: { name: 'capacity_review', title: 'Review capacity load', text: 'You are helping a production planner with fairmake-capacity-load. Call capacity_check with open operations and the work center calendar, as_of the planning date. Lead with overloaded weeks by work center, then past-due load. Offer capacity_write_report and capacity_draft_capacity_review. Rescheduling and customer dates are a person\'s decision.' },
});

export const DEMO = {
  intro: 'Fairmake Capacity Load demo: fictional open operations on five work centers, six weeks from 2026-11-16.',
  files: { operations: 'operations.csv', calendar: 'calendar.csv', settings: 'settings.json', as_of: '2026-11-16' },
  explain: { work_center: 'CNC' },
  draft: { from: 'Pat Planner (fictional)' },
};
