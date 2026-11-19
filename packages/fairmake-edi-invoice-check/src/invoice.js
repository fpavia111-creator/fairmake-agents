// Customer invoices against customer purchase orders (EDI 810 against 850, or tables): price and quantity
// differences that turn into deductions, items not ordered, POs not found, possible duplicates, totals that do not add up.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, groupBy, readX12, ediLines } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const ORDER_FIELDS = Object.freeze({
  po_number: t(['PO Number', 'PO', 'Customer PO', 'P. O. #'], { required: true }),
  line: t(['Line', 'PO Line', 'Line Number']),
  item: t(['Item', 'Buyer Part', 'Part', 'SKU'], { required: true }),
  qty: t(['Qty', 'Quantity', 'Qty Ordered'], { type: 'number' }),
  unit_price: t(['Unit Price', 'Price', 'PO Price'], { type: 'money' }),
});
export const INVOICE_FIELDS = Object.freeze({
  invoice: t(['Invoice', 'Invoice Number', 'Num', 'Invoice No.'], { required: true }),
  po_number: t(['PO Number', 'PO', 'Customer PO', 'P. O. #']),
  line: t(['Line', 'Invoice Line', 'Line Number']),
  item: t(['Item', 'Buyer Part', 'Part', 'SKU']),
  qty: t(['Qty', 'Quantity', 'Qty Invoiced'], { type: 'number' }),
  unit_price: t(['Unit Price', 'Price', 'Sales Price', 'Rate'], { type: 'money' }),
  invoice_date: t(['Invoice Date', 'Date'], { type: 'date' }),
});
/** QuickBooks Enterprise sales by customer detail. Written from knowledge of the report; not checked against a live file. */
export const INVOICE_PROFILES = Object.freeze([
  exportProfile('qbe_sales_detail', { invoice: 'Num', po_number: 'P. O. #', line: 'Item', item: 'Item', qty: 'Qty', unit_price: 'Sales Price', invoice_date: 'Date' }, { note: 'QuickBooks Enterprise Sales by Customer Detail: one row per invoice line; the PO number is the P. O. # column when it is shown.' }),
]);

export const DEFAULTS = Object.freeze({ price_tolerance: 0.01 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: { note: { type: 'string', description: 'Free text for your own records' }, price_tolerance: { type: 'number', minimum: 0, maximum: 1000, description: 'Unit price differences up to this amount are ignored' } },
});

/** Turn an X12 file with 850s and 810s into order and invoice rows, plus 810 totals. */
export function rowsFromX12(text) {
  const r = readX12(text); const lines = ediLines(r.records);
  return {
    problems: r.problems,
    totals: r.records.filter((x) => x.set === '810').map((x) => ({ invoice: x.invoice_number, total: x.total })),
    orders: lines.filter((l) => l.doc_type === 'po').map((l) => ({ po_number: l.po_number, line: l.line, item: l.buyer_part || l.vendor_part || l.upc, qty: l.qty, unit_price: l.unit_price })),
    invoices: lines.filter((l) => l.doc_type === 'invoice').map((l) => ({ invoice: l.doc_number, po_number: l.po_number, line: l.line, item: l.buyer_part || l.vendor_part || l.upc, qty: l.qty, unit_price: l.unit_price, invoice_date: l.date })),
  };
}

/** Check invoices. Finding codes: po_not_found, item_not_on_po, price_mismatch, qty_over_po, possible_duplicate, total_mismatch. */
export function invoiceCheck({ orders, invoices, totals = [] }, s = DEFAULTS) {
  const O = groupBy(orders.filter((o) => str(o.po_number) && str(o.item)), (o) => `${itemKey(o.po_number)}|${itemKey(o.item)}`);
  const POS = new Set(orders.map((o) => itemKey(o.po_number)));
  const I = groupBy(invoices.filter((i) => str(i.invoice)), (i) => itemKey(i.invoice));
  const T = new Map(totals.map((x) => [itemKey(x.invoice), x.total]));
  const invoicedSoFar = new Map();
  const ordered = [...I.entries()].sort(([a, xs], [b, ys]) => (`${xs[0].invoice_date || ''}|${a}` < `${ys[0].invoice_date || ''}|${b}` ? -1 : 1));
  const sig = (xs) => xs.map((l) => `${itemKey(l.po_number)}|${itemKey(l.item)}|${l.qty}|${l.unit_price}`).sort().join(';');
  const seenSig = new Map();
  const items = ordered.map(([k, ls]) => {
    const inv = str(ls[0].invoice); const po = str(ls[0].po_number); const f = []; let value = 0;
    if (!po || !POS.has(itemKey(po))) f.push(finding('po_not_found', null, `Invoice ${inv} names PO ${po || '(none)'}, which is not among the customer orders.`));
    for (const l of [...ls].sort((a, b) => (`${a.line}|${itemKey(a.item)}` < `${b.line}|${itemKey(b.item)}` ? -1 : 1))) {
      value += (Number(l.qty) || 0) * (Number(l.unit_price) || 0);
      if (!po || !POS.has(itemKey(po))) continue;
      const key = `${itemKey(po)}|${itemKey(l.item)}`; const os = O.get(key);
      if (!os) { f.push(finding('item_not_on_po', round2((Number(l.qty) || 0) * (Number(l.unit_price) || 0)), `Invoice ${inv} bills ${l.qty} of ${l.item}, which is not on PO ${po}.`)); continue; }
      const poPrice = os[0].unit_price; const poQty = os.reduce((x, o) => x + (Number(o.qty) || 0), 0);
      if (poPrice !== null && poPrice !== undefined && l.unit_price !== null && Math.abs(l.unit_price - poPrice) > s.price_tolerance) f.push(finding('price_mismatch', round2(Math.abs(l.unit_price - poPrice) * (Number(l.qty) || 0)), `Invoice ${inv} bills ${l.item} at ${l.unit_price}; PO ${po} says ${poPrice}. A retailer usually deducts the difference (${round2((l.unit_price - poPrice) * (Number(l.qty) || 0))}).`));
      const so = (invoicedSoFar.get(key) || 0) + (Number(l.qty) || 0); invoicedSoFar.set(key, so);
      if (so > poQty) f.push(finding('qty_over_po', round2((so - poQty) * (Number(l.unit_price) || 0)), `${l.item} on PO ${po}: ${so} invoiced so far against ${poQty} ordered.`));
    }
    const sg = sig(ls); if (seenSig.has(sg)) f.push(finding('possible_duplicate', null, `Invoice ${inv} has the same lines as invoice ${seenSig.get(sg)}.`, 'review')); else seenSig.set(sg, inv);
    if (T.has(k) && T.get(k) !== null && Math.abs(T.get(k) - round2(value)) > 0.005) f.push(finding('total_mismatch', null, `Invoice ${inv} total says ${T.get(k)}, its lines add up to ${round2(value)}.`, 'review'));
    return { invoice: inv, po_number: po, invoice_date: ls[0].invoice_date || null, lines: ls.length, value: round2(value), at_risk: round2(f.reduce((x, y) => x + (y.amount || 0), 0)), status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.invoice) < itemKey(b.invoice) ? -1 : 1));
  return {
    invoices: items.length, orders: POS.size, invoiced: round2(items.reduce((x, i) => x + i.value, 0)), at_risk: round2(items.reduce((x, i) => x + i.at_risk, 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, ok: items.filter((i) => i.status === 'ok').length,
    by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function correctionText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status !== 'ok');
  return ['# Invoices to correct before the customer deducts', '', '**To:** [TO CONFIRM billing or AR lead]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `${rows.length} invoice(s) differ from the customer's purchase orders (${r.at_risk} at risk). Please confirm the PO terms and issue corrections where the customer allows it. Nothing has been sent or credited.`, '',
    '| Invoice | PO | Value | At risk | Detail |', '| --- | --- | --- | --- | --- |', ...rows.map((i) => `| ${i.invoice} | ${i.po_number} | ${i.value} | ${i.at_risk} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
