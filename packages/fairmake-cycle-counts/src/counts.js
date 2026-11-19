// Cycle count variance: counted against system quantity with tolerances by ABC class, repeat variances and counts to redo.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, pct, str, itemKey, groupBy } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const COUNT_FIELDS = Object.freeze({
  count_id: t(['Count ID', 'Count Line', 'Tag', 'Count Tag', 'Line ID'], { required: true }),
  item: t(['Item', 'Part', 'Part Number', 'SKU', 'Item No.'], { required: true }),
  location: t(['Location', 'Bin', 'Warehouse', 'Bin Location']),
  count_date: t(['Count Date', 'Date Counted', 'Date'], { type: 'date' }),
  system_qty: t(['System Qty', 'Qty On Hand', 'Book Qty', 'Expected Qty', 'On Hand'], { type: 'number' }),
  counted_qty: t(['Counted Qty', 'Qty Counted', 'Count', 'Physical Qty'], { type: 'number' }),
  unit_cost: t(['Unit Cost', 'Cost', 'Std Cost', 'Average Cost'], { type: 'money' }),
  abc_class: t(['ABC Class', 'ABC', 'Class', 'Cycle Count Class']),
});
/** Fishbowl cycle count export. Written from knowledge of the export; not checked against a live system. */
export const COUNT_PROFILES = Object.freeze([
  exportProfile('fishbowl_cycle_count', { count_id: { from: ['Part Number', 'Location'], compute: (_r, get) => `${String(get('Part Number') ?? '').trim()}@${String(get('Location') ?? '').trim()}` }, item: 'Part Number', location: 'Location', count_date: 'Date Counted', system_qty: 'Qty On Hand', counted_qty: 'Qty Counted', unit_cost: 'Unit Cost', abc_class: 'ABC Code' }, { note: 'Fishbowl cycle count: the count line is the part and location.' }),
]);

export const DEFAULTS = Object.freeze({ tolerance_pct: { A: 2, B: 5, C: 10 }, default_tolerance_pct: 5, value_tolerance: 100, repeat_count: 2 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    tolerance_pct: { type: 'object', additionalProperties: { type: 'number', minimum: 0, maximum: 100 }, description: 'Quantity tolerance % by ABC class' },
    default_tolerance_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Tolerance % for items with no class' },
    value_tolerance: { type: 'number', minimum: 0, description: 'A variance worth less than this is within tolerance whatever its %' },
    repeat_count: { type: 'integer', minimum: 2, maximum: 50, description: 'An item with a variance on this many counts is a repeat variance' },
  },
});

/** Every count line. Finding codes: out_of_tolerance, not_counted, negative_system, repeat_variance. */
export function cycleCounts(rows, s = DEFAULTS) {
  const lines = rows.filter((r) => str(r.count_id) && str(r.item));
  const varied = new Map();
  for (const r of lines) if (r.counted_qty !== null && r.counted_qty !== undefined && r.counted_qty !== (r.system_qty ?? 0)) varied.set(itemKey(r.item), (varied.get(itemKey(r.item)) || 0) + 1);
  const items = [...groupBy(lines, (r) => itemKey(r.count_id)).values()].map((ls) => {
    const r = ls[0]; const cls = str(r.abc_class).toUpperCase(); const tol = (s.tolerance_pct || {})[cls] ?? s.default_tolerance_pct;
    const sys = r.system_qty ?? 0; const counted = r.counted_qty; const cost = r.unit_cost ?? 0; const f = [];
    const diff = counted === null || counted === undefined ? null : round2(counted - sys); const value = diff === null ? null : round2(diff * cost); const p = diff === null ? null : sys ? pct(diff, sys) : (diff ? 100 : 0);
    if (diff === null) f.push(finding('not_counted', null, `${r.count_id} (${r.item} at ${r.location || '?'}) has no counted quantity.`, 'review'));
    if (sys < 0) f.push(finding('negative_system', null, `${r.item} at ${r.location || '?'} shows ${sys} on hand in the system.`, 'review'));
    if (diff !== null && Math.abs(p) > tol && Math.abs(value) > s.value_tolerance) f.push(finding('out_of_tolerance', Math.abs(value), `${r.item} at ${r.location || '?'}: counted ${counted} against ${sys} (${diff > 0 ? '+' : ''}${diff}, ${p}%, ${value}); class ${cls || 'none'} tolerance ${tol}%.`));
    if (diff && (varied.get(itemKey(r.item)) || 0) >= s.repeat_count) f.push(finding('repeat_variance', null, `${r.item} has a variance on ${varied.get(itemKey(r.item))} counts: look for a process cause (unit of measure, backflush, receiving).`, 'watch'));
    return { count_id: str(r.count_id), item: str(r.item), location: str(r.location), abc_class: cls, system_qty: sys, counted_qty: counted ?? null, variance_qty: diff, variance_value: value, variance_pct: p, tolerance_pct: tol, status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.count_id) < itemKey(b.count_id) ? -1 : 1));
  const counted = items.filter((i) => i.variance_qty !== null);
  const within = (i) => !i.findings.some((f) => f.code === 'out_of_tolerance');
  const by_class = [...groupBy(counted, (i) => i.abc_class || '(none)').entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, xs]) => ({ class: k, lines: xs.length, accuracy_pct: pct(xs.filter(within).length, xs.length), net_value: round2(xs.reduce((x, i) => x + i.variance_value, 0)), abs_value: round2(xs.reduce((x, i) => x + Math.abs(i.variance_value), 0)) }));
  return {
    lines: items.length, counted: counted.length, accuracy_pct: pct(counted.filter(within).length, counted.length),
    net_variance_value: round2(counted.reduce((x, i) => x + i.variance_value, 0)), out_of_tolerance_value: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'out_of_tolerance').reduce((y, f) => y + f.amount, 0), 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_class, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function adjustmentText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.findings.some((f) => f.code === 'out_of_tolerance'));
  return ['# Inventory adjustments to approve', '', '**To:** [TO CONFIRM controller or inventory manager]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `Count lines out of tolerance, ${r.out_of_tolerance_value} in absolute value. Recount each line before it is adjusted; post nothing that was not recounted.`, '',
    '| Count | Item | Location | System | Counted | Variance | Value |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.count_id} | ${i.item} | ${i.location} | ${i.system_qty} | ${i.counted_qty} | ${i.variance_qty} | ${i.variance_value} |`)].join('\n');
}
