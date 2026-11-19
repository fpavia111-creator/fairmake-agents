import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { ORDER_FIELDS, ASN_FIELDS, SHIP_FIELDS, ASN_PROFILES, DEFAULTS, SETTINGS_SCHEMA, rowsFromX12, asnErrors, correctionText } from './asn.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  edi: { type: 'string', description: 'X12 file under --root with the customer\'s 850 purchase orders and your 856 ship notices (instead of orders and asns)' },
  orders: { type: 'string', description: 'Customer purchase order lines under --root (when there is no X12 file): PO, line, item, quantity' },
  asns: { type: 'string', description: 'ASN lines sent under --root (when there is no X12 file): ASN, PO, item, quantity, SSCC, ship date, time sent' },
  shipments: { type: 'string', description: 'Optional shipment records from your ERP or WMS under --root: PO, item, quantity, ship date and time' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'asn',
  description: 'Checks advance ship notices (EDI 856) against the customer\'s purchase orders (850) and your shipment records: shipments with no ASN, ASNs sent late, quantities that differ from what shipped, quantities over the PO, items not on the PO, missing or reused SSCC carton labels. Reads X12 files or CSV. Shows fines at risk from your compliance guide settings and drafts corrections. Transmits nothing.',
  args, required: [],
  sources: { orders: { label: 'Customer PO lines', args: ['orders'], fields: ORDER_FIELDS }, asns: { label: 'ASN lines', args: ['asns'], fields: ASN_FIELDS, profiles: ASN_PROFILES }, shipments: { label: 'Shipment records', args: ['shipments'], fields: SHIP_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s, ctx }) => {
    if (!a.edi && !a.orders && !a.asns) throw new Error('pass edi (an X12 file with 850s and 856s), or orders and asns as tables');
    const x = a.edi ? rowsFromX12(ctx.readText(a.edi)) : { orders: [], asns: [], problems: [] };
    const r = asnErrors({ orders: [...x.orders, ...read('orders')], asns: [...x.asns, ...read('asns')], shipments: read('shipments') }, s);
    return { ...r, x12_problems: x.problems.map((p) => `${p.code}: ${p.message}`) };
  },
  line: (r) => `${r.pos} PO(s), ${r.asns} ASN(s): ${r.flag} with ASN errors${r.fines_at_risk ? ` (${r.fines_at_risk} of fines at risk)` : ''}, ${r.review} to check, ${r.ok} clean.${r.x12_problems.length ? ` ${r.x12_problems.length} X12 envelope problem(s).` : ''}`,
  item: { key: 'po_number', arg: 'po_number', label: 'PO' },
  check: { title: 'Check EDI ship notices', description: 'Per customer PO: flags shipments with no ASN, ASNs sent later than the grace after shipping, ASN quantities that differ from the shipment record or exceed the PO, items not on the PO and SSCC labels reused across ASNs; reviews ASN lines with no SSCC and ASNs for POs not in the file. Reads an X12 file with 850s and 856s, or CSV tables.' },
  report: {
    base: 'edi-asn-errors', title: 'Advance ship notice checks',
    rows: (r) => r.items.map((i) => ({ po_number: i.po_number, ordered: i.ordered, asn_qty: i.asn_qty, shipped: i.shipped, asns: i.asns, fines_at_risk: i.fines_at_risk, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['po_number', 'ordered', 'asn_qty', 'shipped', 'fines_at_risk', 'status', 'reasons'],
    sections: (r) => [{ title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['X12 element positions follow the public 004010 structure as recalled; trading partners differ, so check the first file read with your EDI provider.', 'Fines are the amounts you put in settings from your customer\'s compliance guide; the agent does not know any retailer\'s rules.'],
  },
  draft: {
    noun: 'asn_correction', verb: 'send', category: 'binding_send', actor: 'the EDI coordinator',
    description: 'Write drafts/asn_correction-open.md: every PO with ASN errors, for the EDI coordinator or 3PL to correct and fix at the source. Marked DRAFT. Sending goes through asn_request_send (one click); nothing is transmitted.',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review === 0) throw new Error('no ASN errors'); return { id: 'open', text: correctionText(r, a), amount: r.fines_at_risk }; },
  },
  refused: [
    { name: 'edi_transmit', category: 'binding_send', description: 'Never sends, resends or cancels an EDI document.' },
    { name: 'erp_ship_confirm', category: 'production_deploy', description: 'Never confirms or changes a shipment in the ERP or WMS.' },
  ],
  prompt: { name: 'asn_review', title: 'Check EDI ship notices', text: 'You are helping a supplier\'s EDI coordinator with fairmake-edi-asn-errors. Call asn_check with the X12 file (or the orders and ASN tables) and the shipment records. Lead with shipments with no ASN, late ASNs and quantity mismatches, with fines at risk if settings name them. Offer asn_write_report and asn_draft_asn_correction. Transmitting EDI is refused.' },
});

export const DEMO = {
  intro: 'Fairmake EDI ASN Errors demo: fictional customer POs, ASNs and shipment records.',
  files: { orders: 'orders.csv', asns: 'asns.csv', shipments: 'shipments.csv', settings: 'settings.json' },
  explain: { po_number: 'PO-8002' },
  draft: { from: 'Jordan EDI (fictional)' },
};
