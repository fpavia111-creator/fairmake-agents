import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { PURCHASE_FIELDS, CLAIM_FIELDS, PURCHASE_PROFILES, AGREEMENTS_SCHEMA, DEFAULTS, SETTINGS_SCHEMA, rebateClaims, claimText } from './rebates.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  purchases: { type: 'string', description: 'Purchase lines under --root: line, supplier, item, date, quantity, unit price' },
  agreements: { type: 'string', description: 'Agreements JSON under --root: id, supplier, optional item and contract price, start and end, claim-by date, rebate tiers (min spend, %)' },
  claims: { type: 'string', description: 'Optional rebate credits already received under --root: agreement and amount' },
  as_of: { type: 'string', format: 'date', description: 'Date to measure from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'rebates',
  description: 'Checks purchases against every supplier rebate and price agreement: spend in the period, tier reached, rebate earned against credits received, rebates still to claim after the period ends, claim-by dates passed, spend close to the next tier, and lines paid above the agreed price. Drafts a claim per agreement. Deducts nothing from payments and submits nothing.',
  args, required: ['purchases', 'agreements'],
  sources: { purchases: { label: 'Purchase lines', args: ['purchases'], fields: PURCHASE_FIELDS, profiles: PURCHASE_PROFILES }, claims: { label: 'Rebate credits received', args: ['claims'], fields: CLAIM_FIELDS } },
  configSchemas: { agreements: AGREEMENTS_SCHEMA },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s, ctx }) => rebateClaims({ purchases: read('purchases'), agreements: ctx.readJson(a.agreements, 'agreements').agreements, claims: read('claims') }, s, a.as_of),
  line: (r) => `${r.agreements} agreement(s), ${r.spend_covered} of spend covered as of ${r.as_of}: ${r.to_claim} of rebate to claim, ${r.overpaid} paid above agreed prices. ${r.flag} to claim, ${r.review} past the claim date, ${r.watch} accruing or near a tier, ${r.ok} settled.`,
  item: { key: 'agreement', arg: 'agreement', label: 'agreement' },
  check: { title: 'Check rebates and price agreements', description: 'For each agreement: purchases in its period (by supplier and, if set, item), the tier reached and rebate earned, credits received, and lines above the agreed price. Flags rebates still unclaimed after the period and overpayments; reviews claim-by dates passed; lists rebates accruing and spend close to the next tier.' },
  report: {
    base: 'rebate-claims', title: 'Rebates and price agreements',
    rows: (r) => r.items.map((i) => ({ agreement: i.agreement, supplier: i.supplier, item: i.item, period: i.period, spend: i.spend, tier_pct: i.tier_pct, earned: i.earned, claimed: i.claimed, to_claim: i.to_claim, overpaid: i.overpaid, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['agreement', 'supplier', 'period', 'spend', 'tier_pct', 'earned', 'claimed', 'to_claim', 'overpaid', 'status'],
    sections: (r) => [{ title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Spend is quantity times price on your purchase lines inside each agreement\'s dates; returns and credit notes count only if they are in the file as negative lines.'],
  },
  draft: {
    noun: 'rebate_claim', verb: 'send', category: 'binding_send', actor: 'the buyer',
    description: 'Write drafts/rebate_claim-<agreement>.md: the rebate earned, credited and still due, plus overpayment against the agreed price, asking the supplier for a credit note. Marked DRAFT. Sending goes through rebates_request_send (one click).',
    required: ['purchases', 'agreements', 'agreement'],
    args: { agreement: { type: 'string', description: 'Agreement id from the agreements file' }, from: { type: 'string', description: 'Your name and company' } },
    build: (r, a) => {
      const i = r.items.find((x) => itemKey(x.agreement) === itemKey(a.agreement));
      if (!i) throw new Error(`agreement "${String(a.agreement).slice(0, 80)}" is not in the agreements file`);
      if (!(i.to_claim > 0 || i.overpaid > 0)) throw new Error(`nothing to claim under ${i.agreement}`);
      return { id: i.agreement, text: claimText(i, a), amount: Math.round((i.to_claim + i.overpaid) * 100) / 100 };
    },
  },
  refused: [
    { name: 'ap_deduct_from_payment', category: 'move_money', description: 'Never short-pays or deducts from a supplier payment.' },
    { name: 'supplier_portal_submit', category: 'binding_send', description: 'Never submits a claim in a supplier portal.' },
  ],
  prompt: { name: 'rebate_review', title: 'Check rebates and price agreements', text: 'You are helping a buyer or controller with fairmake-rebate-claims. Call rebates_check with purchase lines, the agreements file and any credits received. Lead with rebates still to claim and overpayments, then claim-by dates passed and spend close to the next tier. Offer rebates_write_report and, per agreement, rebates_draft_rebate_claim.' },
});

function itemKey(v) { return String(v ?? '').trim().toUpperCase(); }

export const DEMO = {
  intro: 'Fairmake Rebate Claims demo: four fictional supplier agreements and a year of purchase lines, as of 2026-11-18.',
  files: { purchases: 'purchases.csv', agreements: 'agreements.json', claims: 'claims.csv', settings: 'settings.json', as_of: '2026-11-18' },
  explain: { agreement: 'NWM-2026' },
  draft: { agreement: 'NWM-2026', from: 'Robin Buyer (fictional)' },
};
