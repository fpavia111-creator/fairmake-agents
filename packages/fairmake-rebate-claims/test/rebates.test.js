// Rebates: tiers, periods, claims received, claim-by dates, near tiers, contract prices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebateClaims, claimText, DEFAULTS } from '../src/index.js';

const p = (line, supplier, purchase_date, qty, unit_price, item = 'X') => ({ line, supplier, item, purchase_date, qty, unit_price });
const ag = (over = {}) => ({ id: 'A1', supplier: 'Sup', start: '2026-01-01', end: '2026-06-30', tiers: [{ min_spend: 1000, pct: 1 }, { min_spend: 5000, pct: 3 }], ...over });
const run = (purchases, agreements, claims = [], s = DEFAULTS) => rebateClaims({ purchases, agreements, claims }, s, '2026-11-18');
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('spend in the period reaches the highest tier it passes; a finished period with rebate open is to claim', () => {
  const r = run([p('1', 'Sup', '2026-02-01',**Total requested** | **180**0, 10), p('2', 'sup', '2026-07-15', 1000, 10)], [ag()]);
  assert.equal(r.items[0].spend,**Total requested** | **180**00); assert.equal(r.items[0].tier_pct, 3); assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['rebate_unclaimed', 180]]);
});

test('credits received reduce what is still to claim', () => {
  assert.equal(run([p('1', 'Sup', '2026-02-01',**Total requested** | **180**0, 10)], [ag()], [{ agreement: 'A1', amount: 180 }]).items[0].status, 'ok');
  assert.equal(run([p('1', 'Sup', '2026-02-01',**Total requested** | **180**0, 10)], [ag()], [{ agreement: 'a1', amount: 100 }]).items[0].to_claim, 80);
});

test('an open period accrues; spend close to the next tier is listed', () => {
  const r = run([p('1', 'Sup', '2026-11-01', 470, 10)], [ag({ end: '2026-12-31' })]);
  assert.deepEqual(codes(r), ['rebate_accruing', 'near_next_tier']);
  assert.deepEqual(codes(run([p('1', 'Sup', '2026-11-01', 470, 10)], [ag({ end: '2026-12-31' })], [], { near_tier_pct: 2 })), ['rebate_accruing']);
});

test('a passed claim-by date is reviewed while rebate is still open', () => {
  assert.deepEqual(codes(run([p('1', 'Sup', '2026-02-01',**Total requested** | **180**0, 10)], [ag({ claim_by: '2026-08-31' })])), ['rebate_unclaimed', 'claim_window_passed']);
});

test('lines above the agreed price for the agreement item are overpaid', () => {
  const r = run([p('1', 'Sup', '2026-02-01', 100, 2.5, 'S'), p('2', 'Sup', '2026-03-01', 100, 2, 'S'), p('3', 'Sup', '2026-03-01', 100, 9, 'OTHER')], [ag({ item: 'S', contract_price: 2, tiers: [] })]);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['over_contract_price', 50]]); assert.equal(r.items[0].lines, 2);
});

test('purchases from another supplier or outside the dates do not count', () => {
  assert.equal(run([p('1', 'Other', '2026-02-01',**Total requested** | **180**0, 10), p('2', 'Sup', '2025-12-31', 600, 10)], [ag()]).items[0].spend, 0);
});

test('the claim draft totals rebate due and overpayment and asks for the detail to be attached', () => {
  const r = run([p('1', 'Sup', '2026-02-01',**Total requested** | **180**0, 10)], [ag()]);
  const d = claimText(r.items[0], {}); assert.match(d, /\*\*Total requested\*\* \| \*\*60\*\*/); assert.match(d, /\[ATTACH purchase line detail\]/);
});
