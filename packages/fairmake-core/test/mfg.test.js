// Manufacturing helpers, the 850/810/856 reader and the agent factory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  itemKey, partyKey, sameParty, partyIs, pct, ratio, agingBucket, weekStart, monthsBetween, finding, tallyFindings, countBy, yes, sortBy,
  readX12, parseX12, ediLines, defineFairmakeAgent, AgentRuntime, ONE_CLICK_CATEGORIES, COLUMN_WORDS, COLUMN_LANGUAGES, FIELD_CONCEPTS, EXPORTS,
} from '../src/index.js';

test('item and party keys: case and spacing fold, dashes and legal forms behave', () => {
  assert.equal(itemKey(' brk-100 '), 'BRK-100'); assert.notEqual(itemKey('AB-100'), itemKey('AB100')); assert.equal(itemKey('ｂｒｋ　１'), 'BRK 1');
  assert.ok(sameParty('Acme Castings, Inc.', 'ACME CASTINGS')); assert.ok(!sameParty('Acme Castings', 'Acme Forgings'));
  assert.equal(partyKey('V1001'), 'v1001'); assert.ok(partyIs('North Example Metals LLC')('north example metals'));
});

test('numbers and dates: percentages, buckets, weeks and months', () => {
  assert.equal(pct(1, 8), 12.5); assert.equal(pct(1, 0), null); assert.equal(ratio(2, 3), 0.6667);
  assert.equal(agingBucket(0), '0-30'); assert.equal(agingBucket(45), '31-60'); assert.equal(agingBucket(91), '90+'); assert.equal(agingBucket(null), 'unknown');
  assert.equal(weekStart('2026-11-18'), '2026-11-16'); assert.equal(weekStart('2026-11-22'), '2026-11-16'); assert.equal(monthsBetween('2026-01-01', '2026-07-01'), 5.9);
  assert.ok(yes('Y') && yes('ja') && yes('はい') && !yes('no') && !yes(''));
  assert.deepEqual(sortBy([{ k: 'b' }, { k: 'a' }, { k: 'b', n: 2 }], (r) => r.k).map((r) => r.n || r.k), ['a', 'b', 2]);
});

test('findings tally by code and items count by status', () => {
  const items = [{ status: 'ok', findings: [] }, { status: 'review', findings: [finding('b', 10.005, 'x'), finding('a', null, 'y')] }, { status: 'review', findings: [finding('b', 5, 'z')] }];
  assert.deepEqual(tallyFindings(items), { a: { count: 1, amount: 0 }, b: { count: 2, amount: 15.01 } });
  assert.deepEqual(countBy(items), { ok: 1, review: 2 });
  assert.equal(finding('c', 'NaN', 'd').amount, null);
});

test('X12 850, 856 and 810 read into orders, ship notices and invoices with envelope checks', () => {
  const r = readX12(readFileSync(new URL('./fixtures/sample-orders.edi', import.meta.url), 'utf8'));
  assert.deepEqual(r.problems, []); assert.equal(r.transaction_count, 4);
  const [po1, po2, asn, inv] = r.records;
  assert.equal(po1.set, '850'); assert.equal(po1.po_number, 'PO-7001'); assert.equal(po1.requested_delivery, '2026-11-10'); assert.equal(po1.ship_to, 'Example Mart DC 12');
  assert.deepEqual(po1.lines.map((l) => [l.buyer_part, l.qty, l.unit_price]), [['BRK-100', 24, 4.5], ['BRK-200', 12, 7.25]]);
  assert.equal(po2.lines[0].vendor_part, 'SKU-300');
  assert.equal(asn.shipment_id, 'ASN-9001'); assert.equal(asn.bol, 'BOL-5501'); assert.equal(asn.ship_date, '2026-11-05'); assert.equal(asn.asn_date, '2026-11-05T09:00:00'); assert.equal(asn.carrier, 'EXRL');
  assert.deepEqual(asn.lines.map((l) => [l.po_number, l.sscc, l.buyer_part, l.qty]), [['PO-7001', '00012345600000000011', 'BRK-100', 24], ['PO-7001', '00012345600000000011', 'BRK-200', 10]]);
  assert.equal(inv.invoice_number, 'INV-3001'); assert.equal(inv.po_number, 'PO-7001'); assert.equal(inv.total, 183); assert.equal(inv.lines[1].unit_price, 7.5);
  const flat = ediLines(r.records);
  assert.deepEqual(flat.map((x) => x.doc_type), ['po', 'po', 'po', 'asn', 'asn', 'invoice', 'invoice']);
  assert.equal(flat[3].sscc, '00012345600000000011');
});

test('X12 envelope problems are reported, not thrown', () => {
  const text = readFileSync(new URL('./fixtures/sample-orders.edi', import.meta.url), 'utf8').replace('SE*18*0003', 'SE*17*0003').replace('GE*2*101', 'GE*3*101');
  const codes = parseX12(text).problems.map((p) => p.code);
  assert.ok(codes.includes('se_count')); assert.ok(codes.includes('ge_count'));
  assert.throws(() => parseX12('hello'), /not an X12 file/);
});

test('manufacturing column words exist in all eight languages and every field alias points at a real concept', () => {
  for (const [field, concept] of Object.entries(FIELD_CONCEPTS)) assert.ok(COLUMN_WORDS[concept], `${field} -> ${concept}`);
  for (const c of ['work_order', 'work_center', 'machine', 'on_hand', 'safety_stock', 'reorder_point', 'promise_date', 'component', 'qty_per', 'serial', 'gauge', 'lead_time']) {
    for (const l of COLUMN_LANGUAGES) assert.ok(COLUMN_WORDS[c][l] && COLUMN_WORDS[c][l].length, `${c} ${l}`);
  }
  assert.ok(Object.values(EXPORTS).every((e) => e.basis === 'recalled'));
});

test('the agent factory: check, explain, report, a draft that asks, a request that waits for one click, refused tools and a closed default', async () => {
  const manifest = defineFairmakeAgent({
    name: 'demo-of-tests', version: '0.0.1', prefix: 'demo', description: 'Test agent.',
    args: { rows: { type: 'string', description: 'Rows file' } }, required: ['rows'],
    sources: { rows: { label: 'Rows', args: ['rows'], fields: { id: { aliases: ['ID'], required: true }, amount: { aliases: ['Amount'], type: 'money' }, owner: { aliases: ['Owner'], personal: true } } } },
    run: ({ a, read }) => { const items = read('rows').map((r) => ({ id: r.id, owner: r.owner, status: r.amount > 10 ? 'review' : 'ok', findings: r.amount > 10 ? [finding('big', r.amount, `Amount ${r.amount} is big, owner ${r.owner}.`)] : [] })); return { rows: items.length, items, by_finding: tallyFindings(items) }; },
    line: (r) => `${r.rows} row(s).`,
    item: { key: 'id', arg: 'id', label: 'row' },
    check: { title: 'Check rows', description: 'Check every row.' },
    report: { base: 'demo-report', title: 'Purchase price variance', rows: (r) => r.items.map((i) => ({ id: i.id, status: i.status })), htmlColumns: ['id', 'status'], limits: ['A limit.'] },
    draft: { noun: 'note', verb: 'send', description: 'Draft a note.', build: (r) => ({ id: 'all', text: `**To:** [TO CONFIRM recipient]\n\n${r.rows} rows.` }) },
    refused: [{ name: 'erp_post_journal', category: 'move_money', description: 'Never posts.' }],
  });
  const root = mkdtempSync(join(tmpdir(), 'factory-')); writeFileSync(join(root, 'rows.csv'), 'ID,Amount,Owner\nA1,5,Dana Example\nA2,25,Rowan Sample\n');
  const rt = new AgentRuntime(manifest, { root, audit: false });
  const c = await rt.call('demo_check', { rows: 'rows.csv' });
  assert.equal(c.status, 'executed'); assert.equal(c.result.summary, '2 row(s).'); assert.equal(c.result.by_finding.big.amount, 25);
  const e = await rt.call('demo_explain', { rows: 'rows.csv', id: ' a2 ' }); assert.match(e.result.summary, /A2: review\. Amount 25 is big, owner R\.S\.#[0-9a-f]{6}\./);
  assert.doesNotMatch(JSON.stringify(c.result), /Rowan Sample|Dana Example/); assert.equal(c.result.items_total, 2);
  const byToken = await rt.call('demo_explain', { rows: 'rows.csv', id: 'a1' }); assert.equal(byToken.status, 'executed');
  const miss = await rt.call('demo_explain', { rows: 'rows.csv', id: 'Z'.repeat(500) }); assert.equal(miss.status, 'error'); assert.ok(miss.reason.length < 300);
  const w = await rt.call('demo_write_report', { rows: 'rows.csv' }); assert.equal(w.status, 'executed'); assert.equal(w.result.files.length, 2);
  assert.equal((await rt.call('demo_draft_note', { rows: 'rows.csv' })).status, 'needs_approval');
  assert.equal((await rt.call('erp_post_journal', {})).status, 'blocked');
  assert.equal((await rt.call('demo_anything_else', {})).status, 'blocked');
  const req = manifest.tools.find((t) => t.name === 'demo_request_send'); assert.ok(ONE_CLICK_CATEGORIES.includes(req.category));
});
