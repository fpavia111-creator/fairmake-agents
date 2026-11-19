import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows, partyIs } from 'fairmake-core';
import { DEDUCTION_FIELDS, SHIP_FIELDS, DEDUCTION_PROFILES, DEFAULTS, SETTINGS_SCHEMA, deductions, disputeText } from './deductions.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  deductions: { type: 'string', description: 'Deductions and chargebacks from remittances under --root: id, customer, date, amount, reason code, invoice, description' },
  shipments: { type: 'string', description: 'Optional shipment evidence by invoice under --root: ship date and time, ASN sent time, clean POD (yes/no), quantities shipped and invoiced' },
  as_of: { type: 'string', format: 'date', description: 'Date to measure dispute windows from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'deductions',
  description: 'Sorts every customer deduction and retailer chargeback by reason, checks late-ASN fines and shortage claims against your shipment records, flags the ones your records contradict, gives each a dispute-by date, reviews unknown reasons and missing invoices, lists small ones as write-off candidates, writes a dispute calendar and drafts a dispute per customer. Writes nothing off and submits nothing.',
  args, required: ['deductions'],
  sources: { deductions: { label: 'Deductions and chargebacks', args: ['deductions'], fields: DEDUCTION_FIELDS, profiles: DEDUCTION_PROFILES }, shipments: { label: 'Shipment evidence', args: ['shipments'], fields: SHIP_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => deductions({ rows: read('deductions'), shipments: read('shipments') }, s, a.as_of),
  line: (r) => `${r.deductions} deduction(s), ${r.amount} in total as of ${r.as_of}: ${r.disputable_open} disputable inside the window, ${r.disputable_lost} disputable but past it. ${r.flag} to dispute, ${r.review} to look into, ${r.watch} closed or small, ${r.ok} accepted.`,
  item: { key: 'deduction', arg: 'deduction', label: 'deduction' },
  check: { title: 'Check customer deductions and chargebacks', description: 'Classify each deduction by reason code, compute its dispute-by date from the customer\'s window, and check late-ASN fines against the ASN time and shortage claims against a clean POD and shipped quantity. Flags deductions your records contradict; reviews unknown reasons, missing invoices and categories that need documents; lists closed windows and small amounts.' },
  report: {
    base: 'retailer-deductions', title: 'Customer deductions and chargebacks',
    rows: (r) => r.items.map((i) => ({ deduction: i.deduction, customer: i.customer, deduction_date: i.deduction_date, amount: i.amount, reason_code: i.reason_code, category: i.category, reference: i.reference, dispute_by: i.dispute_by, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['deduction', 'customer', 'amount', 'category', 'reference', 'dispute_by', 'status', 'reasons'],
    sections: (r) => [{ title: 'By customer', rows: r.by_customer, columns: ['customer', 'deductions', 'amount', 'disputable'] }, { title: 'By reason', rows: r.by_reason, columns: ['reason', 'deductions', 'amount', 'disputable'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Dispute windows and reason codes come from your settings, written from your trading partner terms; the agent does not know any retailer\'s current rules.'],
    ics: (r) => ({ calName: 'Deduction dispute deadlines', events: r.items.filter((i) => i.status === 'flag' && i.dispute_by).map((i) => ({ uid: `ded-${i.deduction}@fairmake`, date: i.dispute_by, summary: `Dispute deadline: ${i.customer} ${i.deduction} (${i.amount})`, description: 'Written by fairmake-retailer-deductions.', reminders: [5] })) }),
  },
  draft: {
    noun: 'dispute', verb: 'send', category: 'binding_send', actor: 'the AR or deductions specialist',
    description: 'Write drafts/dispute-<customer>.md: one customer\'s deductions that your records contradict and that are still inside the window, with the evidence. Marked DRAFT. Sending goes through deductions_request_send (one click); a person submits it on the retailer portal.',
    required: ['deductions', 'customer'],
    args: { customer: { type: 'string', description: 'Customer or retailer as it appears in the deductions' }, from: { type: 'string', description: 'Your name and company' }, vendor_number: { type: 'string', description: 'Your vendor number with that customer' } },
    build: (r, a) => {
      const is = partyIs(a.customer); const mine = r.items.filter((i) => is(i.customer));
      if (!mine.length) throw new Error(`no deductions for customer "${String(a.customer).slice(0, 80)}"`);
      const d = disputeText(mine, { customer: mine[0].customer, from: a.from, vendor_number: a.vendor_number });
      if (!d.rows.length) throw new Error(`nothing to dispute with ${mine[0].customer} inside the window`);
      return { id: mine[0].customer, text: d.text, amount: d.total };
    },
  },
  refused: [
    { name: 'ar_write_off', category: 'move_money', description: 'Never writes off or accepts a deduction in AR.' },
    { name: 'retailer_portal_submit', category: 'binding_send', description: 'Never logs in to or submits disputes on a retailer portal.' },
  ],
  prompt: { name: 'deduction_review', title: 'Review customer deductions', text: 'You are helping an AR or deductions specialist at a supplier with fairmake-retailer-deductions. Call deductions_check with the deductions and shipment evidence, as_of today. Lead with disputable amounts still inside the window and their deadlines, then deductions needing documents. Offer deductions_write_report (with a deadline calendar) and, per customer, deductions_draft_dispute. Write-offs are a person\'s decision.' },
});

export const DEMO = {
  intro: 'Fairmake Retailer Deductions demo: nine fictional deductions from three fictional retailers, as of 2026-11-18.',
  files: { deductions: 'deductions.csv', shipments: 'shipments.csv', settings: 'settings.json', as_of: '2026-11-18' },
  explain: { deduction: 'D-9001' },
  draft: { customer: 'Example Mart', from: 'Alex AR (fictional)' },
};
