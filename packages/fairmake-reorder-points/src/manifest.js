import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { ITEM_FIELDS, USAGE_FIELDS, ITEM_PROFILES, DEFAULTS, SETTINGS_SCHEMA, reorderPoints, ropChangeText } from './reorder.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  items: { type: 'string', description: 'Stock status under --root: item, on hand, on order, allocated, safety stock, reorder point, lead time in days, unit cost' },
  usage: { type: 'string', description: 'Optional usage history under --root: item, date and quantity used or sold' },
  as_of: { type: 'string', format: 'date', description: 'Date to measure from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'reorder',
  description: 'Checks stock against safety stock and reorder points: flags stockouts and free stock under safety stock, lists items at their reorder point to order now, and from recent usage and lead times reviews reorder points that no longer fit and items with none. Drafts proposed reorder points. Places no order and changes no setting.',
  args, required: ['items'],
  sources: { items: { label: 'Stock status', args: ['items'], fields: ITEM_FIELDS, profiles: ITEM_PROFILES }, usage: { label: 'Usage history', args: ['usage'], fields: USAGE_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => reorderPoints({ items: read('items'), usage: read('usage') }, s, a.as_of),
  line: (r) => `${r.items_checked} item(s) as of ${r.as_of}: ${r.stockouts} stocked out, ${r.to_order} to order, ${r.flag} short, ${r.review} with reorder points to review, ${r.watch} at the reorder point, ${r.ok} fine.`,
  item: { key: 'item', arg: 'item', label: 'item' },
  check: { title: 'Check safety stock and reorder points', description: 'For each item: available = on hand + on order - allocated. Flags stockouts and free stock under safety stock; lists items at or under their reorder point; with usage history, reviews reorder points more than the threshold away from daily usage times lead time plus safety stock, and items with no reorder point.' },
  report: {
    base: 'reorder-points', title: 'Safety stock and reorder points',
    rows: (r) => r.items.map((i) => ({ item: i.item, on_hand: i.on_hand, on_order: i.on_order, allocated: i.allocated, available: i.available, safety_stock: i.safety_stock, reorder_point: i.reorder_point, proposed_rop: i.proposed_rop, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['item', 'on_hand', 'on_order', 'available', 'safety_stock', 'reorder_point', 'proposed_rop', 'status', 'reasons'],
    sections: (r) => [{ title: 'Proposed reorder points', rows: r.proposed, columns: ['item', 'reorder_point', 'proposed_rop', 'daily_usage', 'lead_time_days'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['Proposed reorder points use average daily usage over the look-back and the lead time on file; they do not model seasonality, demand spikes or supplier variability.'],
  },
  draft: {
    noun: 'rop_change', verb: 'apply', category: 'production_deploy', actor: 'the planning lead',
    description: 'Write drafts/rop_change-proposal.md: the reorder points that no longer fit recent usage and lead time, with the proposed value. Marked DRAFT. Approving goes through reorder_request_apply (one click); a person changes them in the ERP.',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.proposed.length) throw new Error('every reorder point fits recent usage'); return { id: 'proposal', text: ropChangeText(r, a) }; },
  },
  refused: [
    { name: 'erp_create_purchase_order', category: 'move_money', description: 'Never creates or releases a purchase order.' },
    { name: 'supplier_po_send', category: 'binding_send', description: 'Never sends an order to a supplier.' },
  ],
  prompt: { name: 'reorder_point_review', title: 'Review safety stock and reorder points', text: 'You are helping a buyer or planner with fairmake-reorder-points. Call reorder_check with the stock status and usage history. Lead with stockouts and items under safety stock, then items to order now, then reorder points to change. Offer reorder_write_report and reorder_draft_rop_change. Ordering is a person\'s job.' },
});

export const DEMO = {
  intro: 'Fairmake Reorder Points demo: eight fictional items and 90 days of usage, as of 2026-11-18.',
  files: { items: 'items.csv', usage: 'usage.csv', settings: 'settings.json', as_of: '2026-11-18' },
  explain: { item: 'BRG-6204' },
  draft: { from: 'Robin Buyer (fictional)' },
};
