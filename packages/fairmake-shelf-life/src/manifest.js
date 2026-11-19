import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { LOT_FIELDS, SHIP_FIELDS, LOT_PROFILES, DEFAULTS, SETTINGS_SCHEMA, shelfLife, dispositionText } from './shelf.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  lots: { type: 'string', description: 'Lots on hand under --root: lot, item, location, quantity, manufacture and expiry dates, unit cost' },
  shipments: { type: 'string', description: 'Optional shipments by lot under --root: shipment, customer, item, lot, ship date and quantity' },
  as_of: { type: 'string', format: 'date', description: 'Date to measure from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'shelf_life',
  description: 'Checks every lot\'s expiry date: flags expired stock on hand and shipments that went out expired or with less shelf life than the customer requires, reviews lots with no expiry date and shipments that skipped an older lot (first-expired-first-out), lists lots expiring soon, writes an expiry calendar and drafts a disposition list. Ships, scraps and tells customers nothing.',
  args, required: ['lots'],
  sources: { lots: { label: 'Lots on hand', args: ['lots'], fields: LOT_FIELDS, profiles: LOT_PROFILES }, shipments: { label: 'Shipments by lot', args: ['shipments'], fields: SHIP_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => shelfLife({ lots: read('lots'), shipments: read('shipments') }, s, a.as_of),
  line: (r) => `${r.lots} lot(s) as of ${r.as_of}: ${r.expired_value} expired on hand, ${r.expiring_soon} expiring soon. ${r.flag} to act on, ${r.review} to review, ${r.watch} to watch, ${r.ok} fine.`,
  item: { key: 'lot', arg: 'lot', label: 'lot' },
  check: { title: 'Check shelf life and expiry', description: 'For each lot: flags expired stock on hand, shipments made after expiry and shipments with fewer days left than the customer\'s minimum; reviews lots with no expiry date and shipments that took a newer lot while an older one was in stock; lists lots expiring within the warning window.' },
  report: {
    base: 'shelf-life', title: (r) => `Shelf life and expiry as of ${r.as_of}`,
    rows: (r) => r.items.map((i) => ({ lot: i.lot, item: i.item, location: i.location, on_hand: i.on_hand, expiry_date: i.expiry_date, days: i.days_left, value: i.value, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['lot', 'item', 'location', 'on_hand', 'expiry_date', 'days', 'value', 'status', 'reasons'],
    sections: (r) => [{ title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['First-expired-first-out is checked against lots still on hand today; stock that was in a lot at shipment and has since gone is not reconstructed.'],
    ics: (r) => ({ calName: 'Lot expiry dates', events: r.items.filter((i) => i.on_hand > 0 && i.expiry_date && i.expiry_date >= r.as_of).map((i) => ({ uid: `lot-${i.lot}-${i.expiry_date}@fairmake`, date: i.expiry_date, summary: `Lot expires: ${i.lot} ${i.item}`.trim(), description: `Written by fairmake-shelf-life. ${i.on_hand} on hand.`, reminders: [14] })) }),
  },
  draft: {
    noun: 'disposition_request', verb: 'send', category: 'binding_send', actor: 'the quality manager',
    description: 'Write drafts/disposition_request-open.md: expired and problem lots with the shipments involved, for quality and inventory to disposition. Marked DRAFT. Sending goes through shelf_life_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review === 0) throw new Error('no lot needs a disposition'); return { id: 'open', text: dispositionText(r, a), amount: r.expired_value }; },
  },
  refused: [
    { name: 'erp_scrap_inventory', category: 'move_money', description: 'Never scraps or writes off a lot.' },
    { name: 'wms_release_shipment', category: 'production_deploy', description: 'Never releases, holds or changes a shipment or lot status in the WMS.' },
  ],
  prompt: { name: 'shelf_life_review', title: 'Review shelf life and expiry', text: 'You are helping a quality or inventory manager with fairmake-shelf-life. Call shelf_life_check with lots and shipments, as_of today. Lead with expired stock on hand and shipments that went out expired or short-dated, then lots with no expiry and first-expired-first-out misses. Offer shelf_life_write_report (with an expiry calendar) and shelf_life_draft_disposition_request.' },
});

export const DEMO = {
  intro: 'Fairmake Shelf Life demo: eight fictional lots and five shipments, as of 2026-11-18.',
  files: { lots: 'lots.csv', shipments: 'shipments.csv', settings: 'settings.json', as_of: '2026-11-18' },
  explain: { lot: 'L-2602' },
  draft: { from: 'Quinn Quality (fictional)' },
};
