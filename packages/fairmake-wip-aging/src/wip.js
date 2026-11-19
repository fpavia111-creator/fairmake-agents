// WIP aging: open work orders by age, stale ones, past due ones, and closed ones still holding WIP.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, groupBy, daysBetween, asOfDate, agingBucket } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const WO_FIELDS = Object.freeze({
  work_order: t(['Work Order', 'WO', 'Job', 'Job Number', 'Production Order', 'MO number', 'Document Number'], { required: true }),
  item: t(['Item', 'Part', 'Assembly', 'Product', 'Part Number']),
  wo_status: t(['Status', 'WO Status', 'Job Status', 'Order Status']),
  release_date: t(['Release Date', 'Released', 'Start Date', 'Date', 'Created'], { type: 'date' }),
  due_date: t(['Due Date', 'Due', 'End Date', 'Required Date', 'Scheduled End'], { type: 'date' }),
  last_activity: t(['Last Activity', 'Last Transaction', 'Last Labor Date', 'Last Issue Date', 'Last Updated'], { type: 'date' }),
  wip_value: t(['WIP Value', 'WIP', 'WIP Balance', 'Value in Process', 'WIP Amount'], { type: 'money' }),
  qty_ordered: t(['Qty Ordered', 'Quantity', 'Planned Qty', 'Order Qty'], { type: 'number' }),
  qty_completed: t(['Qty Completed', 'Built', 'Completed Qty', 'Qty Built'], { type: 'number' }),
});
/** NetSuite work order saved search. Written from knowledge of the export; not checked against a live account. */
export const WO_PROFILES = Object.freeze([
  exportProfile('netsuite_work_orders', { work_order: 'Document Number', item: 'Assembly', wo_status: 'Status', release_date: 'Date', due_date: 'End Date', last_activity: 'Last Modified', wip_value: 'WIP Value', qty_ordered: 'Quantity', qty_completed: 'Built' }, { note: 'NetSuite work order saved search: WIP value is a custom column in most accounts.' }),
]);

export const DEFAULTS = Object.freeze({ stale_days: 30, buckets: [30, 60, 90] });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    stale_days: { type: 'integer', minimum: 1, maximum: 3650, description: 'An open work order with WIP and no activity for this many days is flagged as stale' },
    buckets: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 3650 }, minItems: 1, maxItems: 8, description: 'Age bucket edges in days since release' },
  },
});
const CLOSED = /clos|complet|done|finish|cancel/i;

/** Age every work order. Finding codes: closed_with_wip, negative_wip, stale, past_due, over_completed. */
export function wipAging(rows, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf); const edges = [...s.buckets].sort((a, b) => a - b);
  const by = groupBy(rows.filter((r) => str(r.work_order)), (r) => itemKey(r.work_order));
  const items = [...by.values()].map((lines) => {
    const r = lines[0]; const wo = str(r.work_order); const wip = round2(lines.reduce((x, l) => x + (Number(l.wip_value) || 0), 0));
    const st = lines.map((l) => str(l.wo_status)).find(Boolean) || ''; const closed = CLOSED.test(st);
    const age = r.release_date ? daysBetween(r.release_date, today) : null;
    const lastAct = lines.map((l) => l.last_activity).filter(Boolean).sort().pop() || r.release_date || null;
    const idle = lastAct ? daysBetween(lastAct, today) : null;
    const f = [];
    if (closed && wip > 0) f.push(finding('closed_with_wip', wip, `${wo} is ${st.toLowerCase()} but still holds ${wip} of WIP. Close it out or find the missing completion.`));
    if (wip < 0) f.push(finding('negative_wip', null, `${wo} has negative WIP (${wip}): more was relieved than charged. Check completions and backflush.`));
    if (!closed && wip > 0 && idle !== null && idle > s.stale_days) f.push(finding('stale', wip, `${wo} holds ${wip} with no activity for ${idle} days (since ${lastAct}).`));
    if (!closed && r.due_date && r.due_date < today) f.push(finding('past_due', null, `${wo} was due ${r.due_date} (${daysBetween(r.due_date, today)} days ago) and is still open.`, 'watch'));
    if (r.qty_ordered && r.qty_completed > r.qty_ordered) f.push(finding('over_completed', null, `${wo} completed ${r.qty_completed} against ${r.qty_ordered} ordered.`, 'review'));
    return { work_order: wo, item: r.item || '', wo_status: st, release_date: r.release_date, due_date: r.due_date, last_activity: lastAct, age_days: age, idle_days: idle, age_bucket: closed ? 'closed' : agingBucket(age, edges), wip_value: wip, status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.work_order) < itemKey(b.work_order) ? -1 : 1));
  const open = items.filter((i) => i.age_bucket !== 'closed');
  const labels = [...new Set([...edges.map((e, k) => `${k ? edges[k - 1] + 1 : 0}-${e}`), `${edges[edges.length - 1]}+`, 'unknown'])];
  const by_age = labels.map((b) => ({ age_bucket: b, count: open.filter((i) => i.age_bucket === b).length, wip_value: round2(open.filter((i) => i.age_bucket === b).reduce((x, i) => x + i.wip_value, 0)) })).filter((b) => b.count);
  return {
    as_of: today, work_orders: items.length, open: open.length, wip_total: round2(items.reduce((x, i) => x + i.wip_value, 0)),
    stale_wip: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'stale').reduce((y, f) => y + f.amount, 0), 0)),
    closed_wip: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'closed_with_wip').reduce((y, f) => y + f.amount, 0), 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_age, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function wipReviewText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status === 'flag' || i.status === 'review');
  return ['# Work orders holding WIP to review', '', '**To:** [TO CONFIRM production control lead]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `As of ${r.as_of}: ${r.stale_wip} of WIP sits on stale work orders and ${r.closed_wip} on closed ones. Please confirm for each: still running, finish and close, or scrap.`, '',
    '| Work order | Item | Status | WIP | Idle days | Detail |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.work_order} | ${i.item} | ${i.wo_status} | ${i.wip_value} | ${i.idle_days ?? ''} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
