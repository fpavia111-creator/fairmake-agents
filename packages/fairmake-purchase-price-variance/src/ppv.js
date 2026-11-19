// Purchase price variance: receipt prices against standard cost, price jumps, unit-of-measure slips.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, round4, pct, str, itemKey, partyKey, groupBy, sortBy } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const RECEIPT_FIELDS = Object.freeze({
  receipt: t(['Receipt', 'Receipt Line', 'Receipt No.', 'Receipt Nbr.', 'GRN', 'Receiving Line'], { required: true }),
  po_number: t(['PO Number', 'PO', 'Purchase Order', 'PO No.', 'Base Document']),
  item: t(['Item', 'Item No.', 'Part', 'Part Number', 'Inventory ID', 'SKU'], { required: true }),
  supplier: t(['Supplier', 'Vendor', 'Vendor Name', 'Vendor Code', 'Supplier Name']),
  receipt_date: t(['Receipt Date', 'Received Date', 'Posting Date', 'Date Received', 'Date'], { type: 'date' }),
  qty: t(['Qty', 'Quantity', 'Qty Received', 'Received Qty', 'Receipt Qty.'], { type: 'number' }),
  unit_price: t(['Unit Price', 'Price', 'PO Price', 'Unit Cost', 'Rate'], { type: 'money' }),
  std_cost: t(['Std Cost', 'Standard Cost', 'Standard', 'Item Cost'], { type: 'money' }),
});
/** SAP Business One goods receipt PO rows. Written from knowledge of the export; not checked against a live system. */
export const RECEIPT_PROFILES = Object.freeze([
  exportProfile('sap_b1_grpo_lines', { receipt: { from: ['Document Number', 'Row Number'], compute: (_r, get) => `${String(get('Document Number') ?? '').trim()}-${String(get('Row Number') ?? '').trim()}` }, po_number: 'Base Document', item: 'Item No.', supplier: 'Vendor Code', receipt_date: 'Posting Date', qty: 'Quantity', unit_price: 'Unit Price', std_cost: 'Item Cost' }, { note: 'SAP Business One goods receipt PO rows: one row per document row; the receipt line is the document and row number.' }),
]);

export const DEFAULTS = Object.freeze({ tolerance_pct: 5, tolerance_amount: 100, jump_pct: 10, uom_factor: 8 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    tolerance_pct: { type: 'number', minimum: 0, maximum: 1000, description: 'A receipt line is flagged when its price is more than this percentage over standard' },
    tolerance_amount: { type: 'number', minimum: 0, description: 'and its variance (price minus standard, times quantity) is more than this amount' },
    jump_pct: { type: 'number', minimum: 0, maximum: 1000, description: 'A price this far above the same supplier\'s previous receipt of the item is listed to watch' },
    uom_factor: { type: 'number', minimum: 2, maximum: 1000, description: 'A price this many times above or below standard is read as a unit-of-measure slip, not a variance' },
  },
});

/**
 * Check every receipt line. Finding codes: ppv_unfavorable, ppv_favorable, price_jump, no_standard, no_price, uom_suspect.
 * A line read as a unit-of-measure slip is not compared with the supplier's earlier prices.
 */
export function priceVariance(rows, s = DEFAULTS) {
  const lines = sortBy(rows.filter((r) => str(r.receipt) && str(r.item)), (r) => `${r.receipt_date || '9999'}|${itemKey(r.receipt)}`);
  const last = new Map();
  const items = lines.map((r) => {
    const f = []; const qty = Number(r.qty) || 0; const price = r.unit_price; const std = r.std_cost;
    let ppv = null; let p = null;
    if (price === null || price === undefined) f.push(finding('no_price', null, `Receipt ${r.receipt} has no unit price.`, 'review'));
    else if (!std) f.push(finding('no_standard', null, `${r.item} has no standard cost, so receipt ${r.receipt} at ${price} cannot be measured.`, 'review'));
    else if (price / std >= s.uom_factor || price / std <= 1 / s.uom_factor) f.push(finding('uom_suspect', null, `Price ${price} is ${round2(price / std)} times the standard ${std}: likely a unit-of-measure slip (each against box or pound against foot). Fix the unit before reading a variance.`, 'review'));
    else {
      ppv = round2((price - std) * qty); p = pct(price - std, std);
      if (ppv > s.tolerance_amount && p > s.tolerance_pct) f.push(finding('ppv_unfavorable', ppv, `${r.item} received at ${price} against standard ${std} (${p}% over) on ${qty}: ${ppv}.`));
      else if (-ppv > s.tolerance_amount && -p > s.tolerance_pct) f.push(finding('ppv_favorable', null, `${r.item} received at ${price}, ${-p}% under standard ${std} (${-ppv} on ${qty}). Check the standard is still right.`, 'watch'));
    }
    const k = `${partyKey(r.supplier)}|${itemKey(r.item)}`; const prev = last.get(k);
    const slip = f.some((x) => x.code === 'uom_suspect');
    if (!slip && prev && price && prev.price && price > prev.price * (1 + s.jump_pct / 100)) f.push(finding('price_jump', round2((price - prev.price) * qty), `${r.supplier || 'Supplier'} charged ${price} for ${r.item}, up ${pct(price - prev.price, prev.price)}% from ${prev.price} on receipt ${prev.receipt}.`, 'watch'));
    if (price && !slip) last.set(k, { price, receipt: r.receipt });
    return { receipt: r.receipt, po_number: r.po_number || '', item: r.item, supplier: r.supplier || '', receipt_date: r.receipt_date, qty, unit_price: price, std_cost: std, ppv, ppv_pct: p, status: statusOf(f), findings: f };
  });
  items.sort((a, b) => (itemKey(a.receipt) < itemKey(b.receipt) ? -1 : 1));
  const measured = items.filter((i) => i.ppv !== null);
  const bySup = groupBy(items, (i) => partyKey(i.supplier) || '(none)');
  const by_supplier = [...bySup.values()].map((xs) => ({ supplier: xs[0].supplier || '(none)', lines: xs.length, received: round2(xs.reduce((x, i) => x + (i.unit_price || 0) * i.qty, 0)), ppv: round2(xs.reduce((x, i) => x + (i.ppv || 0), 0)) })).sort((a, b) => b.ppv - a.ppv || (a.supplier < b.supplier ? -1 : 1));
  const byItem = groupBy(measured, (i) => itemKey(i.item));
  const standards_to_review = [...byItem.values()].filter((xs) => xs.length >= 2 && (xs.every((i) => i.ppv_pct > s.tolerance_pct) || xs.every((i) => i.ppv_pct < -s.tolerance_pct))).map((xs) => {
    const q = xs.reduce((x, i) => x + i.qty, 0); const avg = q ? round4(xs.reduce((x, i) => x + i.unit_price * i.qty, 0) / q) : null;
    return { item: xs[0].item, receipts: xs.length, std_cost: xs[0].std_cost, avg_price: avg, change_pct: pct(avg - xs[0].std_cost, xs[0].std_cost) };
  }).sort((a, b) => (itemKey(a.item) < itemKey(b.item) ? -1 : 1));
  return {
    lines: items.length, received: round2(items.reduce((x, i) => x + (i.unit_price || 0) * i.qty, 0)), ppv_total: round2(measured.reduce((x, i) => x + i.ppv, 0)),
    unfavorable_flagged: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'ppv_unfavorable').reduce((y, f) => y + f.amount, 0), 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_supplier, standards_to_review, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

/** A price query to one supplier: the receipts over standard or up from the last price. */
export function priceQueryText(items, { supplier, from }) {
  const rows = items.filter((i) => i.findings.some((f) => ['ppv_unfavorable', 'price_jump'].includes(f.code)));
  return { rows, text: [
    `# Price query: ${supplier}`, '',
    `**To:** [TO CONFIRM ${supplier} sales or account contact]`,
    `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `We received the items below at prices above our agreed or last price. Please confirm the price that applies, or send a credit note for the difference.`, '',
    '| Receipt | PO | Item | Received | Price | Our standard or last price | Note |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.receipt} | ${i.po_number} | ${i.item} | ${i.receipt_date || ''} | ${i.unit_price} | ${i.std_cost} | ${i.findings.filter((f) => ['ppv_unfavorable', 'price_jump'].includes(f.code)).map((f) => f.detail).join(' ')} |`),
  ].join('\n') };
}
