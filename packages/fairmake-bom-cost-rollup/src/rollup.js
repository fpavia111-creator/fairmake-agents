// BOM cost roll-up: every assembly's cost rebuilt from its bill of materials and the latest purchase prices,
// compared with its standard cost.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, round4, pct, str, itemKey, groupBy, daysBetween, asOfDate } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const BOM_FIELDS = Object.freeze({
  parent: t(['Parent', 'Parent Item', 'Assembly', 'Product', 'Parent Part', 'BOM Item', 'Product variant code'], { required: true }),
  component: t(['Component', 'Component Item', 'Child', 'Part', 'Material', 'Ingredient', 'Ingredient variant code'], { required: true }),
  qty_per: t(['Qty Per', 'Quantity Per', 'Qty', 'Quantity', 'Usage'], { type: 'number' }),
  scrap_pct: t(['Scrap %', 'Scrap Pct', 'Scrap Percent', 'Scrap Factor'], { type: 'number' }),
});
export const PRICE_FIELDS = Object.freeze({
  item: t(['Item', 'Part', 'Part Number', 'Item No.', 'SKU', 'Component'], { required: true }),
  price: t(['Price', 'Last Price', 'Unit Price', 'Last Purchase Price', 'Purchase Price', 'Cost'], { type: 'money' }),
  price_date: t(['Price Date', 'Date', 'Last Purchase Date', 'Receipt Date', 'Effective Date'], { type: 'date' }),
});
export const ITEM_FIELDS = Object.freeze({
  item: t(['Item', 'Part', 'Part Number', 'Item No.', 'SKU'], { required: true }),
  std_cost: t(['Std Cost', 'Standard Cost', 'Standard', 'Current Cost'], { type: 'money' }),
  conversion_cost: t(['Conversion Cost', 'Labor and Overhead', 'Labor Overhead', 'Routing Cost'], { type: 'money' }),
});
/** Katana recipes (bill of materials). Written from knowledge of the export; not checked against a live account. */
export const BOM_PROFILES = Object.freeze([
  exportProfile('katana_recipes', { parent: 'Product variant code', component: 'Ingredient variant code', qty_per: 'Quantity' }, { note: 'Katana recipes export: one row per ingredient of a product variant; scrap is not in the export.' }),
]);

export const DEFAULTS = Object.freeze({ change_pct: 5, stale_days: 365 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    change_pct: { type: 'number', minimum: 0, maximum: 1000, description: 'A rolled-up cost this far above (or below) the standard is flagged (or listed to watch)' },
    stale_days: { type: 'integer', minimum: 1, maximum: 3650, description: 'A purchase price older than this many days is listed as stale' },
  },
});

/**
 * Roll up every assembly. Finding codes: cost_up, cost_down, missing_price, stale_price, circular_bom, no_standard.
 */
export function rollup({ bom, prices, items }, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf);
  const kids = groupBy(bom.filter((r) => str(r.parent) && str(r.component)), (r) => itemKey(r.parent));
  const latest = new Map();
  for (const p of prices.filter((x) => str(x.item) && x.price !== null)) { const k = itemKey(p.item); const cur = latest.get(k); if (!cur || String(p.price_date || '') > String(cur.price_date || '') || (String(p.price_date || '') === String(cur.price_date || '') && p.price > cur.price)) latest.set(k, p); }
  const master = new Map(items.filter((x) => str(x.item)).map((x) => [itemKey(x.item), x]));
  const memo = new Map();
  function cost(k, stack) {
    if (memo.has(k)) return memo.get(k);
    if (stack.includes(k)) return { cost: 0, missing: [], stale: [], circular: [...stack.slice(stack.indexOf(k)), k] };
    const lines = kids.get(k);
    let out;
    if (lines) {
      let c = Number((master.get(k) || {}).conversion_cost) || 0; const missing = []; const stale = []; let circular = null;
      for (const l of lines) {
        const sub = cost(itemKey(l.component), [...stack, k]);
        c += (Number(l.qty_per) || 0) * (1 + (Number(l.scrap_pct) || 0) / 100) * sub.cost;
        missing.push(...sub.missing); stale.push(...sub.stale); if (sub.circular && !circular) circular = sub.circular;
      }
      out = { cost: round4(c), missing: [...new Set(missing)], stale: [...new Set(stale)], circular };
    } else {
      const p = latest.get(k);
      if (!p) out = { cost: 0, missing: [k], stale: [], circular: null };
      else { const age = p.price_date ? daysBetween(p.price_date, today) : null; out = { cost: p.price, missing: [], stale: age !== null && age > s.stale_days ? [`${k} (${p.price_date})`] : [], circular: null }; }
    }
    if (!stack.length || !out.circular) memo.set(k, out);
    return out;
  }
  const list = [...kids.keys()].sort().map((k) => {
    const name = str(kids.get(k)[0].parent); const r = cost(k, []); const std = (master.get(k) || {}).std_cost ?? null; const f = [];
    if (r.circular) f.push(finding('circular_bom', null, `The bill of materials loops: ${r.circular.join(' > ')}. Fix the structure before trusting any roll-up that uses it.`));
    if (r.missing.length) f.push(finding('missing_price', null, `No purchase price and no bill of materials for ${r.missing.join(', ')}; the roll-up leaves them at zero.`, 'review'));
    if (r.stale.length) f.push(finding('stale_price', null, `Price older than ${s.stale_days} days used for ${r.stale.join(', ')}.`, 'watch'));
    const complete = !r.missing.length && !r.circular;
    let change = null;
    if (std === null || std === 0) f.push(finding('no_standard', null, `${name} has no standard cost; the roll-up gives ${round2(r.cost)}.`, 'review'));
    else if (complete) {
      change = pct(r.cost - std, std);
      if (change > s.change_pct) f.push(finding('cost_up', round2(r.cost - std), `${name} rolls up to ${round2(r.cost)} on today's prices against a standard of ${std} (${change}% up, ${round2(r.cost - std)} a unit).`));
      else if (change < -s.change_pct) f.push(finding('cost_down', null, `${name} rolls up to ${round2(r.cost)} against a standard of ${std} (${-change}% down).`, 'watch'));
    }
    return { item: name, components: kids.get(k).length, std_cost: std, rolled_cost: round2(r.cost), change_pct: change, complete, status: statusOf(f), findings: f };
  });
  return {
    as_of: today, assemblies: list.length, complete: list.filter((i) => i.complete).length,
    flag: list.filter((i) => i.status === 'flag').length, review: list.filter((i) => i.status === 'review').length, watch: list.filter((i) => i.status === 'watch').length, ok: list.filter((i) => i.status === 'ok').length,
    proposed: list.filter((i) => i.findings.some((f) => f.code === 'cost_up' || f.code === 'cost_down')).map((i) => ({ item: i.item, std_cost: i.std_cost, rolled_cost: i.rolled_cost, change_pct: i.change_pct })),
    by_finding: tallyFindings(list), by_status: countBy(list), items: list,
  };
}

/** Proposed standard costs for the assemblies whose roll-up moved past the threshold. */
export function proposalText(r, { from } = {}) {
  return [
    '# Proposed standard cost changes', '',
    `**To:** [TO CONFIRM cost accountant who loads standards]`, `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `Roll-up on purchase prices as of ${r.as_of}. Only complete roll-ups are listed. Load nothing until the prices behind each line are checked.`, '',
    '| Item | Current standard | Rolled-up cost | Change % |', '| --- | --- | --- | --- |',
    ...r.proposed.map((p) => `| ${p.item} | ${p.std_cost} | ${p.rolled_cost} | ${p.change_pct} |`),
  ].join('\n');
}
