import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows, partyIs } from 'fairmake-core';
import { RECEIPT_FIELDS, CERT_FIELDS, RECEIPT_PROFILES, SPECS_SCHEMA, materialCerts, certRequestText } from './certs.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  receipts: { type: 'string', description: 'Receipt lines under --root: receipt, item, lot or heat, supplier, date, certificate id' },
  specs: { type: 'string', description: 'Specs JSON under --root: per item, whether a certificate is required and the min/max of each property' },
  certs: { type: 'string', description: 'Optional certificate values under --root, one row per property: certificate id, lot or heat, property, value' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'certs',
  description: 'Checks material certificates (mill test reports, certificates of conformance) on every receipt against your purchase specs: certificates missing where required, certificates for another lot or heat, properties outside your min/max, properties not reported and certificates not on file. Drafts a certificate request per supplier. Releases no hold and pays nothing.',
  args, required: ['receipts', 'specs'],
  sources: { receipts: { label: 'Receipt lines', args: ['receipts'], fields: RECEIPT_FIELDS, profiles: RECEIPT_PROFILES }, certs: { label: 'Certificate values', args: ['certs'], fields: CERT_FIELDS } },
  configSchemas: { specs: SPECS_SCHEMA },
  run: ({ a, read, ctx }) => materialCerts({ receipts: read('receipts'), certs: read('certs'), specs: ctx.readJson(a.specs, 'specs') }),
  line: (r) => `${r.receipts} receipt line(s), ${r.certificates} certificate(s) on file: ${r.flag} missing, wrong lot or out of spec, ${r.review} incomplete, ${r.watch} with no spec, ${r.ok} in order.`,
  item: { key: 'receipt', arg: 'receipt', label: 'receipt line' },
  check: { title: 'Check material certificates on receipts', description: 'For each receipt line of an item with a spec: flags a missing certificate where one is required, a certificate for another lot or heat and properties outside the spec min/max; reviews properties the certificate does not report and certificate ids not in the certificates file; lists items with no spec. Totals problems by supplier.' },
  report: {
    base: 'material-certs', title: 'Material certificates on receipts',
    rows: (r) => r.items.map((i) => ({ receipt: i.receipt, item: i.item, lot: i.lot, supplier: i.supplier, receipt_date: i.receipt_date, cert_id: i.cert_id, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['receipt', 'item', 'lot', 'supplier', 'cert_id', 'status', 'reasons'],
    sections: (r) => [{ title: 'By supplier', rows: r.by_supplier, columns: ['supplier', 'receipts', 'problems'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['Values are compared with the specs file you supply, not with any material standard; whether material can be used is a quality decision.'],
  },
  draft: {
    noun: 'cert_request', verb: 'send', category: 'binding_send', actor: 'the quality or purchasing lead',
    description: 'Write drafts/cert_request-<supplier>.md: one supplier\'s receipts with missing, wrong-lot or out-of-spec certificates. Marked DRAFT. Sending goes through certs_request_send (one click).',
    required: ['receipts', 'specs', 'supplier'],
    args: { supplier: { type: 'string', description: 'Supplier as it appears in the receipts' }, from: { type: 'string', description: 'Your name and company' } },
    build: (r, a) => {
      const is = partyIs(a.supplier); const mine = r.items.filter((i) => is(i.supplier));
      if (!mine.length) throw new Error(`no receipts for supplier "${String(a.supplier).slice(0, 80)}"`);
      const d = certRequestText(mine, { supplier: mine[0].supplier, from: a.from });
      if (!d.rows.length) throw new Error(`every certificate from ${mine[0].supplier} is in order`);
      return { id: mine[0].supplier, text: d.text };
    },
  },
  refused: [
    { name: 'qms_release_hold', category: 'production_deploy', description: 'Never places or releases a quality hold on received material.' },
    { name: 'ap_pay_invoice', category: 'move_money', description: 'Never pays, holds or short-pays a supplier invoice.' },
  ],
  prompt: { name: 'material_cert_review', title: 'Check material certificates', text: 'You are helping a receiving inspector or quality manager with fairmake-material-certs. Call certs_check with the receipt lines, the specs file and the certificate values. Lead with missing certificates, wrong-lot certificates and out-of-spec values by supplier. Offer certs_write_report and, per supplier, certs_draft_cert_request. Whether material can be used is a person\'s decision.' },
});

export const DEMO = {
  intro: 'Fairmake Material Certs demo: eight fictional receipt lines from four fictional suppliers.',
  files: { receipts: 'receipts.csv', specs: 'specs.json', certs: 'certs.csv' },
  explain: { receipt: 'RC-2002' },
  draft: { supplier: 'Northwind Metals', from: 'Quinn Quality (fictional)' },
};
