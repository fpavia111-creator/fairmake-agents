// Slow-moving and obsolete inventory: stock by months since it last moved, months of supply, inactive items still on hand, a reserve proposal.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, groupBy, monthsBetween, asOfDate } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const INV_FIELDS = Object.freeze({
  item: t(['Item', 'Part', 'Part Number', 'SKU', 'Item No.', 'Inventory ID'], { required: true }),
  description: t(['Description', 'Item Description', 'Name']),
  on_hand: t(['On Hand', 'Qty On Hand', 'Quantity', 'In Stock'], { type: 'number' }),
  unit_cost: t(['Unit Cost', 'Avg Cost', 'Average Cost', 'Std Cost', 'Cost'], { type: 'money' }),
  last_used: t(['Last Used', 'Last Issue', 'Last Consumed', 'Last Issue Date'], { type: 'date' }),
  last_sold: t(['Last Sold', 'Last Sale', 'Last Shipped', 'Last Sale Date'], { type: 'date' }),
  usage_12m: t(['Usage 12m', '12 Month Usage', 'Annual Usage', 'Qty Used 12 Months'], { type: 'number' }),
  item_status: t(['Status', 'Item Status', 'Active']),
});
/** QuickBooks Enterprise inventory valuation. Written from knowledge of the report; not checked against a live file. */
export const INV_PROFILES = Object.freeze([
  exportProfile('qbe_inventory_valuation', { item: 'Item', description: 'Description', on_hand: 'On Hand', unit_cost: 'Avg Cost' }, { note: 'QuickBooks Enterprise inventory valuation: no movement dates, so every item is reviewed for missing movement data unless a usage file is joined first.' }),
]);

export const DEFAULTS = Object.freeze({ slow_months: 6, obsolete_months: 12, excess_months: 24, reserve_pct: { obsolete: 100, slow: 25, excess: 50 }, min_value: 50 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    slow_months: { type: 'number', minimum: 1, maximum: 120, description: 'No movement for this many months makes stock slow-moving' },
    obsolete_months: { type: 'number', minimum: 1, maximum: 240, description: 'No movement for this many months (or never) makes stock obsolete' },
    excess_months: { type: 'number', minimum: 1, maximum: 240, description: 'Stock above this many months of supply (at the last 12 months\' usage) is excess' },
    reserve_pct: { type: 'object', additionalProperties: { type: 'number', minimum: 0, maximum: 100 }, description: 'Proposed reserve % by bucket (obsolete, slow, excess)' },
    min_value: { type: 'number', minimum: 0, description: 'Lines worth less than this get no reserve' },
  },
});
const INACTIVE = /obsolete|inactive|discontinued|blocked|^no$|^false$/i;

/** Bucket every item (rows with neither a quantity nor a cost, such as report group headings, and "Total ..." rows are skipped). Finding codes: obsolete, slow_moving, excess, inactive_with_stock, no_movement_data. */
export function obsoleteInventory(rows, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf);
  const items = [...groupBy(rows.filter((r) => str(r.item) && !/^total\b/i.test(str(r.item)) && (r.on_hand !== null || r.unit_cost !== null)), (r) => itemKey(r.item)).values()].map((ls) => {
    const r = ls[0]; const qty = ls.reduce((x, l) => x + (Number(l.on_hand) || 0), 0); const cost = r.unit_cost ?? 0; const value = round2(qty * cost);
    const last = ls.flatMap((l) => [l.last_used, l.last_sold]).filter(Boolean).sort().pop() || null;
    const idle = last ? monthsBetween(last, today) : null; const use = ls.some((l) => l.usage_12m !== null && l.usage_12m !== undefined) ? ls.reduce((x, l) => x + (Number(l.usage_12m) || 0), 0) : null;
    const mos = use ? round2(qty / (use / 12)) : null; const rp = s.reserve_pct || {}; const f = [];
    let bucket = 'active';
    if (qty > 0) {
      if (!last && use === null) { bucket = 'unknown'; f.push(finding('no_movement_data', null, `${r.item}: ${qty} on hand (${value}) and no movement dates or usage in the file.`, 'review')); }
      else if ((idle !== null && idle >= s.obsolete_months) || (!last && use === 0)) bucket = 'obsolete';
      else if (idle !== null && idle >= s.slow_months) bucket = 'slow';
      else if (mos !== null && mos > s.excess_months) bucket = 'excess';
      const big = value >= s.min_value;
      if (bucket === 'obsolete') f.push(finding('obsolete', big ? round2(value * (rp.obsolete ?? 100) / 100) : null, `${r.item}: ${qty} on hand (${value}), ${last ? `no movement since ${last} (${idle} months)` : 'no movement on record'}.`));
      if (bucket === 'slow') f.push(finding('slow_moving', big ? round2(value * (rp.slow ?? 25) / 100) : null, `${r.item}: ${qty} on hand (${value}), last moved ${last} (${idle} months).`, 'review'));
      if (bucket === 'excess') f.push(finding('excess', big ? round2((value * (rp.excess ?? 50) / 100) * (1 - s.excess_months / mos)) : null, `${r.item}: ${qty} on hand is ${mos} months of supply at ${use} a year; ${round2(qty - (use / 12) * s.excess_months)} above ${s.excess_months} months.`, 'watch'));
      if (INACTIVE.test(str(r.item_status))) f.push(finding('inactive_with_stock', null, `${r.item} is ${str(r.item_status).toLowerCase()} in the item master and still holds ${qty} (${value}).`));
    }
    const reserve = round2(f.reduce((x, y) => x + (y.amount || 0), 0));
    return { item: str(r.item), description: str(r.description), on_hand: qty, unit_cost: cost, value, last_moved: last, months_idle: idle, usage_12m: use, months_of_supply: mos, bucket, reserve, status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.item) < itemKey(b.item) ? -1 : 1));
  const order = ['obsolete', 'slow', 'excess', 'unknown', 'active'];
  const by_bucket = order.map((b) => { const xs = items.filter((i) => i.bucket === b); return { bucket: b, items: xs.length, value: round2(xs.reduce((x, i) => x + i.value, 0)), reserve: round2(xs.reduce((x, i) => x + i.reserve, 0)) }; }).filter((b) => b.items);
  return {
    as_of: today, items_checked: items.length, value: round2(items.reduce((x, i) => x + i.value, 0)), proposed_reserve: round2(items.reduce((x, i) => x + i.reserve, 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_bucket, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function reserveText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.reserve > 0);
  return ['# Inventory reserve proposal', '', '**To:** [TO CONFIRM controller]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `As of ${r.as_of}: proposed reserve ${r.proposed_reserve} on ${r.value} of stock, by the percentages in the settings. Sales and engineering should confirm nothing below has a planned use before it is booked; scrapping is a separate decision.`, '',
    '| Item | Description | On hand | Value | Last moved | Bucket | Proposed reserve |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.item} | ${i.description} | ${i.on_hand} | ${i.value} | ${i.last_moved || 'never'} | ${i.bucket} | ${i.reserve} |`)].join('\n');
}
