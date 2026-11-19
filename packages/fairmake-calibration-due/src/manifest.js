import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { GAUGE_FIELDS, USAGE_FIELDS, GAUGE_PROFILES, DEFAULTS, SETTINGS_SCHEMA, calibrationStatus, suspectNoticeText } from './calibration.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  gauges: { type: 'string', description: 'Gauge or instrument register under --root: id, last calibration, interval in days, last result and status' },
  usage: { type: 'string', description: 'Optional gauge use log under --root: gauge, work order or lot, and date used' },
  as_of: { type: 'string', format: 'date', description: 'Date to measure from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'calibration',
  description: 'Checks every gauge and instrument against its calibration interval: flags overdue gauges, lists those due soon, reviews gauges never calibrated or with no interval, and, from a use log, names the work orders measured with a gauge that was overdue or had failed calibration. Writes a due-date calendar and drafts a suspect-product note for quality. Releases no hold and tells no customer.',
  args, required: ['gauges'],
  sources: { gauges: { label: 'Gauge register', args: ['gauges'], fields: GAUGE_FIELDS, profiles: GAUGE_PROFILES }, usage: { label: 'Gauge use log', args: ['usage'], fields: USAGE_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => calibrationStatus({ gauges: read('gauges'), usage: read('usage') }, s, a.as_of),
  line: (r) => `${r.gauges} gauge(s) as of ${r.as_of}: ${r.overdue} overdue, ${r.suspect_work_orders} measurement(s) with a suspect gauge, ${r.review} to review, ${r.watch} due soon, ${r.ok} in calibration.`,
  item: { key: 'gauge', arg: 'gauge', label: 'gauge' },
  check: { title: 'Check calibration due dates', description: 'Work out each gauge\'s next calibration date from the last one and its interval. Flags overdue gauges, gauges used after a failed calibration and gauges used past their due date (naming the work orders); lists gauges due soon; reviews gauges never calibrated or with no interval. Out-of-service gauges are not chased for dates.' },
  report: {
    base: 'calibration-due', title: (r) => `Calibration due dates as of ${r.as_of}`,
    rows: (r) => r.items.map((i) => ({ gauge: i.gauge, description: i.description, location: i.location, last_cal: i.last_cal, cal_result: i.cal_result, due_date: i.due_date, days: i.days_to_due, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['gauge', 'description', 'location', 'last_cal', 'due_date', 'days', 'status', 'reasons'],
    sections: (r) => [{ title: 'Suspect work orders', rows: r.suspect, columns: ['gauge', 'work_order', 'used_date', 'why'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['Whether product measured with a suspect gauge must be re-inspected or reported is a quality decision; the agent only lists it.'],
    ics: (r) => ({ calName: 'Calibration due', events: r.items.filter((i) => i.due_date && !/out of service|retired|scrapped|lost|inactive/i.test(i.gauge_status)).map((i) => ({ uid: `cal-${i.gauge}-${i.due_date}@fairmake`, date: i.due_date < r.as_of ? r.as_of : i.due_date, summary: `Calibration ${i.due_date < r.as_of ? 'overdue' : 'due'}: ${i.gauge} ${i.description}`.trim(), description: `Written by fairmake-calibration-due. Due ${i.due_date}.`, reminders: [7] })) }),
  },
  draft: {
    noun: 'suspect_product_notice', verb: 'send', category: 'binding_send', actor: 'the quality manager',
    description: 'Write drafts/suspect_product_notice-open.md: every work order measured with a gauge that had failed calibration or was overdue, for the quality manager to decide on re-inspection. Marked DRAFT. Sending goes through calibration_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.suspect.length) throw new Error('no measurement was made with a suspect gauge'); return { id: 'open', text: suspectNoticeText(r, a) }; },
  },
  refused: [
    { name: 'qms_release_hold', category: 'production_deploy', description: 'Never places or releases a quality hold in the QMS or ERP.' },
    { name: 'customer_notice_send', category: 'binding_send', description: 'Never notifies a customer about suspect product.' },
  ],
  prompt: { name: 'calibration_review', title: 'Review calibration due dates', text: 'You are helping a quality manager with fairmake-calibration-due. Call calibration_check with the gauge register and, if available, the gauge use log. Lead with suspect work orders (gauges used after a failed calibration or while overdue), then overdue gauges. Offer calibration_write_report (with a calendar) and calibration_draft_suspect_product_notice.' },
});

export const DEMO = {
  intro: 'Fairmake Calibration Due demo: nine fictional gauges and a month of gauge use, as of 2026-11-18.',
  files: { gauges: 'gauges.csv', usage: 'usage.csv', settings: 'settings.json', as_of: '2026-11-18' },
  explain: { gauge: 'MIC-002' },
  draft: { from: 'Quinn Quality (fictional)' },
};
