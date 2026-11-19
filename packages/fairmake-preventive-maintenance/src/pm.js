// Preventive maintenance: tasks overdue by date or by run hours, due soon, never done, or with no interval.
import { exportProfile, finding, statusOf, tallyFindings, countBy, str, itemKey, groupBy, daysBetween, addDays, asOfDate, yes } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const SCHEDULE_FIELDS = Object.freeze({
  task: t(['Task', 'PM Task', 'Task ID', 'PM ID', 'Procedure'], { required: true }),
  asset: t(['Asset', 'Machine', 'Equipment', 'Asset ID'], { required: true }),
  description: t(['Description', 'Task Description', 'Procedure Name']),
  interval_days: t(['Interval Days', 'Frequency (days)', 'Frequency Days', 'Every (days)'], { type: 'number' }),
  interval_hours: t(['Interval Hours', 'Run Hours Interval', 'Meter Interval'], { type: 'number' }),
  last_done: t(['Last Done', 'Last Completed', 'Last Performed', 'Completed On'], { type: 'date' }),
  hours_since: t(['Hours Since', 'Run Hours Since', 'Meter Since Last', 'Hours Since Last PM'], { type: 'number' }),
  critical: t(['Critical', 'Safety Critical', 'Priority Critical']),
});
export const COMPLETION_FIELDS = Object.freeze({
  task: t(['Task', 'PM Task', 'Task ID', 'PM ID'], { required: true }),
  done_date: t(['Done Date', 'Completed', 'Completed On', 'Date'], { type: 'date' }),
});
/** Generic CMMS PM schedule. Written from knowledge of such exports; not checked against a live system. */
export const SCHEDULE_PROFILES = Object.freeze([
  exportProfile('cmms_pm_schedule', { task: { from: ['Asset', 'PM Task'], compute: (_r, get) => `${String(get('Asset') ?? '').trim()}/${String(get('PM Task') ?? '').trim()}` }, asset: 'Asset', description: 'PM Task', interval_days: 'Frequency (days)', last_done: 'Last Completed', critical: 'Critical' }, { note: 'CMMS PM schedule: the task id is the asset and the task name.' }),
]);

export const DEFAULTS = Object.freeze({ due_soon_days: 14 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    due_soon_days: { type: 'integer', minimum: 1, maximum: 365, description: 'A task due within this many days is listed as due soon' },
  },
});

/** PM status per task. Finding codes: overdue, meter_overdue, due_soon, never_done, no_interval. */
export function pmStatus({ schedule, completions }, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf);
  const done = groupBy(completions.filter((c) => str(c.task) && c.done_date), (c) => itemKey(c.task));
  const items = [...groupBy(schedule.filter((x) => str(x.task)), (x) => itemKey(x.task)).values()].map((xs) => {
    const r = xs[0]; const task = str(r.task); const crit = yes(r.critical);
    const last = [r.last_done, ...(done.get(itemKey(task)) || []).map((c) => c.done_date)].filter(Boolean).sort().pop() || null;
    const due = last && r.interval_days ? addDays(last, r.interval_days) : null; const days = due ? daysBetween(today, due) : null; const f = [];
    const what = `${str(r.asset)} ${str(r.description) || task}`.trim();
    if (!r.interval_days && !r.interval_hours) f.push(finding('no_interval', null, `${what} has no interval in days or hours, so it can never come due.`, 'review'));
    else if (!last && r.interval_days) f.push(finding('never_done', null, `${what} has no completion on record.`, 'review'));
    if (days !== null && days < 0) f.push(finding('overdue', null, `${what} was due ${due} (${-days} days ago)${crit ? '; marked safety critical' : ''}.`));
    else if (days !== null && days <= s.due_soon_days) f.push(finding('due_soon', null, `${what} is due ${due} (in ${days} days).`, 'watch'));
    if (r.interval_hours && r.hours_since > r.interval_hours) f.push(finding('meter_overdue', null, `${what} has run ${r.hours_since} hours since its last PM against an interval of ${r.interval_hours}.`));
    return { task, asset: str(r.asset), description: str(r.description), critical: crit, last_done: last, due_date: due, days_to_due: days, hours_since: r.hours_since ?? null, interval_hours: r.interval_hours ?? null, status: statusOf(f), findings: f };
  }).sort((a, b) => (`${itemKey(a.asset)}|${itemKey(a.task)}` < `${itemKey(b.asset)}|${itemKey(b.task)}` ? -1 : 1));
  return {
    as_of: today, tasks: items.length, assets: new Set(items.map((i) => itemKey(i.asset))).size,
    overdue: items.filter((i) => i.findings.some((f) => f.code === 'overdue' || f.code === 'meter_overdue')).length, critical_overdue: items.filter((i) => i.critical && i.status === 'flag').length,
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function pmWorkOrderText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status === 'flag' || i.status === 'review').sort((a, b) => Number(b.critical) - Number(a.critical));
  return ['# Preventive maintenance to schedule', '', '**To:** [TO CONFIRM maintenance lead]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `As of ${r.as_of}: ${r.overdue} task(s) overdue, ${r.critical_overdue} of them marked safety critical. Please schedule these and record the completions in the CMMS.`, '',
    '| Asset | Task | Critical | Last done | Due | Detail |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.asset} | ${i.description || i.task} | ${i.critical ? 'yes' : ''} | ${i.last_done || ''} | ${i.due_date || ''} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
