// EDI ASN errors: advance ship notices (856) checked against the customer's purchase orders (850) and what was
// actually shipped: missing ASNs, late ones, quantities that do not match, items not ordered, SSCC problems.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, groupBy, hoursBetween, readX12, ediLines } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const ORDER_FIELDS = Object.freeze({
  po_number: t(['PO Number', 'PO', 'Customer PO', 'Purchase Order'], { required: true }),
  line: t(['Line', 'PO Line', 'Line Number']),
  item: t(['Item', 'Buyer Part', 'Part', 'SKU', 'UPC'], { required: true }),
  qty: t(['Qty', 'Quantity', 'Qty Ordered', 'Ordered'], { type: 'number' }),
  requested_ship: t(['Requested Ship', 'Ship Date Requested', 'Do Not Ship Before', 'Requested Date'], { type: 'date' }),
});
export const ASN_FIELDS = Object.freeze({
  asn: t(['ASN', 'ASN Number', 'Shipment ID', 'BSN'], { required: true }),
  po_number: t(['PO Number', 'PO', 'Customer PO'], { required: true }),
  item: t(['Item', 'Buyer Part', 'Part', 'SKU', 'UPC'], { required: true }),
  qty: t(['Qty', 'Qty Shipped', 'Quantity', 'Units'], { type: 'number' }),
  sscc: t(['SSCC', 'SSCC-18', 'Carton Label', 'Pallet ID']),
  ship_date: t(['Ship Date', 'Shipped'], { type: 'date' }),
  sent_at: t(['Sent At', 'ASN Sent', 'Transmitted', 'Sent'], { type: 'datetime' }),
});
export const SHIP_FIELDS = Object.freeze({
  po_number: t(['PO Number', 'PO', 'Customer PO'], { required: true }),
  item: t(['Item', 'Buyer Part', 'Part', 'SKU'], { required: true }),
  qty: t(['Qty', 'Qty Shipped', 'Quantity'], { type: 'number' }),
  ship_date: t(['Ship Date', 'Shipped At', 'Ship Datetime'], { type: 'datetime' }),
});
/** Generic EDI provider ASN report. Written from knowledge of such reports; not checked against a live account. */
export const ASN_PROFILES = Object.freeze([
  exportProfile('edi_asn_report', { asn: 'ASN Number', po_number: 'PO Number', item: 'Buyer Part', qty: 'Qty Shipped', sscc: 'SSCC', ship_date: 'Ship Date', sent_at: 'Sent At' }, { note: 'EDI provider ASN report: one row per item and carton.' }),
]);

export const DEFAULTS = Object.freeze({ asn_grace_hours: 1, fines: {} });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    asn_grace_hours: { type: 'number', minimum: 0, maximum: 240, description: 'An ASN sent within this many hours after the shipment counts as on time (most retailer guides want it before the truck arrives)' },
    fines: { type: 'object', additionalProperties: { type: 'number', minimum: 0 }, description: 'Fine per finding code from the customer\'s compliance guide (no_asn, asn_late, asn_qty_mismatch, ...), to show the money at risk' },
  },
});

/** Turn an X12 file with 850s and 856s into order and ASN rows. */
export function rowsFromX12(text) {
  const r = readX12(text); const lines = ediLines(r.records);
  return {
    problems: r.problems,
    orders: lines.filter((l) => l.doc_type === 'po').map((l) => ({ po_number: l.po_number, line: l.line, item: l.buyer_part || l.vendor_part || l.upc, qty: l.qty, requested_ship: l.requested_delivery || null })),
    asns: lines.filter((l) => l.doc_type === 'asn').map((l) => ({ asn: l.doc_number, po_number: l.po_number, item: l.buyer_part || l.vendor_part || l.upc, qty: l.qty, sscc: l.sscc, ship_date: l.date, sent_at: l.asn_date })),
  };
}

/** Check ASNs by PO. Finding codes: no_asn, asn_late, asn_qty_mismatch, asn_over_po, asn_item_not_on_po, duplicate_sscc, missing_sscc, po_not_found. */
export function asnErrors({ orders, asns, shipments }, s = DEFAULTS) {
  const fine = (code) => (s.fines && Number.isFinite(s.fines[code]) ? s.fines[code] : null);
  const O = groupBy(orders.filter((o) => str(o.po_number)), (o) => itemKey(o.po_number)); const A = groupBy(asns.filter((a) => str(a.asn) && str(a.po_number)), (a) => itemKey(a.po_number)); const S = groupBy(shipments.filter((x) => str(x.po_number)), (x) => itemKey(x.po_number));
  const ssccUse = groupBy(asns.filter((a) => str(a.sscc)), (a) => str(a.sscc)); const dupSscc = new Map([...ssccUse.entries()].filter(([, xs]) => new Set(xs.map((x) => itemKey(x.asn))).size > 1));
  const items = [...new Set([...O.keys(), ...A.keys(), ...S.keys()])].sort().map((k) => {
    const os = O.get(k) || [], as = A.get(k) || [], ss = S.get(k) || []; const po = str((os[0] || as[0] || ss[0]).po_number); const f = [];
    const qty = (rows) => { const m = new Map(); for (const r of rows) m.set(itemKey(r.item), (m.get(itemKey(r.item)) || 0) + (Number(r.qty) || 0)); return m; };
    const oq = qty(os), aq = qty(as), sq = qty(ss);
    if (ss.length && !as.length) f.push(finding('no_asn', fine('no_asn'), `PO ${po} shipped${ss[0].ship_date ? ` on ${String(ss[0].ship_date).slice(0, 10)}` : ''} with no ASN sent.`));
    if (as.length && !os.length) f.push(finding('po_not_found', null, `ASN for PO ${po} but the PO is not in the orders file.`, 'review'));
    if (os.length) for (const [it, q] of aq) { if (!oq.has(it)) f.push(finding('asn_item_not_on_po', fine('asn_item_not_on_po'), `ASN for PO ${po} lists ${it}, which is not on the PO.`)); else if (q > oq.get(it)) f.push(finding('asn_over_po', fine('asn_over_po'), `ASN for PO ${po} lists ${q} of ${it} against ${oq.get(it)} ordered.`)); }
    if (ss.length && as.length) for (const it of new Set([...sq.keys(), ...aq.keys()])) { if ((sq.get(it) || 0) !== (aq.get(it) || 0)) f.push(finding('asn_qty_mismatch', fine('asn_qty_mismatch'), `PO ${po}, ${it}: ASN says ${aq.get(it) || 0}, the shipment record says ${sq.get(it) || 0}.`)); }
    const shipAt = ss.map((x) => x.ship_date).filter(Boolean).sort()[0] || null;
    for (const a of [...new Map(as.map((x) => [itemKey(x.asn), x])).values()]) {
      const at = a.sent_at; const from = shipAt || (String(a.ship_date || '').length > 10 ? a.ship_date : null); const h = at && from ? hoursBetween(from, at) : null; // a date with no time cannot tell late from on time
      if (h !== null && h > s.asn_grace_hours) f.push(finding('asn_late', fine('asn_late'), `ASN ${a.asn} for PO ${po} was sent ${at}, ${h} hours after shipping (${from}).`));
    }
    const noSscc = as.filter((a) => !str(a.sscc)); if (noSscc.length) f.push(finding('missing_sscc', null, `${noSscc.length} ASN line(s) for PO ${po} carry no SSCC carton label.`, 'review'));
    const dups = [...new Set(as.filter((a) => dupSscc.has(str(a.sscc))).map((a) => str(a.sscc)))]; if (dups.length) f.push(finding('duplicate_sscc', fine('duplicate_sscc'), `SSCC ${dups.join(', ')} on PO ${po} also appears on another ASN.`));
    return { po_number: po, ordered: [...oq.values()].reduce((x, v) => x + v, 0), asn_qty: [...aq.values()].reduce((x, v) => x + v, 0), shipped: [...sq.values()].reduce((x, v) => x + v, 0), asns: new Set(as.map((a) => itemKey(a.asn))).size, fines_at_risk: round2(f.reduce((x, y) => x + (y.amount || 0), 0)), status: statusOf(f), findings: f };
  });
  return {
    pos: items.length, asns: new Set(asns.map((a) => itemKey(a.asn))).size, fines_at_risk: round2(items.reduce((x, i) => x + i.fines_at_risk, 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, ok: items.filter((i) => i.status === 'ok').length,
    by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function correctionText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status !== 'ok');
  return ['# ASN corrections', '', '**To:** [TO CONFIRM EDI coordinator or 3PL contact]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `${r.flag} PO(s) have ASN errors${r.fines_at_risk ? `, ${r.fines_at_risk} of fines at risk by the compliance guide in our settings` : ''}. Please correct and resend where the customer allows it, and fix the cause in the shipping process. Nothing has been transmitted.`, '',
    '| PO | Ordered | ASN qty | Shipped | Problem |', '| --- | --- | --- | --- | --- |', ...rows.map((i) => `| ${i.po_number} | ${i.ordered} | ${i.asn_qty} | ${i.shipped} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
