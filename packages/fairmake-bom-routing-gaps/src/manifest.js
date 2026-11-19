import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { ITEM_FIELDS, BOM_FIELDS, ROUTING_FIELDS, BOM_PROFILES, DEFAULTS, SETTINGS_SCHEMA, bomGaps, fixListText } from './gaps.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  items: { type: 'string', description: 'Item master under --root: item, type (make or buy) and status' },
  bom: { type: 'string', description: 'Bill of materials export under --root: parent, component and quantity per' },
  routings: { type: 'string', description: 'Routings under --root: item, operation, work center, setup and run hours' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'bom_gaps',
  description: 'Checks that every made item can be built and costed as set up: a bill of materials and a routing, no inactive or unknown components, no zero quantities, a work center and time on every routing step, no loops; drafts a fix list for the ERP data owner. Edits no BOM and releases no work order.',
  args, required: ['items', 'bom', 'routings'],
  sources: { items: { label: 'Item master', args: ['items'], fields: ITEM_FIELDS }, bom: { label: 'Bill of materials', args: ['bom'], fields: BOM_FIELDS, profiles: BOM_PROFILES }, routings: { label: 'Routings', args: ['routings'], fields: ROUTING_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => bomGaps({ items: read('items'), bom: read('bom'), routings: read('routings') }, s),
  line: (r) => `${r.items_checked} made or structured item(s) checked: ${r.flag} cannot be built or costed as set up, ${r.review} to review, ${r.watch} to watch, ${r.ok} complete.`,
  item: { key: 'item', arg: 'item', label: 'item' },
  check: { title: 'Check BOM and routing completeness', description: 'For every made item and every item with a BOM: flags no BOM, no routing, inactive components, zero quantities and loops; reviews components or parents missing from the item master and routing steps with no work center or no time; lists bought items carrying a BOM.' },
  report: {
    base: 'bom-routing-gaps', title: 'BOM and routing completeness',
    rows: (r) => r.items.map((i) => ({ item: i.item, item_type: i.item_type, components: i.components, operations: i.operations, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['item', 'item_type', 'components', 'operations', 'status', 'reasons'],
    sections: (r) => [{ title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['Make, buy and inactive are read from the words in your item master (settings list them). Phantom and alternate BOMs are not told apart.'],
  },
  draft: {
    noun: 'master_data_fix', verb: 'apply', category: 'production_deploy', actor: 'the ERP data owner',
    description: 'Write drafts/master_data_fix-open.md: every item that cannot be built or costed as set up, with the fix needed. Marked DRAFT. Approving goes through bom_gaps_request_apply (one click); a person changes the ERP.',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review === 0) throw new Error('every item is complete'); return { id: 'open', text: fixListText(r, a) }; },
  },
  refused: [
    { name: 'erp_write_bom', category: 'production_deploy', description: 'Never creates or edits BOMs, routings or items in the ERP.' },
    { name: 'erp_release_work_order', category: 'production_deploy', description: 'Never releases or schedules a work order.' },
  ],
  prompt: { name: 'bom_routing_gaps', title: 'Find BOM and routing gaps', text: 'You are helping a manufacturing engineer or ERP owner with fairmake-bom-routing-gaps. Call bom_gaps_check with the item master, BOMs and routings. Lead with made items that cannot be built or costed (no BOM, no routing, inactive components, zero quantities, loops). Offer bom_gaps_write_report and bom_gaps_draft_master_data_fix; editing the ERP is refused.' },
});

export const DEMO = {
  intro: 'Fairmake BOM Routing Gaps demo: a fictional item master with nine made items.',
  files: { items: 'items.csv', bom: 'bom.csv', routings: 'routings.csv', settings: 'settings.json' },
  explain: { item: 'FRAME-20' },
  draft: { from: 'Jamie Engineer (fictional)' },
};
