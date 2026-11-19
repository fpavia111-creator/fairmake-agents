// Injury and illness log completeness (the data an OSHA 300 log is built from): missing fields, outcomes that do
// not match the day counts, day counts over the cap, privacy cases with a name, open cases, late entries.
// It checks the data only; whether a case is recordable is a person's decision.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, groupBy, daysBetween, yes } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const CASE_FIELDS = Object.freeze({
  case_number: t(['Case Number', 'Case No.', 'Case', 'Incident ID'], { required: true }),
  employee: t(['Employee', 'Employee Name', 'Name'], { personal: true }),
  // Masked too: a job title with an incident date and outcome can point to one person in a small plant.
  job_title: t(['Job Title', 'Position', 'Job'], { personal: true }),
  incident_date: t(['Incident Date', 'Date of Injury', 'Date of Injury or Illness', 'Date'], { type: 'date' }),
  entered_date: t(['Entered Date', 'Date Recorded', 'Logged On', 'Created'], { type: 'date' }),
  location: t(['Location', 'Where', 'Where the Event Occurred', 'Area']),
  description: t(['Description', 'Injury Description', 'What Happened']),
  injury_type: t(['Injury Type', 'Type', 'Illness Type', 'Case Type']),
  outcome: t(['Outcome', 'Classification', 'Most Serious Outcome', 'Result']),
  days_away: t(['Days Away', 'Days Away From Work', 'Lost Days'], { type: 'number' }),
  days_restricted: t(['Days Restricted', 'Days on Job Transfer or Restriction', 'Restricted Days'], { type: 'number' }),
  privacy_case: t(['Privacy Case', 'Privacy']),
  recordable: t(['Recordable', 'OSHA Recordable', 'Is Recordable']),
  return_date: t(['Return Date', 'Returned to Work', 'Back to Work'], { type: 'date' }),
});
/** Generic EHS incident log. Written from knowledge of such exports; not checked against a live system. */
export const CASE_PROFILES = Object.freeze([
  exportProfile('ehs_incident_log', { case_number: 'Case Number', employee: 'Employee Name', job_title: 'Job Title', incident_date: 'Date of Injury', location: 'Where', description: 'Description', injury_type: 'Injury Type', outcome: 'Outcome', days_away: 'Days Away', days_restricted: 'Days Restricted', privacy_case: 'Privacy Case', recordable: 'Recordable' }, { note: 'EHS incident log: one row per case.' }),
]);

export const DEFAULTS = Object.freeze({ day_cap: 180, entry_days: 7, annual_hours: null });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    day_cap: { type: 'integer', minimum: 1, maximum: 3650, description: 'Most days away plus restricted to count for one case (the cap your log uses)' },
    entry_days: { type: 'integer', minimum: 1, maximum: 365, description: 'A case entered more than this many days after it happened is listed as a late entry' },
    annual_hours: { type: ['number', 'null'], minimum: 0, description: 'Hours worked by all employees in the year, to compute rates per 200,000 hours (leave out to skip rates)' },
  },
});
const outcomeOf = (v) => { const s = str(v).toLowerCase(); return /death|fatal/.test(s) ? 'death' : /away|lost/.test(s) ? 'days_away' : /restrict|transfer/.test(s) ? 'restricted' : /first aid/.test(s) ? 'first_aid' : /other|recordable/.test(s) ? 'other_recordable' : s ? 'unknown' : ''; };

/** Check every case. Finding codes: missing_field, outcome_days_mismatch, days_missing, days_over_cap, privacy_name_on_log, open_case, late_entry, first_aid_recordable. */
export function oshaLog(rows, s = DEFAULTS) {
  const items = [...groupBy(rows.filter((r) => str(r.case_number)), (r) => itemKey(r.case_number)).values()].map((ls) => {
    const r = ls[0]; const o = outcomeOf(r.outcome); const rec = r.recordable === null || r.recordable === undefined || str(r.recordable) === '' ? o !== 'first_aid' : yes(r.recordable);
    const away = Number(r.days_away) || 0, rest = Number(r.days_restricted) || 0; const f = [];
    if (rec) { const miss = ['job_title', 'incident_date', 'location', 'description', 'injury_type', 'outcome'].filter((k) => !str(r[k])); if (miss.length) f.push(finding('missing_field', null, `Case ${r.case_number} is missing ${miss.join(', ')}.`, 'review')); }
    if (o && o !== 'days_away' && o !== 'death' && away > 0) f.push(finding('outcome_days_mismatch', null, `Case ${r.case_number} shows ${away} days away but its outcome is "${str(r.outcome)}".`));
    if (o === 'restricted' && rest === 0 && !r.return_date) f.push(finding('days_missing', null, `Case ${r.case_number} is a restriction case with no restricted days entered.`, 'review'));
    if (o === 'days_away' && away === 0) f.push(finding('days_missing', null, `Case ${r.case_number} is a days-away case with no days entered.`, 'review'));
    if (away + rest > s.day_cap) f.push(finding('days_over_cap', null, `Case ${r.case_number} counts ${away + rest} days; the log caps the count at ${s.day_cap}.`, 'review'));
    if (yes(r.privacy_case) && str(r.employee) && !/privacy/i.test(str(r.employee))) f.push(finding('privacy_name_on_log', null, `Case ${r.case_number} is marked as a privacy case but a name is entered; the name column should say privacy case.`));
    if ((o === 'days_away' || o === 'restricted') && !r.return_date) f.push(finding('open_case', null, `Case ${r.case_number} has no return-to-work date; keep counting days.`, 'watch'));
    if (r.entered_date && r.incident_date && daysBetween(r.incident_date, r.entered_date) > s.entry_days) f.push(finding('late_entry', null, `Case ${r.case_number} was entered ${daysBetween(r.incident_date, r.entered_date)} days after it happened.`, 'review'));
    if (o === 'first_aid' && yes(r.recordable)) f.push(finding('first_aid_recordable', null, `Case ${r.case_number} is marked recordable with a first-aid outcome; check the classification.`, 'review'));
    return { case_number: str(r.case_number), employee: str(r.employee), job_title: str(r.job_title), incident_date: r.incident_date || null, outcome: o || 'blank', recordable: rec, days_away: away, days_restricted: rest, status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.case_number) < itemKey(b.case_number) ? -1 : 1));
  const recs = items.filter((i) => i.recordable); const dart = recs.filter((i) => i.days_away > 0 || i.days_restricted > 0 || i.outcome === 'days_away' || i.outcome === 'restricted').length;
  const hours = Number(s.annual_hours) || 0;
  return {
    cases: items.length, recordable: recs.length, dart_cases: dart, days_away: items.reduce((x, i) => x + Math.min(i.days_away, s.day_cap), 0), days_restricted: items.reduce((x, i) => x + Math.min(i.days_restricted, s.day_cap), 0),
    trir: hours ? round2((recs.length * 200000) / hours) : null, dart_rate: hours ? round2((dart * 200000) / hours) : null,
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_outcome: Object.entries(countBy(items, 'outcome')).map(([outcome, cases]) => ({ outcome, cases })), by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function correctionListText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status !== 'ok');
  return ['# Injury and illness log: entries to correct', '', '**To:** [TO CONFIRM safety coordinator]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `${rows.length} case(s) need a correction or a look. This list checks the data only; whether a case is recordable, and anything filed with an agency, is decided by the safety coordinator.`, '',
    '| Case | Detail |', '| --- | --- |', ...rows.map((i) => `| ${i.case_number} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
