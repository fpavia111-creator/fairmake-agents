import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { HOURS_FIELDS, RATE_FIELDS, ACTUAL_FIELDS, HOURS_PROFILES, DEFAULTS, SETTINGS_SCHEMA, absorption, rateText } from './absorption.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  hours: { type: 'string', description: 'Hours worked on jobs by work center under --root (labor or machine hours, one or many rows per work center)' },
  rates: { type: 'string', description: 'Overhead rates under --root: work center, rate per hour and optional budget hours' },
  actuals: { type: 'string', description: 'Actual overhead spend by work center (or cost center) under --root' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'absorption',
  description: 'Compares overhead applied to jobs (hours times the overhead rate) with overhead actually spent, work center by work center; flags under-absorption, lists over-absorption, volume shortfalls and work centers with hours but no rate, proposes rates and drafts a rate change for the controller. Posts nothing.',
  args, required: ['hours', 'rates', 'actuals'],
  sources: { hours: { label: 'Hours by work center', args: ['hours'], fields: HOURS_FIELDS, profiles: HOURS_PROFILES }, rates: { label: 'Overhead rates', args: ['rates'], fields: RATE_FIELDS }, actuals: { label: 'Actual overhead', args: ['actuals'], fields: ACTUAL_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => absorption({ hours: read('hours'), rates: read('rates'), actuals: read('actuals') }, s),
  line: (r) => `${r.work_centers} work center(s): ${r.applied} applied against ${r.actual} spent (net ${r.net_under_absorbed} under-absorbed). ${r.flag} under-absorbed past tolerance, ${r.review} to review, ${r.watch} to watch, ${r.ok} in line.`,
  item: { key: 'work_center', arg: 'work_center', label: 'work center' },
  check: { title: 'Check overhead absorption', description: 'For each work center, multiply the hours worked on jobs by the overhead rate and compare with the overhead actually spent. Flags under-absorption past the tolerance, lists over-absorption and hours well below budget, and reviews work centers with hours but no rate or no actual spend. Proposes a rate from actual spend and hours.' },
  report: {
    base: 'overhead-absorption', title: 'Overhead absorption',
    rows: (r) => r.items.map((i) => ({ work_center: i.work_center, hours: i.hours, budget_hours: i.budget_hours, rate: i.rate, applied: i.applied, actual: i.actual, under_absorbed: i.under_absorbed, proposed_rate: i.proposed_rate, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['work_center', 'hours', 'rate', 'applied', 'actual', 'under_absorbed', 'proposed_rate', 'status', 'reasons'],
    sections: (r) => [{ title: 'Proposed rates', rows: r.proposed_rates, columns: ['work_center', 'rate', 'proposed_rate', 'hours'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Applied overhead is hours times your rate; it does not read the overhead your ERP actually applied, so compare with your own absorption account.'],
  },
  draft: {
    noun: 'rate_change', verb: 'apply', category: 'production_deploy', actor: 'the controller',
    description: 'Write drafts/rate_change-proposal.md: the proposed overhead rate for every work center under- or over-absorbed past the tolerance. Marked DRAFT. Approving goes through absorption_request_apply (one click); the controller changes rates in the ERP.',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.proposed_rates.length) throw new Error('no work center is under- or over-absorbed past the tolerance'); return { id: 'proposal', text: rateText(r, a) }; },
  },
  refused: [
    { name: 'erp_post_journal', category: 'move_money', description: 'Never posts the under- or over-absorption journal.' },
    { name: 'erp_update_overhead_rates', category: 'production_deploy', description: 'Never changes overhead or burden rates in the ERP.' },
  ],
  prompt: { name: 'overhead_absorption_review', title: 'Review overhead absorption', text: 'You are helping a controller review overhead absorption with fairmake-overhead-absorption. Call absorption_check with hours, rates and actual overhead. Lead with under-absorbed work centers (jobs under-costed), then volume shortfalls and missing rates. Offer absorption_write_report and absorption_draft_rate_change; changing rates and posting journals are refused.' },
});

export const DEMO = {
  intro: 'Fairmake Overhead Absorption demo: six fictional work centers over October and November 2026.',
  files: { hours: 'hours.csv', rates: 'rates.csv', actuals: 'actuals.csv', settings: 'settings.json' },
  explain: { work_center: 'CNC' },
  draft: { from: 'Casey Controller (fictional)' },
};
