// Labor efficiency by work center: standard hours earned by completions against direct hours clocked.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, pct, str, itemKey, groupBy, yes } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const LABOR_FIELDS = Object.freeze({
  entry: t(['Entry', 'Entry ID', 'Labor ID', 'Transaction', 'Ticket'], { required: true }),
  employee: t(['Employee', 'Employee Name', 'Operator', 'Worker'], { personal: true }),
  work_center: t(['Work Center', 'Work Centre', 'Resource', 'Department'], { required: true }),
  work_order: t(['Work Order', 'Job', 'WO', 'Production Order']),
  labor_date: t(['Date', 'Work Date', 'Labor Date', 'Clock Date'], { type: 'date' }),
  hours: t(['Hours', 'Actual Hours', 'Clocked Hours', 'Labor Hours'], { type: 'number' }),
  indirect: t(['Indirect', 'Indirect Labor', 'Non-Productive', 'Indirect Code']),
});
export const EARNED_FIELDS = Object.freeze({
  work_order: t(['Work Order', 'Job', 'WO', 'Production Order'], { required: true }),
  work_center: t(['Work Center', 'Work Centre', 'Resource']),
  qty_completed: t(['Qty Completed', 'Completed', 'Quantity Completed', 'Good Qty'], { type: 'number' }),
  std_hours_per_unit: t(['Std Hours per Unit', 'Standard Hours', 'Run Hours per Unit', 'Std Hrs/Unit'], { type: 'number' }),
});
/** JobBOSS labor detail. Written from knowledge of the export; not checked against a live system. */
export const LABOR_PROFILES = Object.freeze([
  exportProfile('jobboss_labor_detail', { entry: { from: ['Job', 'Work Date', 'Hours', 'Work Center'], compute: (_r, get) => ['Job', 'Work Center', 'Work Date', 'Hours'].map((k) => String(get(k) ?? '').trim()).join('/') }, employee: 'Employee', work_center: 'Work Center', work_order: 'Job', labor_date: 'Work Date', hours: 'Hours', indirect: 'Indirect' }, { note: 'JobBOSS labor detail: one row per labor ticket; the entry id is built from job, work center, date and hours.' }),
]);

export const DEFAULTS = Object.freeze({ min_efficiency_pct: 85, max_efficiency_pct: 120, max_indirect_pct: 15 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    min_efficiency_pct: { type: 'number', minimum: 0, maximum: 1000, description: 'Earned hours below this percentage of direct hours are flagged' },
    max_efficiency_pct: { type: 'number', minimum: 0, maximum: 1000, description: 'Above this percentage the standard may be loose; listed to watch' },
    max_indirect_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Indirect hours above this share of all hours are reviewed' },
  },
});

/** Efficiency by work center. Finding codes: low_efficiency, high_efficiency, high_indirect, hours_no_output, output_no_hours. */
export function laborEfficiency({ labor, earned }, s = DEFAULTS) {
  const L = groupBy(labor.filter((r) => str(r.work_center)), (r) => itemKey(r.work_center));
  const E = groupBy(earned.filter((r) => str(r.work_order)), (r) => itemKey(r.work_center));
  const woWithOutput = new Set(earned.filter((r) => (Number(r.qty_completed) || 0) > 0).map((r) => `${itemKey(r.work_center)}|${itemKey(r.work_order)}`));
  const woWithHours = new Set(labor.filter((r) => !yes(r.indirect) && str(r.work_order)).map((r) => `${itemKey(r.work_center)}|${itemKey(r.work_order)}`));
  const keys = [...new Set([...L.keys(), ...E.keys()])].filter(Boolean).sort();
  const items = keys.map((k) => {
    const ls = L.get(k) || []; const es = E.get(k) || []; const name = str((ls[0] || es[0]).work_center);
    const direct = round2(ls.filter((r) => !yes(r.indirect)).reduce((x, r) => x + (Number(r.hours) || 0), 0));
    const indirect = round2(ls.filter((r) => yes(r.indirect)).reduce((x, r) => x + (Number(r.hours) || 0), 0));
    const earnedHrs = round2(es.reduce((x, r) => x + (Number(r.qty_completed) || 0) * (Number(r.std_hours_per_unit) || 0), 0));
    const eff = pct(earnedHrs, direct); const ind = pct(indirect, direct + indirect); const f = [];
    if (eff !== null && eff < s.min_efficiency_pct) f.push(finding('low_efficiency', null, `${name} earned ${earnedHrs} standard hours on ${direct} direct hours (${eff}%, target at least ${s.min_efficiency_pct}%).`));
    if (eff !== null && eff > s.max_efficiency_pct) f.push(finding('high_efficiency', null, `${name} earned ${earnedHrs} standard hours on ${direct} direct hours (${eff}%): the standard may be loose, or hours were not clocked.`, 'watch'));
    if (ind !== null && ind > s.max_indirect_pct) f.push(finding('high_indirect', null, `${name}: ${indirect} of ${round2(direct + indirect)} hours were indirect (${ind}%).`, 'review'));
    const noOut = [...new Set(ls.filter((r) => !yes(r.indirect) && str(r.work_order) && !woWithOutput.has(`${k}|${itemKey(r.work_order)}`)).map((r) => str(r.work_order)))].sort();
    if (noOut.length) f.push(finding('hours_no_output', null, `${name} clocked direct hours on ${noOut.join(', ')} with no completions recorded there.`, 'review'));
    const noHrs = [...new Set(es.filter((r) => (Number(r.qty_completed) || 0) > 0 && !woWithHours.has(`${k}|${itemKey(r.work_order)}`)).map((r) => str(r.work_order)))].sort();
    if (noHrs.length) f.push(finding('output_no_hours', null, `${name} completed ${noHrs.join(', ')} with no hours clocked there.`, 'review'));
    return { work_center: name, direct_hours: direct, indirect_hours: indirect, earned_hours: earnedHrs, efficiency_pct: eff, indirect_pct: ind, entries: ls.length, status: statusOf(f), findings: f };
  });
  const D = round2(items.reduce((x, i) => x + i.direct_hours, 0)), EH = round2(items.reduce((x, i) => x + i.earned_hours, 0));
  return {
    work_centers: items.length, entries: labor.length, direct_hours: D, indirect_hours: round2(items.reduce((x, i) => x + i.indirect_hours, 0)), earned_hours: EH, efficiency_pct: pct(EH, D),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function standardsReviewText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status !== 'ok');
  return ['# Labor efficiency by work center to review', '', '**To:** [TO CONFIRM production supervisor and industrial engineer]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `Overall efficiency ${r.efficiency_pct}% (${r.earned_hours} standard hours earned on ${r.direct_hours} direct hours). For each work center below, please say whether the standard, the clocking or the process needs work. This is about the work center, not any one person.`, '',
    '| Work center | Direct hours | Earned hours | Efficiency % | Indirect % | Detail |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.work_center} | ${i.direct_hours} | ${i.earned_hours} | ${i.efficiency_pct ?? ''} | ${i.indirect_pct ?? ''} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
