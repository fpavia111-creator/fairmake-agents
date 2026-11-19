import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { EVENT_FIELDS, SCHEDULE_FIELDS, EVENT_PROFILES, DEFAULTS, SETTINGS_SCHEMA, machineDowntime, maintenanceRequestText } from './downtime.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  events: { type: 'string', description: 'Downtime events from an MES or machine monitoring export under --root: event, machine, start, end, reason and whether the stop was planned' },
  schedule: { type: 'string', description: 'Scheduled production hours per machine for the same period under --root' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'downtime',
  description: 'Reads machine downtime from an MES or monitoring export and works out availability, MTTR and MTBF per machine from unplanned stops: flags machines below the availability target, lists chronic stop reasons, reviews stops with no reason, no end time or overlapping, and drafts a request to maintenance. Changes no schedule or work order.',
  args, required: ['events', 'schedule'],
  sources: { events: { label: 'Downtime events', args: ['events'], fields: EVENT_FIELDS, profiles: EVENT_PROFILES }, schedule: { label: 'Scheduled hours', args: ['schedule'], fields: SCHEDULE_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => machineDowntime({ events: read('events'), schedule: read('schedule') }, s),
  line: (r) => `${r.machines} machine(s), ${r.stops} stop(s): ${r.unplanned_hours} unplanned hours of ${r.scheduled_hours} scheduled (${r.availability_pct}% available). ${r.flag} below target, ${r.review} with data to fix, ${r.watch} with chronic reasons, ${r.ok} fine.`,
  item: { key: 'machine', arg: 'machine', label: 'machine' },
  check: { title: 'Check machine downtime', description: 'Per machine: downtime and unplanned hours, availability against scheduled hours, MTTR and MTBF from unplanned stops. Flags availability below target; lists reasons that recur; reviews stops with no reason code, no end time, overlapping stops and machines with no scheduled hours. Totals by reason.' },
  report: {
    base: 'machine-downtime', title: 'Machine downtime',
    rows: (r) => r.items.map((i) => ({ machine: i.machine, scheduled_hours: i.scheduled_hours, stops: i.stops, unplanned_hours: i.unplanned_hours, availability_pct: i.availability_pct, mttr_hours: i.mttr_hours, mtbf_hours: i.mtbf_hours, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['machine', 'scheduled_hours', 'stops', 'unplanned_hours', 'availability_pct', 'mttr_hours', 'mtbf_hours', 'status', 'reasons'],
    sections: (r) => [{ title: 'By reason', rows: r.by_reason, columns: ['reason', 'planned', 'stops', 'hours'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['Availability counts unplanned stops only, against the scheduled hours you give; it is not OEE (speed and quality losses are not in a downtime file).'],
  },
  draft: {
    noun: 'maintenance_request', verb: 'send', category: 'binding_send', actor: 'the production manager',
    description: 'Write drafts/maintenance_request-open.md: machines below the availability target or with chronic stop reasons, with MTTR and MTBF, for the maintenance lead. Marked DRAFT. Sending goes through downtime_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.items.some((i) => i.findings.some((f) => ['low_availability', 'chronic_reason'].includes(f.code)))) throw new Error('no machine is below target or has a chronic stop reason'); return { id: 'open', text: maintenanceRequestText(r, a) }; },
  },
  refused: [
    { name: 'mes_change_schedule', category: 'production_deploy', description: 'Never changes the production schedule or MES settings.' },
    { name: 'cmms_create_work_order', category: 'production_deploy', description: 'Never opens or closes maintenance work orders in the CMMS; the maintenance lead does.' },
  ],
  prompt: { name: 'machine_downtime_review', title: 'Review machine downtime', text: 'You are helping a production or maintenance manager with fairmake-machine-downtime. Call downtime_check with the downtime events and scheduled hours. Lead with machines below the availability target, then chronic reasons and data to fix (no reason, no end, overlaps). Offer downtime_write_report and downtime_draft_maintenance_request.' },
});

export const DEMO = {
  intro: 'Fairmake Machine Downtime demo: one fictional week of stops on five machines.',
  files: { events: 'events.csv', schedule: 'schedule.csv', settings: 'settings.json' },
  explain: { machine: 'CNC-2' },
  draft: { from: 'Morgan Plant Manager (fictional)' },
};
