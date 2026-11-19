// Safety stock and reorder points: stockouts, stock under safety stock, items at their reorder point, and reorder points
// that no longer match recent usage and lead time.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, pct, str, itemKey, groupBy, addDays, asOfDate } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const ITEM_FIELDS = Object.freeze({
  item: t(['Item', 'Part', 'Part Number', 'Part No.', 'SKU', 'Item No.'], { required: true }),
  on_hand: t(['On Hand', 'In stock', 'Qty On Hand', 'Quantity'], { type: 'number' }),
  on_order: t(['On Order', 'Expected', 'Incoming', 'Qty On Order'], { type: 'number' }),
  allocated: t(['Allocated', 'Booked', 'Committed', 'Reserved'], { type: 'number' }),
  safety_stock: t(['Safety Stock', 'Min Qty', 'Minimum'], { type: 'number' }),
  reorder_point: t(['Reorder Point', 'ROP', 'Reorder Level'], { type: 'number' }),
  lead_time_days: t(['Lead Time Days', 'Lead time', 'Lead Time', 'Purchase Lead Time'], { type: 'number' }),
  unit_cost: t(['Unit Cost', 'Cost', 'Avg Cost'], { type: 'money' }),
});
export const USAGE_FIELDS = Object.freeze({
  item: t(['Item', 'Part', 'Part Number', 'SKU'], { required: true }),
  usage_date: t(['Date', 'Usage Date', 'Issue Date', 'Transaction Date'], { type: 'date' }),
  qty: t(['Qty', 'Quantity', 'Qty Used', 'Qty Issued'], { type: 'number' }),
});
/** MRPeasy stock items. Written from knowledge of the export; not checked against a live account. */
export const ITEM_PROFILES = Object.freeze([
  exportProfile('mrpeasy_stock_items', { item: 'Part No.', on_hand: 'In stock', on_order: 'Expected', allocated: 'Booked', reorder_point: 'Reorder point', lead_time_days: 'Lead time', unit_cost: 'Cost' }, { note: 'MRPeasy stock items: safety stock is not a separate column, so the reorder point is checked without it.' }),
]);

export const DEFAULTS = Object.freeze({ lookback_days: 90, review_pct: 25 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    lookback_days: { type: 'integer', minimum: 7, maximum: 730, description: 'Days of usage history to average' },
    review_pct: { type: 'number', minimum: 1, maximum: 1000, description: 'A reorder point this far from usage times lead time plus safety stock is listed for review' },
  },
});

/** Reorder status per item. Finding codes: stockout, below_safety_stock, at_reorder_point, rop_stale, no_rop. */
export function reorderPoints({ items, usage }, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf); const from = addDays(today, -s.lookback_days);
  const U = groupBy(usage.filter((u) => str(u.item) && u.usage_date && u.usage_date > from && u.usage_date <= today), (u) => itemKey(u.item));
  const hasUsage = usage.length > 0;
  const list = [...groupBy(items.filter((i) => str(i.item)), (i) => itemKey(i.item)).values()].map((ls) => {
    const r = ls[0]; const oh = r.on_hand ?? 0, oo = r.on_order ?? 0, al = r.allocated ?? 0, ss = r.safety_stock ?? 0;
    const free = round2(oh - al), avail = round2(oh + oo - al); const f = [];
    const daily = hasUsage ? round2((U.get(itemKey(r.item)) || []).reduce((x, u) => x + (Number(u.qty) || 0), 0) / s.lookback_days) : null;
    const proposed = daily !== null && r.lead_time_days ? Math.ceil(daily * r.lead_time_days + ss) : null;
    if (avail <= 0) f.push(finding('stockout', null, `${r.item}: ${oh} on hand, ${al} allocated, ${oo} on order: nothing available${avail < 0 ? ` (${avail})` : ''}.`));
    else if (ss && free < ss) f.push(finding('below_safety_stock', null, `${r.item}: ${free} free stock against safety stock ${ss}${oo ? ` (${oo} on order)` : ''}.`));
    if (avail > 0 && r.reorder_point !== null && r.reorder_point !== undefined && avail <= r.reorder_point) f.push(finding('at_reorder_point', null, `${r.item}: ${avail} available (on hand plus on order less allocated) is at or under the reorder point ${r.reorder_point}. Order now.`, 'watch'));
    if (r.reorder_point === null || r.reorder_point === undefined) f.push(finding('no_rop', null, `${r.item} has no reorder point.`, 'review'));
    else if (proposed !== null && Math.abs(pct(proposed - r.reorder_point, r.reorder_point || 1)) > s.review_pct) f.push(finding('rop_stale', null, `${r.item}: reorder point ${r.reorder_point}, but ${daily} a day over ${s.lookback_days} days times ${r.lead_time_days} days lead time plus safety stock ${ss} gives ${proposed}.`, 'review'));
    return { item: str(r.item), on_hand: oh, on_order: oo, allocated: al, available: avail, safety_stock: ss, reorder_point: r.reorder_point ?? null, lead_time_days: r.lead_time_days ?? null, daily_usage: daily, proposed_rop: proposed, status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.item) < itemKey(b.item) ? -1 : 1));
  return {
    as_of: today, items_checked: list.length, stockouts: list.filter((i) => i.findings.some((f) => f.code === 'stockout')).length, to_order: list.filter((i) => i.findings.some((f) => f.code === 'at_reorder_point' || f.code === 'stockout')).length,
    flag: list.filter((i) => i.status === 'flag').length, review: list.filter((i) => i.status === 'review').length, watch: list.filter((i) => i.status === 'watch').length, ok: list.filter((i) => i.status === 'ok').length,
    proposed: list.filter((i) => i.findings.some((f) => f.code === 'rop_stale')).map((i) => ({ item: i.item, reorder_point: i.reorder_point, proposed_rop: i.proposed_rop, daily_usage: i.daily_usage, lead_time_days: i.lead_time_days })),
    by_finding: tallyFindings(list), by_status: countBy(list), items: list,
  };
}

export function ropChangeText(r, { from } = {}) {
  return ['# Proposed reorder point changes', '', '**To:** [TO CONFIRM purchasing or planning lead]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `From usage over the last period and the lead times on file, as of ${r.as_of}. Check seasonality and open sales orders before loading any of these.`, '',
    '| Item | Current ROP | Proposed ROP | Daily usage | Lead time (days) |', '| --- | --- | --- | --- | --- |', ...r.proposed.map((p) => `| ${p.item} | ${p.reorder_point} | ${p.proposed_rop} | ${p.daily_usage} | ${p.lead_time_days} |`)].join('\n');
}
