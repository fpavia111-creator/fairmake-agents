import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { CONSUME_FIELDS, RECEIPT_FIELDS, SHIP_FIELDS, CONSUME_PROFILES, traceability, traceGapsText } from './trace.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  consumption: { type: 'string', description: 'Material issues to production under --root: record, work order, finished lot, component, component lot, quantity, date' },
  receipts: { type: 'string', description: 'Received lots under --root: lot, item, receipt date, supplier' },
  shipments: { type: 'string', description: 'Shipments under --root: shipment, customer, item, lot or serial number, ship date, quantity' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'trace',
  description: 'Follows lots and serial numbers from receipt, through production, to shipment and names every break: material issued with no lot or to no finished lot, component lots never received, lots used before they were received, shipments with no lot, lots shipped that were never produced or received, and serial numbers shipped twice. Drafts the gap list for quality. Changes no lot record and tells no customer.',
  args, required: ['consumption', 'receipts', 'shipments'],
  sources: { consumption: { label: 'Material issues', args: ['consumption'], fields: CONSUME_FIELDS, profiles: CONSUME_PROFILES }, receipts: { label: 'Received lots', args: ['receipts'], fields: RECEIPT_FIELDS }, shipments: { label: 'Shipments', args: ['shipments'], fields: SHIP_FIELDS } },
  run: ({ read }) => traceability({ consumption: read('consumption'), receipts: read('receipts'), shipments: read('shipments') }),
  line: (r) => `${r.finished_lots} finished lot(s), ${r.consumption_records} issue record(s), ${r.receipts} received lot(s), ${r.shipments} shipment line(s): ${r.flag} break(s) in the chain, ${r.review} to check, ${r.ok} clean.`,
  item: { key: 'reference', arg: 'reference', label: 'lot or shipment' },
  check: { title: 'Check lot and serial traceability', description: 'Link received lots to the finished lots they went into and the shipments that carried them. Flags issues with no component lot or no finished lot, lots used before receipt, shipments with no lot, shipped lots never produced or received and serials on two shipments; reviews component lots missing from receipts.' },
  report: {
    base: 'lot-traceability', title: 'Lot and serial traceability',
    rows: (r) => r.items.map((i) => ({ reference: i.reference, kind: i.kind, work_order: i.work_order, components: i.components, shipments: i.shipments, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['reference', 'kind', 'work_order', 'components', 'shipments', 'status', 'reasons'],
    sections: (r) => [{ title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['A serial is taken to be shipped twice when the same number appears on two shipment lines of quantity one; lots shipped in several parts are not flagged.'],
  },
  draft: {
    noun: 'trace_gaps', verb: 'send', category: 'binding_send', actor: 'the quality manager',
    description: 'Write drafts/trace_gaps-open.md: every break in the lot chain, for the quality manager to fix at the source. Marked DRAFT. Sending goes through trace_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review === 0) throw new Error('the chain has no breaks'); return { id: 'open', text: traceGapsText(r, a) }; },
  },
  refused: [
    { name: 'erp_edit_lot_history', category: 'production_deploy', description: 'Never edits lot, serial or genealogy records.' },
    { name: 'recall_notice_send', category: 'binding_send', description: 'Never sends a recall or customer notice.' },
  ],
  prompt: { name: 'traceability_review', title: 'Check lot and serial traceability', text: 'You are helping a quality manager with fairmake-lot-traceability. Call trace_check with material issues, received lots and shipments. Lead with breaks that would stop a trace (no lot, unknown shipped lots, serials shipped twice, lots used before receipt), then lots to check. Offer trace_write_report and trace_draft_trace_gaps. Recalls and record changes are refused.' },
});

export const DEMO = {
  intro: 'Fairmake Lot Traceability demo: fictional receipts, production issues and shipments for a small assembly line.',
  files: { consumption: 'consumption.csv', receipts: 'receipts.csv', shipments: 'shipments.csv' },
  explain: { reference: 'FG-1002' },
  draft: { from: 'Quinn Quality (fictional)' },
};
