import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { SCHEDULE_FIELDS, COMPLETION_FIELDS, SCHEDULE_PROFILES, DEFAULTS, SETTINGS_SCHEMA, pmStatus, pmWorkOrderText } from './pm.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  schedule: { type: 'string', description: 'PM schedule export under --root: task, asset, interval in days or run hours, last done, hours since and whether it is safety critical' },
  completions: { type: 'string', description: 'Optional completion log under --root: task and date done (the latest date counts)' },
  as_of: { type: 'string', format: 'date', description: 'Date to measure from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'pm',
  description: 'Checks every preventive maintenance task against its interval in days and run hours: flags overdue tasks (safety-critical ones first), lists tasks due soon, reviews tasks never done or with no interval, writes a due-date calendar and drafts the list for the maintenance lead. Opens or closes nothing in the CMMS.',
  args, required: ['schedule'],
  sources: { schedule: { label: 'PM schedule', args: ['schedule'], fields: SCHEDULE_FIELDS, profiles: SCHEDULE_PROFILES }, completions: { label: 'PM completions', args: ['completions'], fields: COMPLETION_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => pmStatus({ schedule: read('schedule'), completions: read('completions') }, s, a.as_of),
  line: (r) => `${r.tasks} PM task(s) on ${r.assets} asset(s) as of ${r.as_of}: ${r.overdue} overdue (${r.critical_overdue} safety critical), ${r.review} to review, ${r.watch} due soon, ${r.ok} on schedule.`,
  item: { key: 'task', arg: 'task', label: 'PM task' },
  check: { title: 'Check preventive maintenance', description: 'For each PM task, work out the next due date from the last completion and the interval in days, and compare run hours since the last PM with the interval in hours. Flags overdue tasks, lists tasks due soon, reviews tasks never done or with no interval.' },
  report: {
    base: 'preventive-maintenance', title: (r) => `Preventive maintenance as of ${r.as_of}`,
    rows: (r) => r.items.map((i) => ({ task: i.task, asset: i.asset, description: i.description, critical: i.critical ? 'yes' : '', last_done: i.last_done, due_date: i.due_date, days: i.days_to_due, hours_since: i.hours_since, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['asset', 'description', 'critical', 'last_done', 'due_date', 'days', 'status', 'reasons'],
    sections: (r) => [{ title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['Due dates come from the last completion in your files and the interval; the CMMS may count calendar or working days differently.'],
    ics: (r) => ({ calName: 'Preventive maintenance due', events: r.items.filter((i) => i.due_date).map((i) => ({ uid: `pm-${i.task}-${i.due_date}@fairmake`, date: i.due_date < r.as_of ? r.as_of : i.due_date, summary: `PM ${i.due_date < r.as_of ? 'overdue' : 'due'}: ${i.asset} ${i.description || i.task}`, description: `Written by fairmake-preventive-maintenance. Due ${i.due_date}.`, reminders: [3] })) }),
  },
  draft: {
    noun: 'pm_work_orders', verb: 'send', category: 'binding_send', actor: 'the plant manager',
    description: 'Write drafts/pm_work_orders-open.md: overdue tasks (safety-critical first) and tasks to review, for the maintenance lead to schedule. Marked DRAFT. Sending goes through pm_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review === 0) throw new Error('no PM task is overdue or needs review'); return { id: 'open', text: pmWorkOrderText(r, a) }; },
  },
  refused: [
    { name: 'cmms_close_work_order', category: 'production_deploy', description: 'Never opens, closes or signs off work orders in the CMMS.' },
    { name: 'machine_release_to_production', category: 'go_live', description: 'Never releases a machine back to production; a qualified person does.' },
  ],
  prompt: { name: 'pm_review', title: 'Review preventive maintenance', text: 'You are helping a maintenance or plant manager with fairmake-preventive-maintenance. Call pm_check with the PM schedule (and completions if separate), as_of today. Lead with overdue safety-critical tasks, then other overdue tasks and meter overruns, then tasks never done. Offer pm_write_report (it writes a calendar of due dates) and pm_draft_pm_work_orders.' },
});

export const DEMO = {
  intro: 'Fairmake Preventive Maintenance demo: ten fictional PM tasks on six machines, as of 2026-11-18.',
  files: { schedule: 'pm-schedule.csv', completions: 'completions.csv', settings: 'settings.json', as_of: '2026-11-18' },
  explain: { task: 'PM-102' },
  draft: { from: 'Morgan Plant Manager (fictional)' },
};
