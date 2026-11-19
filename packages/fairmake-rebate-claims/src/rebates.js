// Rebate and price agreement claims: spend against each agreement's tiers, rebates earned and not claimed, spend
// close to the next tier, and purchases above the agreed price.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, partyKey, groupBy, asOfDate } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const PURCHASE_FIELDS = Object.freeze({
  line: t(['Line', 'Line ID', 'Invoice Line', 'Transaction Line'], { required: true }),
  supplier: t(['Supplier', 'Vendor', 'Vendor Name'], { required: true }),
  item: t(['Item', 'Part', 'Part Number', 'SKU']),
  purchase_date: t(['Date', 'Invoice Date', 'Purchase Date', 'Receipt Date'], { type: 'date' }),
  qty: t(['Qty', 'Quantity'], { type: 'number' }),
  unit_price: t(['Unit Price', 'Rate', 'Price'], { type: 'money' }),
});
export const CLAIM_FIELDS = Object.freeze({
  agreement: t(['Agreement', 'Agreement ID', 'Program', 'Contract'], { required: true }),
  amount: t(['Amount', 'Claimed', 'Claim Amount', 'Credit'], { type: 'money' }),
  claim_date: t(['Claim Date', 'Date', 'Credited On'], { type: 'date' }),
});
/** NetSuite purchase lines. Written from knowledge of the export; not checked against a live account. */
export const PURCHASE_PROFILES = Object.freeze([
  exportProfile('netsuite_purchase_lines', { line: { from: ['Document Number', 'Line ID'], compute: (_r, get) => `${String(get('Document Number') ?? '').trim()}-${String(get('Line ID') ?? '').trim()}` }, supplier: 'Vendor', item: 'Item', purchase_date: 'Date', qty: 'Quantity', unit_price: 'Rate' }, { note: 'NetSuite transaction saved search on vendor bills: one row per line.' }),
]);

export const AGREEMENTS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['agreements'],
  properties: {
    note: { type: 'string' },
    agreements: { type: 'array', maxItems: 500, items: { type: 'object', additionalProperties: false, required: ['id', 'supplier', 'start', 'end'], properties: {
      id: { type: 'string' }, supplier: { type: 'string' }, item: { type: 'string', description: 'Only this item counts (leave out for all items)' },
      start: { type: 'string', format: 'date' }, end: { type: 'string', format: 'date' }, claim_by: { type: 'string', format: 'date' },
      contract_price: { type: 'number', minimum: 0, description: 'Agreed unit price (with item)' },
      tiers: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['min_spend', 'pct'], properties: { min_spend: { type: 'number', minimum: 0 }, pct: { type: 'number', minimum: 0, maximum: 100 } } } },
    } } },
  },
});
export const DEFAULTS = Object.freeze({ near_tier_pct: 10 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: { note: { type: 'string', description: 'Free text for your own records' }, near_tier_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Spend within this percentage below the next tier is listed' } },
});

/** Per agreement. Finding codes: rebate_unclaimed, rebate_accruing, near_next_tier, over_contract_price, claim_window_passed. */
export function rebateClaims({ purchases, agreements, claims }, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf);
  const C = groupBy(claims.filter((c) => str(c.agreement)), (c) => itemKey(c.agreement));
  const items = agreements.map((ag) => {
    const lines = purchases.filter((p) => partyKey(p.supplier) === partyKey(ag.supplier) && (!ag.item || itemKey(p.item) === itemKey(ag.item)) && p.purchase_date && p.purchase_date >= ag.start && p.purchase_date <= ag.end);
    const spend = round2(lines.reduce((x, p) => x + (Number(p.qty) || 0) * (Number(p.unit_price) || 0), 0));
    const tiers = [...(ag.tiers || [])].sort((a, b) => a.min_spend - b.min_spend); const tier = tiers.filter((x) => spend >= x.min_spend).pop() || null; const next = tiers.find((x) => spend < x.min_spend) || null;
    const earned = tier ? round2(spend * tier.pct / 100) : 0; const claimed = round2((C.get(itemKey(ag.id)) || []).reduce((x, c) => x + (Number(c.amount) || 0), 0)); const open = round2(earned - claimed);
    const ended = ag.end < today; const f = [];
    if (open > 0 && ended) f.push(finding('rebate_unclaimed', open, `${ag.id}: ${spend} spent from ${ag.start} to ${ag.end} reaches the ${tier.pct}% tier: ${earned} earned, ${claimed} claimed, ${open} still to claim.`));
    else if (open > 0) f.push(finding('rebate_accruing', null, `${ag.id}: ${spend} spent so far reaches the ${tier.pct}% tier (${earned} earned to date); the period runs to ${ag.end}.`, 'watch'));
    if (open > 0 && ag.claim_by && ag.claim_by < today) f.push(finding('claim_window_passed', null, `${ag.id}: the claim-by date ${ag.claim_by} has passed; ask the supplier whether a late claim is accepted.`, 'review'));
    if (next && !ended && spend >= next.min_spend * (1 - s.near_tier_pct / 100)) f.push(finding('near_next_tier', null, `${ag.id}: ${round2(next.min_spend - spend)} more spend by ${ag.end} reaches the ${next.pct}% tier.`, 'watch'));
    if (ag.contract_price !== undefined && ag.item) {
      const over = lines.filter((p) => p.unit_price > ag.contract_price);
      const amt = round2(over.reduce((x, p) => x + (p.unit_price - ag.contract_price) * (Number(p.qty) || 0), 0));
      if (amt > 0) f.push(finding('over_contract_price', amt, `${ag.id}: ${over.length} purchase line(s) of ${ag.item} above the agreed ${ag.contract_price} (${over.map((p) => `${p.line} at ${p.unit_price}`).join(', ')}): ${amt} overpaid.`));
    }
    return { agreement: ag.id, supplier: ag.supplier, item: ag.item || '', period: `${ag.start} to ${ag.end}`, lines: lines.length, spend, tier_pct: tier ? tier.pct : 0, earned, claimed, to_claim: Math.max(0, open), overpaid: round2(f.filter((x) => x.code === 'over_contract_price').reduce((y, x) => y + x.amount, 0)), status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.agreement) < itemKey(b.agreement) ? -1 : 1));
  return {
    as_of: today, agreements: items.length, purchase_lines: purchases.length, spend_covered: round2(items.reduce((x, i) => x + i.spend, 0)),
    to_claim: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'rebate_unclaimed').reduce((y, f) => y + f.amount, 0), 0)), overpaid: round2(items.reduce((x, i) => x + i.overpaid, 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function claimText(i, { from } = {}) {
  return [`# Rebate and price claim: ${i.agreement}`, '', `**To:** [TO CONFIRM ${i.supplier} rebate or account contact]`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `Under agreement ${i.agreement} (${i.period}) our purchases came to ${i.spend}, which reaches the ${i.tier_pct}% tier.`, '',
    '| Item | Amount |', '| --- | --- |', `| Rebate earned | ${i.earned} |`, `| Already credited | ${i.claimed} |`, `| Rebate to credit | ${i.to_claim} |`, `| Paid above the agreed price | ${i.overpaid} |`, `| **Total requested** | **${round2(i.to_claim + i.overpaid)}** |`, '',
    'Please confirm and issue a credit note. Purchase line detail is attached. [ATTACH purchase line detail]'].join('\n');
}
