// BOM and routing completeness: made items without a BOM or routing, inactive or unknown components,
// zero quantities, routing steps with no work center or no time, loops.
import { exportProfile, finding, statusOf, tallyFindings, countBy, str, itemKey, groupBy } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const ITEM_FIELDS = Object.freeze({
  item: t(['Item', 'Part', 'Part Number', 'Item No.', 'SKU', 'Product'], { required: true }),
  item_type: t(['Type', 'Item Type', 'Make/Buy', 'Procurement', 'Source', 'Part Type']),
  item_status: t(['Status', 'Item Status', 'Active', 'Lifecycle']),
});
export const BOM_FIELDS = Object.freeze({
  parent: t(['Parent', 'Parent Item', 'Assembly', 'Product', 'BOM Item'], { required: true }),
  component: t(['Component', 'Component Item', 'Child', 'Part number', 'Material'], { required: true }),
  qty_per: t(['Qty Per', 'Quantity Per', 'Quantity', 'Qty'], { type: 'number' }),
});
export const ROUTING_FIELDS = Object.freeze({
  item: t(['Item', 'Part', 'Product', 'Assembly', 'Part Number'], { required: true }),
  operation: t(['Operation', 'Op', 'Oper Num', 'Step', 'Sequence']),
  work_center: t(['Work Center', 'Work Centre', 'Resource', 'Workstation']),
  setup_hours: t(['Setup Hours', 'Setup Hrs', 'Setup Time'], { type: 'number' }),
  run_hours: t(['Run Hours', 'Run Hrs', 'Run Time', 'Hours per Unit', 'Cycle Time'], { type: 'number' }),
});
/** MRPeasy bills of materials. Written from knowledge of the export; not checked against a live account. */
export const BOM_PROFILES = Object.freeze([
  exportProfile('mrpeasy_boms', { parent: 'Product', component: 'Part number', qty_per: 'Quantity' }, { note: 'MRPeasy bills of materials export: one row per part of a BOM.' }),
]);

export const DEFAULTS = Object.freeze({ make_words: ['make', 'manufactured', 'assembly', 'subassembly', 'produced'], buy_words: ['buy', 'purchased', 'purchase', 'bought'], inactive_words: ['obsolete', 'inactive', 'discontinued', 'blocked', 'no', 'false'] });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    make_words: { type: 'array', items: { type: 'string' }, description: 'Item type words that mean the item is made in house (needs a BOM and a routing)' },
    buy_words: { type: 'array', items: { type: 'string' }, description: 'Item type words that mean the item is bought (should not carry a BOM)' },
    inactive_words: { type: 'array', items: { type: 'string' }, description: 'Status words that mean an item is no longer used' },
  },
});
const has = (words, v) => { const s = str(v).toLowerCase(); return !!s && words.some((w) => s === w.toLowerCase() || s.split(/[\s/-]+/).includes(w.toLowerCase())); };

/** Check the item master, BOMs and routings. Finding codes: no_bom, no_routing, component_inactive, component_unknown, zero_qty, routing_no_work_center, routing_no_time, buy_with_bom, circular_bom, parent_unknown. */
export function bomGaps({ items, bom, routings }, s = DEFAULTS) {
  const M = new Map(items.filter((i) => str(i.item)).map((i) => [itemKey(i.item), i]));
  const B = groupBy(bom.filter((r) => str(r.parent) && str(r.component)), (r) => itemKey(r.parent));
  const RT = groupBy(routings.filter((r) => str(r.item)), (r) => itemKey(r.item));
  const make = (k) => M.has(k) && has(s.make_words, M.get(k).item_type);
  const keys = [...new Set([...[...M.keys()].filter((k) => make(k) || B.has(k)), ...B.keys()])].sort();
  const loopOf = (k) => { const seen = new Set(); const walk = (x, path) => { if (path.includes(x)) return [...path.slice(path.indexOf(x)), x]; if (seen.has(x)) return null; seen.add(x); for (const l of B.get(x) || []) { const r = walk(itemKey(l.component), [...path, x]); if (r) return r; } return null; }; return walk(k, []); };
  const list = keys.map((k) => {
    const m = M.get(k); const name = m ? str(m.item) : str(B.get(k)[0].parent); const f = [];
    if (!m) f.push(finding('parent_unknown', null, `${name} has a BOM but is not in the item master.`, 'review'));
    if (m && has(s.inactive_words, m.item_status)) return null;
    if (make(k) && !B.has(k)) f.push(finding('no_bom', null, `${name} is a made item with no bill of materials: a work order for it would issue no material.`));
    if (make(k) && !RT.has(k)) f.push(finding('no_routing', null, `${name} is a made item with no routing: no labor or machine time would be planned or costed.`));
    if (m && has(s.buy_words, m.item_type) && B.has(k)) f.push(finding('buy_with_bom', null, `${name} is a bought item but has a BOM; check the make/buy setting.`, 'watch'));
    for (const l of B.get(k) || []) {
      const ck = itemKey(l.component); const c = M.get(ck);
      if (!c) f.push(finding('component_unknown', null, `Component ${l.component} of ${name} is not in the item master.`, 'review'));
      else if (has(s.inactive_words, c.item_status)) f.push(finding('component_inactive', null, `Component ${l.component} of ${name} is ${str(c.item_status).toLowerCase()}.`));
      if (!(Number(l.qty_per) > 0)) f.push(finding('zero_qty', null, `Component ${l.component} of ${name} has quantity ${l.qty_per ?? 'blank'}.`));
    }
    for (const r of RT.get(k) || []) {
      const op = str(r.operation) || '?';
      if (!str(r.work_center)) f.push(finding('routing_no_work_center', null, `Operation ${op} of ${name} has no work center.`, 'review'));
      if (!((Number(r.setup_hours) || 0) + (Number(r.run_hours) || 0) > 0)) f.push(finding('routing_no_time', null, `Operation ${op} of ${name} has no setup or run time.`, 'review'));
    }
    const loop = B.has(k) ? loopOf(k) : null; if (loop && loop[0] === k) f.push(finding('circular_bom', null, `The BOM of ${name} loops: ${loop.join(' > ')}.`));
    return { item: name, item_type: m ? str(m.item_type) : '', components: (B.get(k) || []).length, operations: (RT.get(k) || []).length, status: statusOf(f), findings: f };
  }).filter(Boolean);
  return {
    items_checked: list.length, items_in_master: M.size, bom_lines: bom.length, routing_steps: routings.length,
    flag: list.filter((i) => i.status === 'flag').length, review: list.filter((i) => i.status === 'review').length, watch: list.filter((i) => i.status === 'watch').length, ok: list.filter((i) => i.status === 'ok').length,
    by_finding: tallyFindings(list), by_status: countBy(list), items: list,
  };
}

export function fixListText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status !== 'ok').flatMap((i) => i.findings.map((f) => ({ i, f })));
  return ['# Item master, BOM and routing fixes', '', '**To:** [TO CONFIRM engineering or ERP data owner]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `${r.flag} item(s) cannot be built or costed as set up and ${r.review} need a look. Please fix in the ERP and re-export, then run the check again.`, '',
    '| Item | Problem | Detail |', '| --- | --- | --- |', ...rows.map(({ i, f }) => `| ${i.item} | ${f.code} | ${f.detail} |`)].join('\n');
}
