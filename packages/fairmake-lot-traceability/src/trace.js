// Lot and serial traceability: breaks in the chain from received lots, through production, to shipments.
import { exportProfile, finding, statusOf, tallyFindings, countBy, str, itemKey, groupBy } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const CONSUME_FIELDS = Object.freeze({
  record: t(['Record', 'Line ID', 'Transaction', 'Issue ID'], { required: true }),
  work_order: t(['Work Order', 'Job', 'Production Order', 'Document Number']),
  finished_lot: t(['Finished Lot', 'Assembly Lot', 'Output Lot', 'Parent Lot', 'Batch']),
  component: t(['Component', 'Component Item', 'Material', 'Part'], { required: true }),
  component_lot: t(['Component Lot', 'Lot/Serial Number', 'Lot Number', 'Lot', 'Material Lot']),
  qty: t(['Qty', 'Quantity', 'Qty Issued'], { type: 'number' }),
  consume_date: t(['Date', 'Issue Date', 'Consumed', 'Transaction Date'], { type: 'date' }),
});
export const RECEIPT_FIELDS = Object.freeze({
  lot: t(['Lot', 'Lot Number', 'Lot/Serial Number', 'Batch'], { required: true }),
  item: t(['Item', 'Part', 'Part Number']),
  receipt_date: t(['Receipt Date', 'Received', 'Date'], { type: 'date' }),
  supplier: t(['Supplier', 'Vendor']),
});
export const SHIP_FIELDS = Object.freeze({
  shipment: t(['Shipment', 'Shipment ID', 'Packing Slip', 'Delivery'], { required: true }),
  customer: t(['Customer', 'Ship To']),
  item: t(['Item', 'Part', 'Part Number']),
  lot_or_serial: t(['Lot or Serial', 'Lot/Serial Number', 'Serial Number', 'Lot', 'Serial']),
  ship_date: t(['Ship Date', 'Shipped', 'Date'], { type: 'date' }),
  qty: t(['Qty', 'Quantity', 'Qty Shipped'], { type: 'number' }),
});
/** NetSuite assembly build components with inventory detail. Written from knowledge of the export; not checked against a live account. */
export const CONSUME_PROFILES = Object.freeze([
  exportProfile('netsuite_assembly_components', { record: { from: ['Document Number', 'Component', 'Lot/Serial Number'], compute: (_r, get) => ['Document Number', 'Component', 'Lot/Serial Number'].map((k) => String(get(k) ?? '').trim()).join('/') }, work_order: 'Document Number', finished_lot: 'Assembly Lot', component: 'Component', component_lot: 'Lot/Serial Number', qty: 'Quantity', consume_date: 'Date' }, { note: 'NetSuite assembly builds: one row per component lot issued; the record id is the build, component and lot.' }),
]);

/** Trace the chain. Finding codes: consumed_without_lot, lot_not_received, used_before_received, shipped_no_lot, shipped_unknown_lot, serial_shipped_twice. */
export function traceability({ consumption, receipts, shipments }) {
  const REC = new Map(receipts.filter((r) => str(r.lot)).map((r) => [itemKey(r.lot), r]));
  const FIN = groupBy(consumption.filter((c) => str(c.record) && str(c.component)), (c) => itemKey(c.finished_lot) || `(no finished lot) ${itemKey(c.work_order)}`);
  const finished = new Set([...FIN.keys()]);
  const out = [];
  for (const [k, cs] of FIN) {
    const name = str(cs[0].finished_lot) || `${str(cs[0].work_order) || '?'} (no finished lot)`; const f = [];
    if (!str(cs[0].finished_lot)) f.push(finding('consumed_without_lot', null, `Work order ${str(cs[0].work_order) || '?'} consumed material with no finished lot recorded.`));
    for (const c of cs.slice().sort((a, b) => (itemKey(a.record) < itemKey(b.record) ? -1 : 1))) {
      if (!str(c.component_lot)) { f.push(finding('consumed_without_lot', null, `${c.component} was issued to ${name} with no component lot (record ${c.record}).`)); continue; }
      const rk = itemKey(c.component_lot); const rec = REC.get(rk);
      if (!rec && !finished.has(rk)) f.push(finding('lot_not_received', null, `Component lot ${c.component_lot} (${c.component}) used in ${name} is not in the receipts or production records.`, 'review'));
      if (rec && rec.receipt_date && c.consume_date && c.consume_date < rec.receipt_date) f.push(finding('used_before_received', null, `Lot ${c.component_lot} was issued to ${name} on ${c.consume_date}, before it was received on ${rec.receipt_date}.`));
    }
    out.push({ reference: name, kind: 'finished_lot', work_order: str(cs[0].work_order), components: cs.length, shipments: 0, status: statusOf(f), findings: f });
  }
  const byFin = new Map(out.map((o) => [itemKey(o.reference), o]));
  const SH = groupBy(shipments.filter((s) => str(s.shipment)), (s) => itemKey(s.lot_or_serial) || `(no lot) ${itemKey(s.shipment)}`);
  for (const [k, ss] of SH) {
    const lot = str(ss[0].lot_or_serial); const f = [];
    if (!lot) { const x = ss[0]; out.push({ reference: `${str(x.shipment)} (no lot)`, kind: 'shipment', work_order: '', components: 0, shipments: 1, status: 'flag', findings: [finding('shipped_no_lot', null, `Shipment ${x.shipment} of ${x.item || '?'} to ${x.customer || '?'} has no lot or serial number.`)] }); continue; }
    const known = byFin.get(k) || REC.has(k);
    const serialDup = ss.length > 1 && ss.every((x) => Number(x.qty) === 1) ? ss : null;
    if (!known) f.push(finding('shipped_unknown_lot', null, `Lot or serial ${lot} shipped on ${ss.map((x) => str(x.shipment)).sort().join(', ')} was never produced or received in these records.`));
    if (serialDup) f.push(finding('serial_shipped_twice', null, `Serial ${lot} went out on ${serialDup.length} shipments (${serialDup.map((x) => `${str(x.shipment)} ${x.ship_date || ''}`.trim()).sort().join(', ')}).`));
    const fin = byFin.get(k);
    if (fin) { fin.shipments += ss.length; fin.findings.push(...f); fin.status = statusOf(fin.findings); }
    else if (f.length || !REC.has(k)) out.push({ reference: lot, kind: 'shipped_lot', work_order: '', components: 0, shipments: ss.length, status: statusOf(f), findings: f });
  }
  out.sort((a, b) => (`${a.kind}|${itemKey(a.reference)}` < `${b.kind}|${itemKey(b.reference)}` ? -1 : 1));
  return {
    finished_lots: out.filter((o) => o.kind === 'finished_lot').length, consumption_records: consumption.length, receipts: receipts.length, shipments: shipments.length,
    flag: out.filter((o) => o.status === 'flag').length, review: out.filter((o) => o.status === 'review').length, ok: out.filter((o) => o.status === 'ok').length,
    by_finding: tallyFindings(out), by_status: countBy(out), items: out,
  };
}

export function traceGapsText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status !== 'ok');
  return ['# Traceability gaps to close', '', '**To:** [TO CONFIRM quality manager]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `${r.flag} lot(s) or shipment(s) have a break in the chain and ${r.review} need a check. Each one would stop a clean trace if a customer or regulator asked. Fix the records at the source; this note changes no record and tells no customer.`, '',
    '| Lot or shipment | Kind | Detail |', '| --- | --- | --- |', ...rows.map((i) => `| ${i.reference} | ${i.kind} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
