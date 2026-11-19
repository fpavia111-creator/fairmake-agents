import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { INV_FIELDS, INV_PROFILES, DEFAULTS, SETTINGS_SCHEMA, obsoleteInventory, reserveText } from './obsolete.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  inventory: { type: 'string', description: 'Inventory on hand under --root: item, quantity, unit cost, last used or sold dates, 12-month usage and item status' },
  as_of: { type: 'string', format: 'date', description: 'Date to age from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'obsolete',
  description: 'Sorts stock on hand into obsolete, slow-moving, excess and active by months since it last moved and months of supply, flags inactive items still holding stock, proposes a reserve by the percentages you set, and drafts the proposal for the controller. Scraps nothing and posts nothing.',
  args, required: ['inventory'],
  sources: { inventory: { label: 'Inventory on hand', args: ['inventory'], fields: INV_FIELDS, profiles: INV_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => obsoleteInventory(read('inventory'), s, a.as_of),
  line: (r) => `${r.items_checked} item(s), ${r.value} on hand as of ${r.as_of}: proposed reserve ${r.proposed_reserve}. ${r.flag} obsolete or inactive, ${r.review} slow or without movement data, ${r.watch} excess, ${r.ok} active.`,
  item: { key: 'item', arg: 'item', label: 'item' },
  check: { title: 'Check slow-moving and obsolete inventory', description: 'For each item on hand, find the last time it moved (used or sold) and its months of supply at the last 12 months\' usage. Flags obsolete stock and inactive items with stock, reviews slow-moving stock and items with no movement data, lists excess stock. Proposes a reserve per bucket; lines below the minimum value get none.' },
  report: {
    base: 'obsolete-inventory', title: (r) => `Slow-moving and obsolete inventory as of ${r.as_of}`,
    rows: (r) => r.items.map((i) => ({ item: i.item, description: i.description, on_hand: i.on_hand, unit_cost: i.unit_cost, value: i.value, last_moved: i.last_moved, months_idle: i.months_idle, months_of_supply: i.months_of_supply, bucket: i.bucket, reserve: i.reserve, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['item', 'description', 'on_hand', 'value', 'last_moved', 'months_idle', 'bucket', 'reserve', 'status'],
    sections: (r) => [{ title: 'By bucket', rows: r.by_bucket, columns: ['bucket', 'items', 'value', 'reserve'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['The reserve is a proposal from the percentages in your settings, not an accounting estimate; your controller and auditor decide what is booked.'],
  },
  draft: {
    noun: 'reserve_proposal', verb: 'approve', category: 'move_money', actor: 'the controller',
    description: 'Write drafts/reserve_proposal-open.md: every item with a proposed reserve, its value, last movement and bucket. Marked DRAFT. Approving goes through obsolete_request_approve (one click); the controller books it.',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.proposed_reserve) throw new Error('no reserve is proposed'); return { id: 'open', text: reserveText(r, a), amount: r.proposed_reserve }; },
  },
  refused: [
    { name: 'erp_scrap_inventory', category: 'move_money', description: 'Never scraps, writes off or disposes of stock.' },
    { name: 'erp_post_journal', category: 'move_money', description: 'Never posts the reserve or any journal.' },
  ],
  prompt: { name: 'obsolete_inventory_review', title: 'Review slow-moving and obsolete stock', text: 'You are helping a controller or materials manager with fairmake-obsolete-inventory. Call obsolete_check on the inventory export with as_of the period end. Lead with the proposed reserve by bucket and the largest obsolete items, then inactive items still holding stock. Offer obsolete_write_report and obsolete_draft_reserve_proposal; booking and scrapping are a person\'s decision.' },
});

export const DEMO = {
  intro: 'Fairmake Obsolete Inventory demo: ten fictional items aged as of 2026-11-30.',
  files: { inventory: 'inventory.csv', settings: 'settings.json', as_of: '2026-11-30' },
  explain: { item: 'VLV-OLD' },
  draft: { from: 'Casey Controller (fictional)' },
};
