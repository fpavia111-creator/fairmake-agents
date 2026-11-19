import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { CASE_FIELDS, CASE_PROFILES, DEFAULTS, SETTINGS_SCHEMA, oshaLog, correctionListText } from './osha.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = { cases: { type: 'string', description: 'Injury and illness case log under --root: case number, employee, job title, dates, location, description, injury type, outcome, days away and restricted, privacy case, recordable, return date' } };

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'osha_log',
  description: 'Checks the completeness of an injury and illness case log (the data an OSHA 300 log is built from): missing fields, outcomes that do not match the day counts, day counts over the cap, privacy cases with a name entered, open cases, late entries and first-aid cases marked recordable. Counts cases and days, and rates per 200,000 hours when hours are given. Employee names and job titles are masked in results. It does not decide recordability and files nothing.',
  args, required: ['cases'],
  sources: { cases: { label: 'Injury and illness cases', args: ['cases'], fields: CASE_FIELDS, profiles: CASE_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => oshaLog(read('cases'), s),
  line: (r) => `${r.cases} case(s), ${r.recordable} marked recordable, ${r.dart_cases} with days away or restriction (${r.days_away} days away, ${r.days_restricted} restricted)${r.trir !== null ? `, TRIR ${r.trir}, DART ${r.dart_rate}` : ''}: ${r.flag} to correct, ${r.review} to complete, ${r.watch} still open, ${r.ok} complete.${r.return_dates_found ? '' : ' The file has no return-to-work dates, so open cases are not listed.'}`,
  item: { key: 'case_number', arg: 'case_number', label: 'case' },
  check: { title: 'Check the injury and illness log', description: 'For each case: flags day counts that contradict the outcome and privacy cases with a name entered; reviews missing fields on recordable cases, missing day counts, counts over the cap, late entries and first-aid cases marked recordable; lists cases with days still running. Counts cases and days by outcome; rates per 200,000 hours if annual hours are set. Names and job titles are masked in results.' },
  report: {
    base: 'osha-300-log', title: 'Injury and illness log completeness',
    rows: (r) => r.items.map((i) => ({ case_number: i.case_number, employee: i.employee, job_title: i.job_title, incident_date: i.incident_date, outcome: i.outcome, days_away: i.days_away, days_restricted: i.days_restricted, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['case_number', 'job_title', 'incident_date', 'outcome', 'days_away', 'days_restricted', 'status', 'reasons'],
    sections: (r) => [{ title: 'By outcome', rows: r.by_outcome, columns: ['outcome', 'cases'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['This checks data completeness only. It does not decide whether a case is recordable, is not legal or safety advice, and files nothing with any agency.', 'The report file keeps employee names for the safety coordinator; the HTML page leaves them out. Keep the CSV in a private folder.'],
  },
  draft: {
    noun: 'log_correction_list', verb: 'send', category: 'binding_send', actor: 'the safety coordinator',
    description: 'Write drafts/log_correction_list-open.md: every case needing a correction, by case number, for the safety coordinator. Marked DRAFT. Sending goes through osha_log_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review + r.watch === 0) throw new Error('every case is complete'); return { id: 'open', text: correctionListText(r, a) }; },
  },
  refused: [
    { name: 'osha_ita_submit', category: 'binding_send', description: 'Never submits injury and illness data to any agency or portal.' },
    { name: 'hr_record_update', category: 'production_deploy', description: 'Never changes HR, EHS or case records.' },
  ],
  prompt: { name: 'injury_log_review', title: 'Check the injury and illness log', text: 'You are helping a safety coordinator with fairmake-osha-300-log. Call osha_log_check on the case log. Lead with privacy cases that show a name and day counts that contradict the outcome, then missing fields. Talk about cases by number; names and job titles are masked. Never say whether a case is recordable: that is the coordinator\'s decision. Offer osha_log_write_report and osha_log_draft_log_correction_list.' },
});

export const DEMO = {
  intro: 'Fairmake OSHA 300 Log demo: eight fictional cases at a fictional plant; every name is made up.',
  files: { cases: 'cases.csv', settings: 'settings.json' },
  explain: { case_number: '2026-004' },
  draft: { from: 'Casey Safety (fictional)' },
};
