// Shelf life and expiry: expired stock on hand, lots expiring soon, lots with no expiry date, and shipments that
// broke first-expired-first-out, went out short-dated against a customer's minimum, or went out expired.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, partyKey, groupBy, daysBetween, asOfDate } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const LOT_FIELDS = Object.freeze({
  lot: t(['Lot', 'Lot Number', 'Lot No.', 'Batch', 'Batch Number'], { required: true }),
  item: t(['Item', 'Part', 'Part Number', 'SKU', 'Product']),
  location: t(['Location', 'Warehouse', 'Bin']),
  on_hand: t(['On Hand', 'Qty', 'Quantity', 'Qty On Hand'], { type: 'number' }),
  mfg_date: t(['Mfg Date', 'Manufacture Date', 'Production Date', 'Received Date'], { type: 'date' }),
  expiry_date: t(['Expiry Date', 'Expiration Date', 'Expiration', 'Best Before', 'Use By'], { type: 'date' }),
  unit_cost: t(['Unit Cost', 'Cost', 'Std Cost'], { type: 'money' }),
});
export const SHIP_FIELDS = Object.freeze({
  shipment: t(['Shipment', 'Shipment ID', 'Packing Slip', 'Delivery'], { required: true }),
  customer: t(['Customer', 'Ship To', 'Customer Name']),
  item: t(['Item', 'Part', 'Part Number', 'SKU']),
  lot: t(['Lot', 'Lot Number', 'Batch']),
  ship_date: t(['Ship Date', 'Shipped', 'Date'], { type: 'date' }),
  qty: t(['Qty', 'Quantity', 'Qty Shipped'], { type: 'number' }),
});
/** Fishbowl inventory by tracking. Written from knowledge of the export; not checked against a live system. */
export const LOT_PROFILES = Object.freeze([
  exportProfile('fishbowl_lots', { lot: 'Lot Number', item: 'Part Number', location: 'Location', on_hand: 'Qty', expiry_date: 'Expiration Date' }, { note: 'Fishbowl inventory with tracking: one row per part, location and lot.' }),
]);

export const DEFAULTS = Object.freeze({ warn_days: 60, default_min_days: 0, customer_min_days: {} });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    warn_days: { type: 'integer', minimum: 1, maximum: 3650, description: 'A lot expiring within this many days is listed as expiring soon' },
    default_min_days: { type: 'integer', minimum: 0, maximum: 3650, description: 'Shelf life a shipment must have left, for customers not named below' },
    customer_min_days: { type: 'object', additionalProperties: { type: 'integer', minimum: 0, maximum: 3650 }, description: 'Minimum days of shelf life left at shipment, by customer' },
  },
});

/** Lot status. Finding codes: expired_on_hand, expiring_soon, no_expiry, shipped_expired, short_dated_shipment, fefo_skipped. */
export function shelfLife({ lots, shipments }, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf);
  const mins = new Map(Object.entries(s.customer_min_days || {}).map(([c, d]) => [partyKey(c), d]));
  const L = [...groupBy(lots.filter((l) => str(l.lot)), (l) => itemKey(l.lot)).values()].map((ls) => ({ ...ls[0], on_hand: ls.reduce((x, l) => x + (Number(l.on_hand) || 0), 0) }));
  const byItem = groupBy(L, (l) => itemKey(l.item));
  const S = groupBy(shipments.filter((x) => str(x.shipment) && str(x.lot)), (x) => itemKey(x.lot));
  const items = L.map((l) => {
    const f = []; const value = round2(l.on_hand * (l.unit_cost ?? 0)); const left = l.expiry_date ? daysBetween(today, l.expiry_date) : null;
    if (l.on_hand > 0 && !l.expiry_date) f.push(finding('no_expiry', null, `Lot ${l.lot} (${l.item || '?'}) holds ${l.on_hand} and has no expiry date.`, 'review'));
    if (l.on_hand > 0 && left !== null && left < 0) f.push(finding('expired_on_hand', value || null, `Lot ${l.lot} (${l.item || '?'}) expired ${l.expiry_date} with ${l.on_hand} still on hand${value ? ` (${value})` : ''}.`));
    else if (l.on_hand > 0 && left !== null && left <= s.warn_days) f.push(finding('expiring_soon', null, `Lot ${l.lot} (${l.item || '?'}) expires ${l.expiry_date} (in ${left} days) with ${l.on_hand} on hand.`, 'watch'));
    const ships = (S.get(itemKey(l.lot)) || []).sort((a, b) => (`${a.ship_date}|${a.shipment}` < `${b.ship_date}|${b.shipment}` ? -1 : 1));
    for (const x of ships) {
      if (!x.ship_date || !l.expiry_date) continue;
      const rest = daysBetween(x.ship_date, l.expiry_date); const min = mins.has(partyKey(x.customer)) ? mins.get(partyKey(x.customer)) : s.default_min_days;
      if (rest < 0) f.push(finding('shipped_expired', null, `Shipment ${x.shipment} to ${x.customer || '?'} on ${x.ship_date} carried lot ${l.lot}, expired ${l.expiry_date}.`));
      else if (rest < min) f.push(finding('short_dated_shipment', null, `Shipment ${x.shipment} to ${x.customer || '?'} on ${x.ship_date} carried lot ${l.lot} with ${rest} days left; the customer needs ${min}.`));
      const older = (byItem.get(itemKey(l.item)) || []).filter((o) => o !== l && o.expiry_date && o.expiry_date < l.expiry_date && o.expiry_date >= x.ship_date && (!o.mfg_date || o.mfg_date <= x.ship_date) && o.on_hand > 0);
      if (older.length) f.push(finding('fefo_skipped', null, `Shipment ${x.shipment} on ${x.ship_date} took lot ${l.lot} (expires ${l.expiry_date}) while ${older.map((o) => `${o.lot} (expires ${o.expiry_date})`).join(', ')} was in stock and is still on hand.`, 'review'));
    }
    return { lot: str(l.lot), item: str(l.item), location: str(l.location), on_hand: l.on_hand, expiry_date: l.expiry_date || null, days_left: left, value, shipments: ships.length, status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.lot) < itemKey(b.lot) ? -1 : 1));
  return {
    as_of: today, lots: items.length, expired_value: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'expired_on_hand').reduce((y, f) => y + (f.amount || 0), 0), 0)),
    expiring_soon: items.filter((i) => i.findings.some((f) => f.code === 'expiring_soon')).length,
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function dispositionText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status === 'flag' || i.status === 'review');
  return ['# Lots to disposition', '', '**To:** [TO CONFIRM quality and inventory lead]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `As of ${r.as_of}: ${r.expired_value} of expired stock is on hand. Please decide for each lot below (hold, rework, scrap, return) and check the shipments named. Customers are not told by this note.`, '',
    '| Lot | Item | On hand | Expires | Detail |', '| --- | --- | --- | --- | --- |', ...rows.map((i) => `| ${i.lot} | ${i.item} | ${i.on_hand} | ${i.expiry_date || ''} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
