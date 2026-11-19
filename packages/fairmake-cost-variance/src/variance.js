// Standard against actual cost by work order: pure functions over work order cost rows.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, pct, str, itemKey, groupBy } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const WO_FIELDS = Object.freeze({
  work_order: t(['Work Order', 'WO', 'WO Number', 'Job', 'Job Number', 'Production Order', 'Production Order No.', 'MO number', 'Document Number'], { required: true }),
  item: t(['Item', 'Part', 'Part Number', 'Assembly', 'Product', 'Item No.']),
  wo_status: t(['Status', 'Job Status', 'WO Status', 'Order Status']),
  closed_date: t(['Closed Date', 'Close Date', 'Completed Date', 'Date Closed'], { type: 'date' }),
  qty_completed: t(['Qty Completed', 'Quantity Completed', 'Completed Qty', 'Built', 'Qty Built'], { type: 'number' }),
  std_material: t(['Std Material', 'Standard Material', 'Est Mtl Cost', 'Estimated Material Cost', 'Planned Material Cost'], { type: 'money' }),
  act_material: t(['Act Material', 'Actual Material', 'Act Mtl Cost', 'Actual Material Cost'], { type: 'money' }),
  std_labor: t(['Std Labor', 'Standard Labor', 'Est Lbr Cost', 'Estimated Labor Cost', 'Planned Labor Cost'], { type: 'money' }),
  act_labor: t(['Act Labor', 'Actual Labor', 'Act Lbr Cost', 'Actual Labor Cost'], { type: 'money' }),
  std_overhead: t(['Std Overhead', 'Standard Overhead', 'Est Burden Cost', 'Estimated Burden', 'Planned Overhead'], { type: 'money' }),
  act_overhead: t(['Act Overhead', 'Actual Overhead', 'Act Burden Cost', 'Actual Burden'], { type: 'money' }),
});
/** Epicor Kinetic job cost summary. Written from knowledge of the export; not checked against a live system. */
export const WO_PROFILES = Object.freeze([
  exportProfile('epicor_job_cost', { work_order: 'Job', item: 'Part', wo_status: 'Job Status', closed_date: 'Closed Date', qty_completed: 'Qty Completed', std_material: 'Est Mtl Cost', act_material: 'Act Mtl Cost', std_labor: 'Est Lbr Cost', act_labor: 'Act Lbr Cost', std_overhead: 'Est Burden Cost', act_overhead: 'Act Burden Cost' }, { note: 'Epicor Kinetic job cost BAQ: estimated against actual material, labor and burden per job.' }),
]);

export const DEFAULTS = Object.freeze({ tolerance_pct: 5, tolerance_amount: 250, favorable_pct: 15 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    tolerance_pct: { type: 'number', minimum: 0, maximum: 1000, description: 'An element is flagged over when its variance is above this percentage of standard' },
    tolerance_amount: { type: 'number', minimum: 0, description: 'and above this amount (both must be exceeded)' },
    favorable_pct: { type: 'number', minimum: 0, maximum: 1000, description: 'A cost this far under standard (and above the amount) is sent for review: the standard may be loose or costs may be missing' },
  },
});

const ELEMENTS = [['material', 'std_material', 'act_material'], ['labor', 'std_labor', 'act_labor'], ['overhead', 'std_overhead', 'act_overhead']];
const closed = (s) => /clos|complet|done|finish|^c$|^yes$|^true$/i.test(str(s));

/**
 * Compare standard and actual cost on every work order. Rows for the same work order are summed.
 * Finding codes: material_over, labor_over, overhead_over, large_favorable, no_standard, cost_no_output.
 */
export function costVariance(rows, s = DEFAULTS) {
  const by = groupBy(rows.filter((r) => str(r.work_order)), (r) => itemKey(r.work_order));
  const items = [...by.values()].map((lines) => {
    const r0 = lines[0]; const wo = str(r0.work_order);
    const sumOf = (k) => round2(lines.reduce((x, l) => x + (Number(l[k]) || 0), 0));
    const elements = ELEMENTS.map(([element, sk, ak]) => ({ element, standard: sumOf(sk), actual: sumOf(ak), variance: round2(sumOf(ak) - sumOf(sk)) }));
    const standard = round2(elements.reduce((x, e) => x + e.standard, 0)); const actual = round2(elements.reduce((x, e) => x + e.actual, 0));
    const variance = round2(actual - standard); const qty = sumOf('qty_completed');
    const status = lines.map((l) => str(l.wo_status)).find(Boolean) || '';
    const f = [];
    if (standard === 0 && actual > 0) f.push(finding('no_standard', null, `${wo} has ${actual} actual cost and no standard cost on file. Set a standard before judging the variance.`, 'review'));
    else {
      for (const e of elements) {
        const p = pct(e.variance, e.standard);
        if (e.variance > s.tolerance_amount && (e.standard === 0 || p > s.tolerance_pct)) f.push(finding(`${e.element}_over`, e.variance, `${e.element[0].toUpperCase() + e.element.slice(1)} ${e.actual} against standard ${e.standard}: ${e.variance} over${p === null ? '' : ` (${p}%)`}.`));
      }
      const pu = pct(-variance, standard);
      if (-variance > s.tolerance_amount && pu > s.favorable_pct) f.push(finding('large_favorable', null, `Total cost ${actual} is ${round2(-variance)} (${pu}%) under standard ${standard}. Check the standard, and whether every material issue and labor ticket was charged to the work order.`, 'review'));
    }
    if (qty === 0 && actual > 0 && closed(status)) f.push(finding('cost_no_output', actual, `${wo} is closed with ${actual} charged and nothing completed. Find where the output went, or move the cost.`));
    return { work_order: wo, item: lines.map((l) => str(l.item)).find(Boolean) || '', status: statusOf(f), wo_status: status, qty_completed: qty, standard, actual, variance, variance_pct: pct(variance, standard), elements, findings: f };
  }).sort((a, b) => (itemKey(a.work_order) < itemKey(b.work_order) ? -1 : 1));
  const by_element = ELEMENTS.map(([element]) => { const xs = items.map((i) => i.elements.find((e) => e.element === element)); return { element, standard: round2(xs.reduce((x, e) => x + e.standard, 0)), actual: round2(xs.reduce((x, e) => x + e.actual, 0)), variance: round2(xs.reduce((x, e) => x + e.variance, 0)) }; });
  const flagged = round2(items.reduce((x, i) => x + i.findings.filter((f) => f.level === 'flag' && f.amount > 0 && f.code !== 'cost_no_output').reduce((y, f) => y + f.amount, 0), 0));
  return {
    work_orders: items.length, standard: round2(items.reduce((x, i) => x + i.standard, 0)), actual: round2(items.reduce((x, i) => x + i.actual, 0)),
    variance: round2(items.reduce((x, i) => x + i.variance, 0)), flagged_over: flagged, flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, ok: items.filter((i) => i.status === 'ok').length,
    by_element, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

/** The variance review memo: one table row per flagged element. */
export function reviewText(r, { to, from } = {}) {
  const rows = r.items.filter((i) => i.status !== 'ok').flatMap((i) => i.findings.map((f) => ({ i, f })));
  return [
    '# Work order cost variances to review', '',
    `**To:** ${to || '[TO CONFIRM production manager or plant controller]'}`,
    `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `${r.flag} work order(s) are over standard beyond the tolerance (${r.flagged_over} in total) and ${r.review} need a look at the standard. Please say what happened on each before the period closes.`, '',
    '| Work order | Item | Finding | Amount | Detail |', '| --- | --- | --- | --- | --- |',
    ...rows.map(({ i, f }) => `| ${i.work_order} | ${i.item} | ${f.code} | ${f.amount ?? ''} | ${f.detail} |`),
  ].join('\n');
}
