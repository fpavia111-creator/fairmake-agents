// Scrap and yield: scrap rates against standard by work order, with the cost of the excess, missing reasons and counts that do not add up.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, pct, str, itemKey, groupBy } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const PROD_FIELDS = Object.freeze({
  work_order: t(['Work Order', 'WO', 'Job', 'Production Order', 'MO number'], { required: true }),
  item: t(['Item', 'Part', 'Part Number', 'Product']),
  work_center: t(['Work Center', 'Machine', 'Line', 'Resource', 'Cell']),
  prod_date: t(['Date', 'Production Date', 'Shift Date', 'Completed'], { type: 'date' }),
  qty_started: t(['Qty Started', 'Started', 'Input Qty', 'Qty Issued'], { type: 'number' }),
  qty_good: t(['Qty Good', 'Good', 'Good Count', 'Good Qty', 'Qty Completed'], { type: 'number' }),
  qty_scrap: t(['Qty Scrap', 'Scrap', 'Scrap Qty', 'Reject Count', 'Rejected'], { type: 'number' }),
  unit_cost: t(['Unit Cost', 'Std Cost', 'Standard Cost', 'Cost'], { type: 'money' }),
  scrap_reason: t(['Scrap Reason', 'Reason', 'Reject Reason', 'Top Reject Reason', 'Defect']),
});
export const STD_FIELDS = Object.freeze({
  item: t(['Item', 'Part', 'Part Number', 'Product'], { required: true }),
  std_scrap_pct: t(['Std Scrap %', 'Standard Scrap %', 'Scrap Factor', 'Planned Scrap %', 'Scrap %'], { type: 'number' }),
});
/** Generic MES production counts. Written from knowledge of such exports; not checked against a live system. */
export const PROD_PROFILES = Object.freeze([
  exportProfile('mes_production_counts', { work_order: 'Work Order', item: 'Part', work_center: 'Machine', prod_date: 'Shift Date', qty_good: 'Good Count', qty_scrap: 'Reject Count', scrap_reason: 'Top Reject Reason' }, { note: 'MES production counts: good and reject counts per work order and machine; started is good plus rejects.' }),
]);

export const DEFAULTS = Object.freeze({ default_scrap_pct: 3, alert_factor: 1.5, min_amount: 50 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    default_scrap_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Standard scrap % for items with no standard' },
    alert_factor: { type: 'number', minimum: 1, maximum: 100, description: 'Scrap above the standard times this factor is flagged' },
    min_amount: { type: 'number', minimum: 0, description: 'Excess scrap worth less than this is not flagged' },
  },
});

/** Scrap by work order. Finding codes: scrap_over_standard, no_reason, qty_mismatch, yield_over_100. */
export function scrapYield({ production, standards }, s = DEFAULTS) {
  const STD = new Map(standards.filter((x) => str(x.item)).map((x) => [itemKey(x.item), x.std_scrap_pct]));
  const by = groupBy(production.filter((r) => str(r.work_order)), (r) => itemKey(r.work_order));
  const items = [...by.values()].map((ls) => {
    const r = ls[0]; const wo = str(r.work_order); const sumOf = (k) => ls.reduce((x, l) => x + (Number(l[k]) || 0), 0);
    const good = sumOf('qty_good'), scrap = sumOf('qty_scrap'); const hasStarted = ls.some((l) => l.qty_started !== null && l.qty_started !== undefined);
    const started = hasStarted ? sumOf('qty_started') : good + scrap; const cost = ls.map((l) => l.unit_cost).find((x) => x !== null && x !== undefined) ?? null;
    const stdPct = STD.has(itemKey(r.item)) && STD.get(itemKey(r.item)) !== null ? STD.get(itemKey(r.item)) : s.default_scrap_pct;
    const actPct = pct(scrap, started); const f = [];
    const excessQty = round2(scrap - (started * stdPct) / 100); const excessCost = cost === null ? null : round2(excessQty * cost);
    if (actPct !== null && actPct > stdPct * s.alert_factor && (excessCost === null || excessCost >= s.min_amount)) f.push(finding('scrap_over_standard', excessCost, `${wo} scrapped ${scrap} of ${started} (${actPct}%) against a ${stdPct}% standard: ${excessQty} more than standard${excessCost === null ? '' : `, ${excessCost} at ${cost} each`}.`));
    if (scrap > 0 && !ls.some((l) => str(l.scrap_reason))) f.push(finding('no_reason', null, `${wo} scrapped ${scrap} with no reason recorded.`, 'review'));
    if (hasStarted && good + scrap !== started && good <= started) f.push(finding('qty_mismatch', null, `${wo}: ${good} good plus ${scrap} scrap is ${good + scrap}, not the ${started} started. ${started - good - scrap > 0 ? `${started - good - scrap} unaccounted for.` : ''}`.trim(), 'review'));
    if (hasStarted && good > started) f.push(finding('yield_over_100', null, `${wo} reports ${good} good from ${started} started.`, 'review'));
    return { work_order: wo, item: r.item || '', work_center: r.work_center || '', started, good, scrap, scrap_pct: actPct, std_scrap_pct: stdPct, unit_cost: cost, scrap_cost: cost === null ? null : round2(scrap * cost), reasons: [...new Set(ls.map((l) => str(l.scrap_reason)).filter(Boolean))].join('; '), status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.work_order) < itemKey(b.work_order) ? -1 : 1));
  const roll = (key) => [...groupBy(items, (i) => itemKey(i[key]) || '(none)').values()].map((xs) => { const st = xs.reduce((x, i) => x + i.started, 0), sc = xs.reduce((x, i) => x + i.scrap, 0); return { [key]: xs[0][key] || '(none)', work_orders: xs.length, started: st, scrap: sc, scrap_pct: pct(sc, st), scrap_cost: round2(xs.reduce((x, i) => x + (i.scrap_cost || 0), 0)) }; }).sort((a, b) => b.scrap_cost - a.scrap_cost || (a[key] < b[key] ? -1 : 1));
  const reasonRows = [...groupBy(production.filter((r) => str(r.work_order) && (Number(r.qty_scrap) || 0) > 0), (r) => str(r.scrap_reason).toLowerCase() || '(none)').entries()].map(([k, xs]) => ({ reason: k === '(none)' ? '(none)' : str(xs[0].scrap_reason), scrap: xs.reduce((x, r) => x + (Number(r.qty_scrap) || 0), 0), scrap_cost: round2(xs.reduce((x, r) => x + (Number(r.qty_scrap) || 0) * (Number(r.unit_cost) || 0), 0)) })).sort((a, b) => b.scrap_cost - a.scrap_cost || (a.reason < b.reason ? -1 : 1));
  const started = items.reduce((x, i) => x + i.started, 0), scrap = items.reduce((x, i) => x + i.scrap, 0);
  return {
    work_orders: items.length, started, scrap, scrap_pct: pct(scrap, started), scrap_cost: round2(items.reduce((x, i) => x + (i.scrap_cost || 0), 0)),
    excess_cost: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'scrap_over_standard').reduce((y, f) => y + (f.amount || 0), 0), 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, ok: items.filter((i) => i.status === 'ok').length,
    by_work_center: roll('work_center'), by_reason: reasonRows, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function scrapReviewText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status !== 'ok');
  return ['# Scrap above standard to review', '', '**To:** [TO CONFIRM quality manager]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `Scrap ran at ${r.scrap_pct}% overall; ${r.excess_cost} is above standard. Please give a cause and an action for each work order below, and the reasons where none was recorded.`, '',
    '| Work order | Item | Work center | Scrap % | Standard % | Excess cost | Detail |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.work_order} | ${i.item} | ${i.work_center} | ${i.scrap_pct} | ${i.std_scrap_pct} | ${i.findings.filter((f) => f.amount).reduce((x, f) => x + f.amount, 0)} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
