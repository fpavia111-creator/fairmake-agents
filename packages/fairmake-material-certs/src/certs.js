// Material certificates on receipts: certificates missing where your spec requires one, certificates for another lot,
// measured properties outside your spec, and spec properties the certificate does not report.
import { exportProfile, finding, statusOf, tallyFindings, countBy, str, itemKey, partyKey, groupBy } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const RECEIPT_FIELDS = Object.freeze({
  receipt: t(['Receipt', 'Receipt Line', 'Receipt ID', 'GRN'], { required: true }),
  item: t(['Item', 'Part', 'Part Number', 'Material'], { required: true }),
  lot: t(['Lot', 'Heat', 'Heat Number', 'Lot Number', 'Batch']),
  supplier: t(['Supplier', 'Vendor', 'Mill']),
  receipt_date: t(['Receipt Date', 'Received', 'Date'], { type: 'date' }),
  cert_id: t(['Cert ID', 'Cert Number', 'Certificate', 'MTR', 'CoC Number'], { translate: false }),
});
export const CERT_FIELDS = Object.freeze({
  cert_id: t(['Cert ID', 'Cert Number', 'Certificate', 'MTR'], { required: true, translate: false }),
  lot: t(['Lot', 'Heat', 'Heat Number', 'Lot Number']),
  property: t(['Property', 'Test', 'Characteristic', 'Parameter'], { required: true }),
  value: t(['Value', 'Result', 'Measured', 'Reading'], { type: 'number' }),
});
/** Epicor Kinetic receipt lines. Written from knowledge of the export; not checked against a live system. */
export const RECEIPT_PROFILES = Object.freeze([
  exportProfile('epicor_receipts', { receipt: { from: ['Pack Slip', 'Part', 'Lot'], compute: (_r, get) => ['Pack Slip', 'Part', 'Lot'].map((k) => String(get(k) ?? '').trim()).join('/') }, item: 'Part', lot: 'Lot', supplier: 'Supplier', receipt_date: 'Receipt Date', cert_id: 'Cert Number' }, { note: 'Epicor Kinetic receipt entry lines: the receipt line id is the pack slip, part and lot.' }),
]);

export const SPECS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['items'],
  properties: {
    note: { type: 'string' },
    items: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false, properties: {
      cert_required: { type: 'boolean' },
      properties: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false, properties: { min: { type: 'number' }, max: { type: 'number' } } } },
    } } },
  },
});

/** Check every receipt line. Finding codes: cert_missing, cert_not_found, cert_lot_mismatch, out_of_spec, property_missing, no_spec. */
export function materialCerts({ receipts, certs, specs }) {
  const S = new Map(Object.entries(specs.items || {}).map(([k, v]) => [itemKey(k), v]));
  const C = groupBy(certs.filter((c) => str(c.cert_id)), (c) => itemKey(c.cert_id));
  const items = [...groupBy(receipts.filter((r) => str(r.receipt) && str(r.item)), (r) => itemKey(r.receipt)).values()].map((ls) => {
    const r = ls[0]; const spec = S.get(itemKey(r.item)); const f = []; const lines = str(r.cert_id) ? C.get(itemKey(r.cert_id)) : null;
    if (!spec) f.push(finding('no_spec', null, `${r.item} has no spec in the specs file, so its certificate is not checked.`, 'watch'));
    else {
      if (!str(r.cert_id)) { if (spec.cert_required) f.push(finding('cert_missing', null, `Receipt ${r.receipt} of ${r.item} lot ${r.lot || '?'} from ${r.supplier || '?'} has no certificate; your spec requires one.`)); }
      else if (certs.length && !lines) f.push(finding('cert_not_found', null, `Receipt ${r.receipt} names certificate ${r.cert_id}, which is not in the certificates file.`, 'review'));
      if (lines) {
        const certLot = lines.map((c) => str(c.lot)).find(Boolean);
        if (certLot && str(r.lot) && itemKey(certLot) !== itemKey(r.lot)) f.push(finding('cert_lot_mismatch', null, `Certificate ${r.cert_id} is for lot ${certLot}; receipt ${r.receipt} is lot ${r.lot}.`));
        const got = new Map(lines.map((c) => [str(c.property).toLowerCase(), c.value]));
        for (const [prop, lim] of Object.entries(spec.properties || {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
          const v = got.get(prop.toLowerCase());
          if (v === undefined || v === null) { f.push(finding('property_missing', null, `Certificate ${r.cert_id} does not report ${prop}.`, 'review')); continue; }
          if ((lim.min !== undefined && v < lim.min) || (lim.max !== undefined && v > lim.max)) f.push(finding('out_of_spec', null, `Certificate ${r.cert_id} reports ${prop} ${v}; your spec is ${lim.min !== undefined ? `min ${lim.min}` : ''}${lim.min !== undefined && lim.max !== undefined ? ', ' : ''}${lim.max !== undefined ? `max ${lim.max}` : ''}.`));
        }
      }
    }
    return { receipt: str(r.receipt), item: str(r.item), lot: str(r.lot), supplier: str(r.supplier), receipt_date: r.receipt_date || null, cert_id: str(r.cert_id), status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.receipt) < itemKey(b.receipt) ? -1 : 1));
  const by_supplier = [...groupBy(items, (i) => partyKey(i.supplier) || '(none)').values()].map((xs) => ({ supplier: xs[0].supplier || '(none)', receipts: xs.length, problems: xs.filter((i) => i.status === 'flag' || i.status === 'review').length })).sort((a, b) => b.problems - a.problems || (a.supplier < b.supplier ? -1 : 1));
  return {
    receipts: items.length, certificates: C.size, flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_supplier, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function certRequestText(lines, { supplier, from }) {
  const rows = lines.filter((i) => i.status === 'flag' || i.status === 'review');
  return { rows, text: [`# Certificate request: ${supplier}`, '', `**To:** [TO CONFIRM ${supplier} quality contact]`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    'For the receipts below we are missing a certificate, received one for another lot, or the certificate does not meet our purchase spec. Please send the correct certificate or tell us how you will handle the material.', '',
    '| Receipt | Item | Lot | Certificate | What is needed |', '| --- | --- | --- | --- | --- |', ...rows.map((i) => `| ${i.receipt} | ${i.item} | ${i.lot} | ${i.cert_id || 'none'} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n') };
}
