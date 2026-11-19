import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { ITEM_FIELDS, ENTRY_FIELDS, ITEM_PROFILES, DEFAULTS, SETTINGS_SCHEMA, htsCodes, brokerQueryText } from './hts.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  items: { type: 'string', description: 'Item master under --root: item, description, tariff (HTS) code, country of origin, supplier' },
  entries: { type: 'string', description: 'Optional customs entry lines under --root: line, item, tariff code declared, origin, duty rate % and entered value' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'hts',
  description: 'Checks tariff (HTS) codes and countries of origin for consistency: items with no code or a malformed one, codes not in your own list, missing origins, items with the same description under different headings, and entry lines that declared another code, another origin or a different duty rate than your list. Drafts questions for your customs broker. Gives no classification advice and files nothing.',
  args, required: ['items'],
  sources: { items: { label: 'Item master', args: ['items'], fields: ITEM_FIELDS, profiles: ITEM_PROFILES }, entries: { label: 'Customs entry lines', args: ['entries'], fields: ENTRY_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => htsCodes({ items: read('items'), entries: read('entries') }, s),
  line: (r) => `${r.items_checked} item(s), ${r.entry_lines} entry line(s): ${r.flag} with a missing or conflicting code or duty, ${r.review} to check, ${r.watch} to watch, ${r.ok} consistent; duty differences ${r.duty_difference}.${r.entry_items_not_in_master.length ? ` ${r.entry_items_not_in_master.length} entered item(s) not in the item master.` : ''}`,
  item: { key: 'item', arg: 'item', label: 'item' },
  check: { title: 'Check tariff code consistency', description: 'Flags items with no tariff code, entry lines declared under another code than the item master and duty rates that differ from your own list; reviews malformed codes, codes not in your list, missing or conflicting origins; lists items with the same description under different headings. It compares your own records only.' },
  report: {
    base: 'hts-codes', title: 'Tariff code consistency',
    rows: (r) => r.items.map((i) => ({ item: i.item, description: i.description, hts_code: i.hts_code, country_of_origin: i.country_of_origin, supplier: i.supplier, entry_lines: i.entry_lines, duty_difference: i.duty_difference, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['item', 'description', 'hts_code', 'country_of_origin', 'entry_lines', 'duty_difference', 'status', 'reasons'],
    sections: (r) => [{ title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['This compares your own records with each other and with your own list. It does not classify goods, does not know current tariff schedules or extra duties, and is not customs advice; your broker decides.'],
  },
  draft: {
    noun: 'broker_query', verb: 'send', category: 'binding_send', actor: 'the trade compliance lead',
    description: 'Write drafts/broker_query-open.md: every item whose code, origin or duty conflicts, as questions for the customs broker. Marked DRAFT. Sending goes through hts_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name and company' } },
    build: (r, a) => { if (r.flag + r.review === 0) throw new Error('every item is consistent'); return { id: 'open', text: brokerQueryText(r, a), amount: r.duty_difference }; },
  },
  refused: [
    { name: 'customs_filing_submit', category: 'binding_send', description: 'Never files or amends a customs entry or a post-summary correction.' },
    { name: 'erp_write_item_master', category: 'production_deploy', description: 'Never changes tariff codes or origins in the item master.' },
  ],
  prompt: { name: 'hts_review', title: 'Check tariff code consistency', text: 'You are helping a trade compliance or purchasing lead with fairmake-hts-codes. Call hts_check with the item master and any entry lines. Lead with items with no code and entries declared under another code or rate, then missing origins. Never suggest a classification: offer hts_draft_broker_query so the broker answers.' },
});

export const DEMO = {
  intro: 'Fairmake HTS Codes demo: nine fictional items and six fictional entry lines.',
  files: { items: 'items.csv', entries: 'entries.csv', settings: 'settings.json' },
  explain: { item: 'BOLT-M8' },
  draft: { from: 'Taylor Trade (fictional)' },
};
