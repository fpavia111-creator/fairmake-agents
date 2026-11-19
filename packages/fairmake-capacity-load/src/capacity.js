// Capacity load against available hours: open operation hours by work center and week, against each work center's calendar.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, pct, str, itemKey, groupBy, weekStart, addDays, asOfDate } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const OP_FIELDS = Object.freeze({
  work_order: t(['Work Order', 'Job', 'WO', 'Production Order'], { required: true }),
  operation: t(['Operation', 'Oper Num', 'Op', 'Step']),
  work_center: t(['Work Center', 'Work Centre', 'Resource', 'Machine'], { required: true }),
  due_date: t(['Due Date', 'Op Due Date', 'Scheduled Finish', 'Need Date', 'End Date'], { type: 'date' }),
  hours_remaining: t(['Hours Remaining', 'Remaining Hours', 'Open Hours', 'Load Hours', 'Run Hours Remaining'], { type: 'number' }),
});
export const CAL_FIELDS = Object.freeze({
  work_center: t(['Work Center', 'Work Centre', 'Resource', 'Machine'], { required: true }),
  hours_per_day: t(['Hours per Day', 'Shift Hours', 'Daily Hours'], { type: 'number' }),
  days_per_week: t(['Days per Week', 'Working Days', 'Days'], { type: 'number' }),
  efficiency_pct: t(['Efficiency %', 'Efficiency', 'Utilization %'], { type: 'number' }),
});
/** Infor CloudSuite Industrial job operations. Written from knowledge of the export; not checked against a live system. */
export const OP_PROFILES = Object.freeze([
  exportProfile('infor_csi_job_operations', { work_order: 'Job', operation: 'Oper Num', work_center: 'Work Center', due_date: 'Op Due Date', hours_remaining: 'Hours Remaining' }, { note: 'Infor CloudSuite Industrial job operations: remaining hours per operation.' }),
]);

export const DEFAULTS = Object.freeze({ weeks: 6, overload_pct: 100, watch_pct: 90 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    weeks: { type: 'integer', minimum: 1, maximum: 52, description: 'Weeks ahead to load, starting with the week of as_of' },
    overload_pct: { type: 'number', minimum: 1, maximum: 1000, description: 'A week loaded above this percentage of available hours is overloaded' },
    watch_pct: { type: 'number', minimum: 1, maximum: 1000, description: 'A week above this percentage is listed to watch' },
  },
});

/** Load by work center and week. Finding codes: overloaded_week, near_capacity, past_due_load, no_calendar. */
export function capacityLoad({ operations, calendar }, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf); const first = weekStart(today);
  const weeks = Array.from({ length: s.weeks }, (_, i) => addDays(first, i * 7)); const last = addDays(first, s.weeks * 7 - 1);
  const CAL = new Map(calendar.filter((c) => str(c.work_center)).map((c) => [itemKey(c.work_center), c]));
  const O = groupBy(operations.filter((o) => str(o.work_center) && str(o.work_order)), (o) => itemKey(o.work_center));
  const grid = [];
  const items = [...new Set([...O.keys(), ...CAL.keys()])].sort().map((k) => {
    const ops = O.get(k) || []; const cal = CAL.get(k); const name = str((ops[0] || cal).work_center);
    const avail = cal ? round2((Number(cal.hours_per_day) || 0) * (Number(cal.days_per_week) || 0) * ((cal.efficiency_pct ?? 100) / 100)) : null;
    const pastDue = ops.filter((o) => o.due_date && o.due_date < first); const pastHrs = round2(pastDue.reduce((x, o) => x + (Number(o.hours_remaining) || 0), 0));
    const load = new Map(weeks.map((w) => [w, 0]));
    for (const o of ops) { const w = !o.due_date || o.due_date < first ? first : weekStart(o.due_date); if (load.has(w)) load.set(w, load.get(w) + (Number(o.hours_remaining) || 0)); }
    const rows = weeks.map((w) => ({ work_center: name, week: w, load: round2(load.get(w)), available: avail, load_pct: avail ? pct(load.get(w), avail) : null }));
    grid.push(...rows);
    const f = [];
    if (!cal || !avail) f.push(finding('no_calendar', null, `${name} has ${round2(ops.reduce((x, o) => x + (Number(o.hours_remaining) || 0), 0))} open hours and no working calendar, so its load cannot be compared.`, 'review'));
    const over = rows.filter((r) => r.load_pct !== null && r.load_pct > s.overload_pct); const near = rows.filter((r) => r.load_pct !== null && r.load_pct > s.watch_pct && r.load_pct <= s.overload_pct);
    if (over.length) f.push(finding('overloaded_week', null, `${name} is loaded past ${s.overload_pct}% in ${over.length} week(s): ${over.map((r) => `${r.week} ${r.load}/${r.available} h (${r.load_pct}%)`).join(', ')}.`));
    if (near.length) f.push(finding('near_capacity', null, `${name} is near capacity in ${near.map((r) => `${r.week} (${r.load_pct}%)`).join(', ')}.`, 'watch'));
    if (pastDue.length) f.push(finding('past_due_load', null, `${pastDue.length} operation(s) on ${name} were due before this week (${pastHrs} h); they are loaded into the week of ${first}.`, 'review'));
    const beyond = round2(ops.filter((o) => o.due_date && o.due_date > last).reduce((x, o) => x + (Number(o.hours_remaining) || 0), 0));
    return { work_center: name, available_per_week: avail, open_hours: round2(ops.reduce((x, o) => x + (Number(o.hours_remaining) || 0), 0)), past_due_hours: pastHrs, beyond_horizon_hours: beyond, peak_load_pct: rows.reduce((m, r) => (r.load_pct !== null && (m === null || r.load_pct > m) ? r.load_pct : m), null), status: statusOf(f), findings: f };
  });
  return {
    as_of: today, horizon: `${first} to ${last}`, work_centers: items.length, operations: operations.length, open_hours: round2(items.reduce((x, i) => x + i.open_hours, 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_week: grid, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function capacityReviewText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status !== 'ok');
  return ['# Capacity to review', '', '**To:** [TO CONFIRM production planner]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `Load for ${r.horizon} against each work center's calendar. For the work centers below, please decide: overtime, another shift, outside processing, or new promise dates. Customer dates are not changed by this note.`, '',
    '| Work center | Available per week | Open hours | Peak load % | Detail |', '| --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.work_center} | ${i.available_per_week ?? ''} | ${i.open_hours} | ${i.peak_load_pct ?? ''} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
