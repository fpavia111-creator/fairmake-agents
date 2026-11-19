import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { BOM_FIELDS, PRICE_FIELDS, ITEM_FIELDS, BOM_PROFILES, DEFAULTS, SETTINGS_SCHEMA, rollup, proposalText } from './rollup.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  bom: { type: 'string', description: 'Bill of materials export under --root: parent, component, quantity per and optional scrap %' },
  prices: { type: 'string', description: 'Latest purchase prices under --root: item, price and price date' },
  items: { type: 'string', description: 'Item master under --root: item, standard cost and optional conversion (labor and overhead) cost per unit' },
  as_of: { type: 'string', format: 'date', description: 'Date to measure price age from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'rollup',
  description: 'Rebuilds every assembly\'s cost from its bill of materials and the latest purchase prices, compares it with the standard cost, flags assemblies whose cost has moved past the threshold, lists missing and stale prices and loops in the structure, and drafts proposed standards. Loads nothing into the ERP.',
  args, required: ['bom', 'prices', 'items'],
  sources: { bom: { label: 'Bill of materials', args: ['bom'], fields: BOM_FIELDS, profiles: BOM_PROFILES }, prices: { label: 'Purchase prices', args: ['prices'], fields: PRICE_FIELDS }, items: { label: 'Item master', args: ['items'], fields: ITEM_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => rollup({ bom: read('bom'), prices: read('prices'), items: read('items') }, s, a.as_of),
  line: (r) => `${r.assemblies} assembly(ies) rolled up as of ${r.as_of}, ${r.complete} complete: ${r.flag} up past the threshold, ${r.review} to review, ${r.watch} to watch, ${r.ok} in line with standard.`,
  item: { key: 'item', arg: 'item', label: 'assembly' },
  check: { title: 'Roll up BOM costs against standard', description: 'Rebuild each assembly\'s cost from its bill of materials (quantity per, scrap %) and the latest purchase price of every bought component, plus its own conversion cost, and compare with the standard. Flags cost moved up past the threshold, lists components with no price, prices older than the stale limit and loops in the structure.' },
  report: {
    base: 'bom-cost-rollup', title: 'BOM cost roll-up',
    rows: (r) => r.items.map((i) => ({ item: i.item, components: i.components, std_cost: i.std_cost, rolled_cost: i.rolled_cost, change_pct: i.change_pct, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['item', 'std_cost', 'rolled_cost', 'change_pct', 'status', 'reasons'],
    sections: (r) => [{ title: 'Proposed standards', rows: r.proposed, columns: ['item', 'std_cost', 'rolled_cost', 'change_pct'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['The roll-up uses the latest price in your prices file for each bought component, and your conversion cost per unit for each assembly. It does not cost routings itself.'],
  },
  draft: {
    noun: 'standard_update', verb: 'apply', category: 'production_deploy', actor: 'the cost accountant',
    description: 'Write drafts/standard_update-proposal.md: the proposed standard for every assembly whose complete roll-up moved past the threshold. Marked DRAFT. Approving goes through rollup_request_apply (one click); the cost accountant loads standards in the ERP.',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.proposed.length) throw new Error('no complete roll-up moved past the threshold; there is nothing to propose'); return { id: 'proposal', text: proposalText(r, a) }; },
  },
  refused: [
    { name: 'erp_update_item_master', category: 'production_deploy', description: 'Never changes standard costs, BOMs or items in the ERP.' },
    { name: 'erp_post_revaluation', category: 'move_money', description: 'Never posts an inventory revaluation.' },
  ],
  prompt: { name: 'bom_rollup_review', title: 'Roll up BOM costs', text: 'You are helping a cost accountant with fairmake-bom-cost-rollup. Call rollup_check with the BOM, prices and item master. Lead with assemblies whose cost moved up, then missing and stale prices and BOM loops. Offer rollup_write_report and rollup_draft_standard_update; loading standards is a person\'s job.' },
});

export const DEMO = {
  intro: 'Fairmake BOM Cost Rollup demo: six fictional assemblies and their components, prices as of 2026-11-18.',
  files: { bom: 'bom.csv', prices: 'prices.csv', items: 'items.csv', settings: 'settings.json', as_of: '2026-11-18' },
  explain: { item: 'PUMP-100' },
  draft: { from: 'Casey Controller (fictional)' },
};
