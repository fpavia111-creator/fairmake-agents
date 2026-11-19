// Calibration due dates: gauges overdue or due soon, never calibrated, and work orders measured with a gauge
// that was overdue or had failed its last calibration (suspect product).
import { exportProfile, finding, statusOf, tallyFindings, countBy, str, itemKey, groupBy, daysBetween, addDays, asOfDate } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const GAUGE_FIELDS = Object.freeze({
  gauge: t(['Gauge', 'Gauge ID', 'Instrument', 'Instrument ID', 'Asset'], { required: true }),
  description: t(['Description', 'Gauge Description', 'Type']),
  location: t(['Location', 'Area', 'Department']),
  last_cal: t(['Last Calibration', 'Last Cal', 'Calibrated On', 'Last Calibrated'], { type: 'date' }),
  interval_days: t(['Interval Days', 'Calibration Interval', 'Frequency (days)', 'Cal Interval'], { type: 'number' }),
  cal_result: t(['Result', 'Cal Result', 'As Found', 'Last Result']),
  gauge_status: t(['Status', 'Gauge Status', 'State']),
});
export const USAGE_FIELDS = Object.freeze({
  gauge: t(['Gauge', 'Gauge ID', 'Instrument'], { required: true }),
  work_order: t(['Work Order', 'Job', 'Lot', 'Inspection Lot']),
  used_date: t(['Used Date', 'Date', 'Inspection Date', 'Measured On'], { type: 'date' }),
});
/** Generic calibration register. Written from knowledge of such exports; not checked against a live system. */
export const GAUGE_PROFILES = Object.freeze([
  exportProfile('calibration_register', { gauge: 'Gauge ID', description: 'Description', location: 'Location', last_cal: 'Last Calibration', interval_days: 'Calibration Interval', cal_result: 'Result', gauge_status: 'Status' }, { note: 'Calibration register: one row per gauge with its last calibration and interval.' }),
]);

export const DEFAULTS = Object.freeze({ due_soon_days: 30 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    due_soon_days: { type: 'integer', minimum: 1, maximum: 365, description: 'A gauge due within this many days is listed as due soon' },
  },
});
const FAILED = /fail|out of tol|oot|reject|nok|^no$/i;
const RETIRED = /out of service|retired|scrapped|lost|inactive/i;

/** Gauge status. Finding codes: overdue, due_soon, failed_then_used, used_while_overdue, never_calibrated, no_interval. */
export function calibrationStatus({ gauges, usage }, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf);
  const U = groupBy(usage.filter((u) => str(u.gauge)), (u) => itemKey(u.gauge));
  const suspect = [];
  const items = [...groupBy(gauges.filter((g) => str(g.gauge)), (g) => itemKey(g.gauge)).values()].map((gs) => {
    const g = gs[0]; const id = str(g.gauge); const retired = RETIRED.test(str(g.gauge_status)); const failed = FAILED.test(str(g.cal_result));
    const due = g.last_cal && g.interval_days ? addDays(g.last_cal, g.interval_days) : null; const days = due ? daysBetween(today, due) : null; const f = [];
    const uses = (U.get(itemKey(id)) || []).filter((u) => u.used_date).sort((a, b) => (a.used_date < b.used_date ? -1 : a.used_date > b.used_date ? 1 : (str(a.work_order) < str(b.work_order) ? -1 : 1)));
    if (!retired) {
      if (!g.last_cal) f.push(finding('never_calibrated', null, `${id} has no calibration on record.`, 'review'));
      if (!g.interval_days) f.push(finding('no_interval', null, `${id} has no calibration interval.`, 'review'));
      if (days !== null && days < 0) f.push(finding('overdue', null, `${id} was due for calibration ${due} (${-days} days ago).`));
      else if (days !== null && days <= s.due_soon_days) f.push(finding('due_soon', null, `${id} is due for calibration ${due} (in ${days} days).`, 'watch'));
    }
    const afterFail = failed && g.last_cal ? uses.filter((u) => u.used_date >= g.last_cal) : [];
    if (afterFail.length) { f.push(finding('failed_then_used', null, `${id} failed its calibration on ${g.last_cal} and was used afterwards on ${afterFail.map((u) => `${str(u.work_order) || '?'} (${u.used_date})`).join(', ')}. Review that product.`)); for (const u of afterFail) suspect.push({ gauge: id, work_order: str(u.work_order), used_date: u.used_date, why: 'used after a failed calibration' }); }
    const afterDue = due ? uses.filter((u) => u.used_date > due && !afterFail.includes(u)) : [];
    if (afterDue.length) { f.push(finding('used_while_overdue', null, `${id} was used past its due date ${due} on ${afterDue.map((u) => `${str(u.work_order) || '?'} (${u.used_date})`).join(', ')}.`)); for (const u of afterDue) suspect.push({ gauge: id, work_order: str(u.work_order), used_date: u.used_date, why: 'used while overdue' }); }
    return { gauge: id, description: str(g.description), location: str(g.location), last_cal: g.last_cal, cal_result: str(g.cal_result), due_date: due, days_to_due: days, gauge_status: str(g.gauge_status), uses: uses.length, status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.gauge) < itemKey(b.gauge) ? -1 : 1));
  suspect.sort((a, b) => (`${a.gauge}|${a.used_date}|${a.work_order}` < `${b.gauge}|${b.used_date}|${b.work_order}` ? -1 : 1));
  return {
    as_of: today, gauges: items.length, overdue: items.filter((i) => i.findings.some((f) => f.code === 'overdue')).length, suspect_work_orders: suspect.length,
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    suspect, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function suspectNoticeText(r, { from } = {}) {
  return ['# Product measured with a suspect gauge', '', '**To:** [TO CONFIRM quality manager]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `${r.suspect_work_orders} measurement(s) were made with a gauge that had failed calibration or was overdue. Please decide for each work order whether the product needs re-inspection, and whether any customer must be told. This note tells no customer anything.`, '',
    '| Gauge | Work order | Used on | Why |', '| --- | --- | --- | --- |', ...r.suspect.map((x) => `| ${x.gauge} | ${x.work_order} | ${x.used_date} | ${x.why} |`)].join('\n');
}
