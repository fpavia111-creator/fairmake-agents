// Injury and illness log completeness (the data an OSHA 300 log is built from): missing fields, outcomes that do
// not match the day counts, day counts over the cap, privacy cases with a name, open cases, late entries.
// It checks the data only; whether a case is recordable is a person's decision.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, groupBy, daysBetween, yes } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const CASE_FIELDS = Object.freeze({
  // Case numbers restart at 1 in each establishment: with several establishments in one file, cases are told apart by it.
  establishment: t(['Establishment ID', 'Establishment', 'Establishment Name', 'Site', 'Plant', 'Facility']),
  case_number: t(['Case Number', 'Case No.', 'Case', 'Incident ID'], { required: true }),
  employee: t(['Employee', 'Employee Name', 'Name'], { personal: true }),
  // Masked too: a job title with an incident date and outcome can point to one person in a small plant.
  job_title: t(['Job Title', 'Position', 'Job', 'Job Description'], { personal: true }),
  incident_date: t(['Incident Date', 'Date of Injury', 'Date of Injury or Illness', 'Date of Incident', 'Date'], { type: 'date' }),
  entered_date: t(['Entered Date', 'Date Recorded', 'Logged On', 'Created'], { type: 'date' }),
  location: t(['Location', 'Where', 'Where the Event Occurred', 'Area', 'Incident Location', 'NEW_INCIDENT_LOCATION']),
  description: t(['Description', 'Injury Description', 'What Happened', 'Incident Description', 'NEW_INCIDENT_DESCRIPTION', 'NAR What Happened']),
  injury_type: t(['Injury Type', 'Type', 'Illness Type', 'Case Type', 'Type of Incident']),
  // OSHA's ITA case data codes the outcome 1 death, 2 days away, 3 job transfer or restriction, 4 other recordable.
  outcome: t(['Outcome', 'Classification', 'Most Serious Outcome', 'Result', 'Incident Outcome']),
  days_away: t(['Days Away', 'Days Away From Work', 'Lost Days', 'DAFW Num Away'], { type: 'number' }),
  days_restricted: t(['Days Restricted', 'Days on Job Transfer or Restriction', 'Restricted Days', 'DJTR Num TR'], { type: 'number' }),
  privacy_case: t(['Privacy Case', 'Privacy']),
  recordable: t(['Recordable', 'OSHA Recordable', 'Is Recordable']),
  return_date: t(['Return Date', 'Returned to Work', 'Back to Work'], { type: 'date' }),
});
/** Generic EHS incident log (written from knowledge of such exports), and OSHA's published ITA case detail CSV (tested on the 2024 public file). */
export const CASE_PROFILES = Object.freeze([
  exportProfile('ehs_incident_log', { case_number: 'Case Number', employee: 'Employee Name', job_title: 'Job Title', incident_date: 'Date of Injury', location: 'Where', description: 'Description', injury_type: 'Injury Type', outcome: 'Outcome', days_away: 'Days Away', days_restricted: 'Days Restricted', privacy_case: 'Privacy Case', recordable: 'Recordable' }, { note: 'EHS incident log: one row per case.' }),
  exportProfile('osha_ita_case_detail', { establishment: 'establishment_id', case_number: 'case_number', job_title: 'job_description', incident_date: 'date_of_incident', location: 'NEW_INCIDENT_LOCATION', description: 'NEW_INCIDENT_DESCRIPTION', injury_type: 'type_of_incident', outcome: 'incident_outcome', days_away: 'dafw_num_away', days_restricted: 'djtr_num_tr' }, { note: 'OSHA Injury Tracking Application case detail data (Forms 300 and 301) as OSHA publishes it: outcomes coded 1 to 4, dates like 16JAN2024, no names and no return dates.' }),
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
const ITA_OUTCOMES = { 1: 'death', 2: 'days_away', 3: 'restricted', 4: 'other_recordable' };
const outcomeOf = (v) => { const s = str(v).toLowerCase(); return /^[1-4]$/.test(s) ? ITA_OUTCOMES[s] : /death|fatal/.test(s) ? 'death' : /away|lost/.test(s) ? 'days_away' : /restrict|transfer/.test(s) ? 'restricted' : /first aid/.test(s) ? 'first_aid' : /other|recordable/.test(s) ? 'other_recordable' : s ? 'unknown' : ''; };

/** Check every case. Finding codes: missing_field, outcome_days_mismatch, days_missing, days_over_cap, privacy_name_on_log, open_case, late_entry, first_aid_recordable, duplicate_case_number. */
export function oshaLog(rows, s = DEFAULTS) {
  // A file with no return-to-work dates at all (OSHA's published data, many EHS exports) cannot say which cases are still open.
  const returnDates = rows.some((r) => str(r.return_date));
  const caseOf = (r) => (str(r.establishment) ? `${str(r.establishment)} #${str(r.case_number)}` : str(r.case_number));
  // Case numbers are compared exactly as written (trimmed): OSHA's 2024 data has "ALL-2024-1" and "All-2024-1" as two cases.
  const items = [...groupBy(rows.filter((r) => str(r.case_number)), (r) => caseOf(r)).values()].map((ls) => {
    const r = ls[0]; const o = outcomeOf(r.outcome); const rec = r.recordable === null || r.recordable === undefined || str(r.recordable) === '' ? o !== 'first_aid' : yes(r.recordable);
    const away = Number(r.days_away) || 0, rest = Number(r.days_restricted) || 0; const f = [];
    const differs = ls.some((x) => str(x.incident_date) !== str(r.incident_date) || str(x.employee) !== str(r.employee) || str(x.job_title) !== str(r.job_title));
    if (differs) f.push(finding('duplicate_case_number', null, `Case number ${caseOf(r)} is used for ${ls.length} rows with different dates or people; each case needs its own number (or, for several establishments in one file, an establishment column). Only the first row was checked.`, 'review'));
    if (rec) { const miss = ['job_title', 'incident_date', 'location', 'description', 'injury_type', 'outcome'].filter((k) => !str(r[k])); if (miss.length) f.push(finding('missing_field', null, `Case ${caseOf(r)} is missing ${miss.join(', ')}.`, 'review')); }
    if (o && o !== 'days_away' && o !== 'death' && away > 0) f.push(finding('outcome_days_mismatch', null, `Case ${caseOf(r)} shows ${away} days away but its outcome is "${str(r.outcome)}".`));
    // On the 300 log a case with restricted or transfer days belongs in the restriction column, not "other recordable".
    else if (o === 'other_recordable' && rest > 0) f.push(finding('outcome_days_mismatch', null, `Case ${caseOf(r)} shows ${rest} days of restriction or transfer but its outcome is "${str(r.outcome)}".`));
    if (o === 'restricted' && rest === 0 && !r.return_date) f.push(finding('days_missing', null, `Case ${caseOf(r)} is a restriction case with no restricted days entered.`, 'review'));
    if (o === 'days_away' && away === 0) f.push(finding('days_missing', null, `Case ${caseOf(r)} is a days-away case with no days entered.`, 'review'));
    // Counting may stop at the cap (180 days on the OSHA log) but is not required to: worth knowing, not an error.
    if (away + rest > s.day_cap) f.push(finding('days_over_cap', null, `Case ${caseOf(r)} counts ${away + rest} days; counting may stop at ${s.day_cap}, and the totals here count it at ${s.day_cap}.`, 'watch'));
    if (yes(r.privacy_case) && str(r.employee) && !/privacy/i.test(str(r.employee))) f.push(finding('privacy_name_on_log', null, `Case ${caseOf(r)} is marked as a privacy case but a name is entered; the name column should say privacy case.`));
    if (returnDates && (o === 'days_away' || o === 'restricted') && !r.return_date) f.push(finding('open_case', null, `Case ${caseOf(r)} has no return-to-work date; keep counting days.`, 'watch'));
    if (r.entered_date && r.incident_date && daysBetween(r.incident_date, r.entered_date) > s.entry_days) f.push(finding('late_entry', null, `Case ${caseOf(r)} was entered ${daysBetween(r.incident_date, r.entered_date)} days after it happened.`, 'review'));
    if (o === 'first_aid' && yes(r.recordable)) f.push(finding('first_aid_recordable', null, `Case ${caseOf(r)} is marked recordable with a first-aid outcome; check the classification.`, 'review'));
    return { case_number: caseOf(r), employee: str(r.employee), job_title: str(r.job_title), incident_date: r.incident_date || null, outcome: o || 'blank', recordable: rec, days_away: away, days_restricted: rest, status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.case_number) < itemKey(b.case_number) ? -1 : 1));
  const recs = items.filter((i) => i.recordable); const dart = recs.filter((i) => i.days_away > 0 || i.days_restricted > 0 || i.outcome === 'days_away' || i.outcome === 'restricted').length;
  const hours = Number(s.annual_hours) || 0;
  return {
    cases: items.length, return_dates_found: returnDates, recordable: recs.length, dart_cases: dart, days_away: items.reduce((x, i) => x + Math.min(i.days_away, s.day_cap), 0), days_restricted: items.reduce((x, i) => x + Math.min(i.days_restricted, s.day_cap), 0),
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
