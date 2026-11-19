// Overhead absorption: overhead applied to jobs (hours times rate) against overhead actually spent, by work center.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, round4, pct, str, itemKey, groupBy } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const HOURS_FIELDS = Object.freeze({
  work_center: t(['Work Center', 'Work Centre', 'WC', 'Resource', 'Department', 'Resource Group'], { required: true }),
  period: t(['Period', 'Month', 'Fiscal Period']),
  hours: t(['Hours', 'Actual Hours', 'Act Run Hrs', 'Run Hours', 'Labor Hours', 'Machine Hours'], { type: 'number' }),
});
export const RATE_FIELDS = Object.freeze({
  work_center: t(['Work Center', 'Work Centre', 'WC', 'Resource', 'Department'], { required: true }),
  rate: t(['Rate', 'Overhead Rate', 'Burden Rate', 'Overhead per Hour'], { type: 'money' }),
  budget_hours: t(['Budget Hours', 'Planned Hours', 'Normal Hours', 'Capacity Hours'], { type: 'number' }),
});
export const ACTUAL_FIELDS = Object.freeze({
  work_center: t(['Work Center', 'Work Centre', 'WC', 'Cost Center', 'Department'], { required: true }),
  period: t(['Period', 'Month', 'Fiscal Period']),
  actual_overhead: t(['Actual Overhead', 'Overhead', 'Amount', 'Actual', 'Spend'], { type: 'money' }),
});
/** JobBOSS labor hours by work center. Written from knowledge of the export; not checked against a live system. */
export const HOURS_PROFILES = Object.freeze([
  exportProfile('jobboss_labor_by_wc', { work_center: 'Work Center', period: 'Period', hours: 'Act Run Hrs' }, { note: 'JobBOSS labor by work center: actual run hours per work center and period.' }),
]);

export const DEFAULTS = Object.freeze({ tolerance_pct: 5, volume_pct: 15 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    tolerance_pct: { type: 'number', minimum: 0, maximum: 1000, description: 'Under- or over-absorption beyond this percentage of actual overhead is reported' },
    volume_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Hours this far below budget hours are listed as a volume shortfall' },
  },
});

/** Absorption by work center. Finding codes: under_absorbed, over_absorbed, low_volume, no_rate, no_actual. */
export function absorption({ hours, rates, actuals }, s = DEFAULTS) {
  const H = groupBy(hours.filter((r) => str(r.work_center)), (r) => itemKey(r.work_center));
  const R = new Map(rates.filter((r) => str(r.work_center)).map((r) => [itemKey(r.work_center), r]));
  const A = groupBy(actuals.filter((r) => str(r.work_center)), (r) => itemKey(r.work_center));
  const keys = [...new Set([...H.keys(), ...R.keys(), ...A.keys()])].sort();
  const items = keys.map((k) => {
    const name = str(((H.get(k) || [])[0] || R.get(k) || (A.get(k) || [])[0]).work_center);
    const h = round2((H.get(k) || []).reduce((x, r) => x + (Number(r.hours) || 0), 0));
    const rate = R.has(k) ? R.get(k).rate : null; const budget = R.has(k) ? R.get(k).budget_hours : null;
    const actual = round2((A.get(k) || []).reduce((x, r) => x + (Number(r.actual_overhead) || 0), 0));
    const applied = rate === null ? null : round2(h * rate);
    const under = applied === null ? null : round2(actual - applied);
    const f = [];
    if (rate === null && h > 0) f.push(finding('no_rate', null, `${name} has ${h} hours and no overhead rate, so none of its ${actual} overhead was applied to jobs.`, 'review'));
    if (rate !== null && h > 0 && !A.has(k)) f.push(finding('no_actual', null, `${name} applied ${applied} but has no actual overhead in the file.`, 'review'));
    if (under !== null && A.has(k)) {
      const p = pct(under, actual);
      if (p > s.tolerance_pct) f.push(finding('under_absorbed', under, `${name}: ${actual} spent, ${applied} applied (${h} h at ${rate}): ${under} under-absorbed (${p}%). Jobs through it are under-costed.`));
      else if (p < -s.tolerance_pct) f.push(finding('over_absorbed', null, `${name}: ${applied} applied against ${actual} spent: ${round2(-under)} over-absorbed (${-p}%). Jobs through it are over-costed.`, 'watch'));
    }
    if (budget && h < budget * (1 - s.volume_pct / 100)) f.push(finding('low_volume', null, `${name} ran ${h} hours against ${budget} budgeted (${pct(h - budget, budget)}%): fixed overhead is spread over fewer hours.`, 'watch'));
    return { work_center: name, hours: h, budget_hours: budget, rate, applied, actual, under_absorbed: under, proposed_rate: h > 0 && A.has(k) ? round4(actual / h) : null, status: statusOf(f), findings: f };
  });
  const sumOf = (k) => round2(items.reduce((x, i) => x + (Number(i[k]) || 0), 0));
  return {
    work_centers: items.length, hours: sumOf('hours'), applied: sumOf('applied'), actual: sumOf('actual'), net_under_absorbed: round2(sumOf('actual') - sumOf('applied')),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    proposed_rates: items.filter((i) => i.findings.some((f) => ['under_absorbed', 'over_absorbed'].includes(f.code))).map((i) => ({ work_center: i.work_center, rate: i.rate, proposed_rate: i.proposed_rate, hours: i.hours })),
    by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function rateText(r, { from } = {}) {
  return ['# Proposed overhead rate changes', '', '**To:** [TO CONFIRM controller who sets overhead rates]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    'Proposed rate = actual overhead / actual hours for the periods in the file. A rate set on one short period follows that period\'s volume; check against budget hours before changing it.', '',
    '| Work center | Current rate | Proposed rate | Hours |', '| --- | --- | --- | --- |', ...r.proposed_rates.map((x) => `| ${x.work_center} | ${x.rate} | ${x.proposed_rate} | ${x.hours} |`)].join('\n');
}
