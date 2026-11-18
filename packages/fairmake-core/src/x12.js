// ASC X12 reader for the order-to-cash transaction sets the Fairmake agents use:
// 850 (purchase order), 810 (invoice), 856 (ship notice, ASN) and 997/999
// (functional acknowledgements).
//
// It reads the envelope (ISA/GS/ST and their trailers), checks the control
// numbers and counts, and turns each transaction into a flat record. Element
// positions follow the public X12 structure as recalled for version 004010;
// they were not checked against the licensed X12 implementation guides, and
// trading partners often differ. Every record keeps its raw segments so a person
// can check what was read.

const clean = (s) => String(s ?? '').trim();
/** N2 numbers (two implied decimals): "123456" is 1234.56. Plain decimals pass through. */
export const n2 = (v) => { const s = clean(v); if (!s) return null; if (/^-?\d+$/.test(s)) return Number(s) / 100; const n = Number(s); return Number.isFinite(n) ? n : null; };
const plain = (v) => { const s = clean(v); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const x12Date = (d) => { const s = clean(d); if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; if (/^\d{6}$/.test(s)) return `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`; return null; };
const x12Time = (t) => { const s = clean(t); return /^\d{4}/.test(s) ? `${s.slice(0, 2)}:${s.slice(2, 4)}` : null; };
export const x12DateTime = (d, t) => { const day = x12Date(d); if (!day) return null; const tm = x12Time(t); return tm ? `${day}T${tm}:00` : day; };

/** Detect the delimiters from the ISA segment. */
export function x12Delimiters(text) {
  const s = String(text).replace(/^﻿/, '');
  const at = s.indexOf('ISA');
  if (at < 0) throw new Error('not an X12 file: no ISA segment');
  const isa = s.slice(at);
  const element = isa[3];
  if (!element || /[A-Za-z0-9\s]/.test(element)) throw new Error('not an X12 file: ISA has no element separator');
  // ISA has 16 elements; the 16th (component separator) is one character, then the segment terminator.
  let pos = 0, count = 0;
  while (count < 16 && pos < isa.length) { if (isa[pos] === element) count++; pos++; }
  if (count < 16) throw new Error('ISA segment is cut short');
  const component = isa[pos];
  let segment = isa[pos + 1];
  if (segment === '\r' && isa[pos + 2] === '\n') segment = '\r\n';
  if (!segment) throw new Error('ISA segment has no terminator');
  return { element, component, segment, start: at };
}

/** Split an X12 file into segments (arrays of elements). Line breaks after terminators are ignored. */
export function x12Segments(text) {
  const d = x12Delimiters(text);
  const body = String(text).replace(/^﻿/, '').slice(d.start);
  const term = d.segment.trim() === '' ? /\r?\n/ : new RegExp(`${d.segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`);
  const segs = body.split(term).map((s) => s.replace(/^[\r\n]+/, '')).filter((s) => s.trim() !== '');
  return { delimiters: d, segments: segs.map((s, i) => ({ n: i + 1, id: s.split(d.element)[0].trim(), el: s.split(d.element), raw: s })) };
}

/**
 * Parse an X12 interchange into envelopes and transactions and check its
 * structure. Returns { interchanges, transactions, problems }.
 */
export function parseX12(text, { maxTransactions = 50000 } = {}) {
  const { delimiters, segments } = x12Segments(text);
  const problems = [];
  const interchanges = []; const transactions = [];
  let isa = null, gs = null, st = null;
  const p = (seg, code, message) => problems.push({ segment: seg ? seg.n : null, code, message });
  for (const seg of segments) {
    const e = seg.el;
    switch (seg.id) {
      case 'ISA':
        if (isa) p(seg, 'isa_not_closed', `ISA ${clean(isa.el[13])} has no IEA before the next ISA`);
        isa = { ...seg, control: clean(e[13]), sender: clean(e[6]), receiver: clean(e[8]), date: x12Date(e[9]), groups: 0 };
        interchanges.push({ control: isa.control, sender: isa.sender, receiver: isa.receiver, date: isa.date, version: clean(e[12]), usage: clean(e[15]) === 'T' ? 'test' : clean(e[15]) === 'P' ? 'production' : clean(e[15]) });
        break;
      case 'GS':
        if (!isa) p(seg, 'gs_outside_isa', 'GS before any ISA');
        if (gs) p(seg, 'gs_not_closed', `GS ${clean(gs.el[6])} has no GE`);
        gs = { ...seg, control: clean(e[6]), functional: clean(e[1]), version: clean(e[8]), sets: 0 };
        if (isa) isa.groups++;
        break;
      case 'ST':
        if (!gs) p(seg, 'st_outside_gs', 'ST before any GS');
        if (st) p(seg, 'st_not_closed', `ST ${clean(st.control)} has no SE`);
        st = { set: clean(e[1]), control: clean(e[2]), start: seg.n, segments: [seg] };
        if (gs) gs.sets++;
        break;
      case 'SE': {
        if (!st) { p(seg, 'se_outside_st', 'SE without ST'); break; }
        st.segments.push(seg);
        const declared = Number(clean(e[1])), actual = st.segments.length;
        if (declared !== actual) p(seg, 'se_count', `transaction ${st.set} ${st.control}: SE says ${declared} segment(s), found ${actual}`);
        if (clean(e[2]) !== st.control) p(seg, 'se_control', `transaction ${st.set}: SE control ${clean(e[2])} does not match ST control ${st.control}`);
        if (transactions.length < maxTransactions) transactions.push({ set: st.set, control: st.control, group: gs ? gs.control : null, interchange: isa ? isa.control : null, segments: st.segments });
        st = null; break;
      }
      case 'GE':
        if (!gs) { p(seg, 'ge_outside_gs', 'GE without GS'); break; }
        if (Number(clean(e[1])) !== gs.sets) p(seg, 'ge_count', `group ${gs.control}: GE says ${clean(e[1])} transaction(s), found ${gs.sets}`);
        if (clean(e[2]) !== gs.control) p(seg, 'ge_control', `GE control ${clean(e[2])} does not match GS control ${gs.control}`);
        gs = null; break;
      case 'IEA':
        if (!isa) { p(seg, 'iea_outside_isa', 'IEA without ISA'); break; }
        if (Number(clean(e[1])) !== isa.groups) p(seg, 'iea_count', `interchange ${isa.control}: IEA says ${clean(e[1])} group(s), found ${isa.groups}`);
        if (clean(e[2]) !== isa.control) p(seg, 'iea_control', `IEA control ${clean(e[2])} does not match ISA control ${isa.control}`);
        isa = null; break;
      default:
        if (st) st.segments.push(seg); else p(seg, 'segment_outside_st', `${seg.id} outside a transaction`);
    }
  }
  if (st) p(null, 'st_not_closed', `transaction ${st.set} ${st.control} has no SE`);
  if (gs) p(null, 'gs_not_closed', `group ${gs.control} has no GE`);
  if (isa) p(null, 'isa_not_closed', `interchange ${isa.control} has no IEA`);
  return { delimiters: { element: delimiters.element, component: delimiters.component, segment: delimiters.segment === '\r\n' ? '\\r\\n' : delimiters.segment }, interchanges, transactions, problems };
}

// --------------------------------------------------------------- extractors ----

const party = (segs, i) => {
  // N1 loop: N1, optional N2, N3 (street), N4 (city, state, postal, country)
  const n1 = segs[i].el; const out = { role: clean(n1[1]), name: clean(n1[2]), id: clean(n1[4]) };
  for (let j = i + 1; j < segs.length && ['N2', 'N3', 'N4'].includes(segs[j].id); j++) {
    const e = segs[j].el;
    if (segs[j].id === 'N3') out.street = clean(e[1]);
    if (segs[j].id === 'N4') Object.assign(out, { city: clean(e[1]), state: clean(e[2]), postal: clean(e[3]), country: clean(e[4]) || undefined });
  }
  return out;
};
const refs = (segs) => Object.fromEntries(segs.filter((s) => s.id === 'REF').map((s) => [clean(s.el[1]), clean(s.el[2])]).filter(([k, v]) => k && v));
const pick = (parties, ...roles) => parties.find((x) => roles.includes(x.role)) || null;
/** Product ids in a PO1/IT1/LIN segment from a start position: qualifier, id pairs (BP buyer part, VP vendor part, UP UPC, IN buyer item, SK SKU). */
function productIds(el, from) {
  const out = {};
  for (let k = from; k + 1 < el.length; k += 2) { const q = clean(el[k]), v = clean(el[k + 1]); if (q && v && !out[q]) out[q] = v; }
  return { buyer_part: out.BP || out.IN || out.SK || null, vendor_part: out.VP || out.VN || null, upc: out.UP || out.UK || out.EN || null };
}
const dtm = (segs, qual) => { const d = segs.find((x) => x.id === 'DTM' && clean(x.el[1]) === qual); return d ? x12Date(d.el[2]) : null; };

/** 850 Purchase Order (from a customer) → one order with lines. */
export function read850(tx) {
  const s = tx.segments; const beg = (s.find((x) => x.id === 'BEG') || { el: [] }).el;
  const parties = s.map((x, i) => (x.id === 'N1' ? party(s, i) : null)).filter(Boolean);
  const lines = s.filter((x) => x.id === 'PO1').map((x) => ({ line: clean(x.el[1]), qty: plain(x.el[2]), uom: clean(x.el[3]), unit_price: plain(x.el[4]), ...productIds(x.el, 6) }));
  const shipTo = pick(parties, 'ST', 'BY');
  return { set: '850', control: tx.control, purpose: clean(beg[1]), po_type: clean(beg[2]), po_number: clean(beg[3]), po_date: x12Date(beg[5]), requested_ship: dtm(s, '010') || dtm(s, '037'), requested_delivery: dtm(s, '002') || dtm(s, '074'), cancel_after: dtm(s, '001'), ship_to: shipTo ? shipTo.name : null, ship_to_id: shipTo ? shipTo.id : null, references: refs(s), lines, segments: s.length };
}

/** 810 Invoice (to a customer) → one invoice with lines. TDS is read as N2 (implied cents). */
export function read810(tx) {
  const s = tx.segments; const big = (s.find((x) => x.id === 'BIG') || { el: [] }).el; const tds = s.find((x) => x.id === 'TDS');
  const lines = s.filter((x) => x.id === 'IT1').map((x) => ({ line: clean(x.el[1]), qty: plain(x.el[2]), uom: clean(x.el[3]), unit_price: plain(x.el[4]), ...productIds(x.el, 6) }));
  const allowances = s.filter((x) => x.id === 'SAC').map((x) => ({ indicator: clean(x.el[1]) === 'A' ? 'allowance' : 'charge', code: clean(x.el[2]), amount: n2(x.el[5]) }));
  return { set: '810', control: tx.control, invoice_date: x12Date(big[1]), invoice_number: clean(big[2]), po_date: x12Date(big[3]), po_number: clean(big[4]), total: tds ? n2(tds.el[1]) : null, allowances, references: refs(s), lines, segments: s.length };
}

/** 856 Ship Notice / Manifest (ASN) → one shipment with orders, packs (SSCC) and items. */
export function read856(tx) {
  const s = tx.segments; const bsn = (s.find((x) => x.id === 'BSN') || { el: [] }).el;
  const td5 = s.find((x) => x.id === 'TD5');
  const out = { set: '856', control: tx.control, purpose: clean(bsn[1]), shipment_id: clean(bsn[2]), asn_date: x12DateTime(bsn[3], bsn[4]), ship_date: dtm(s, '011'), delivery_date: dtm(s, '017') || dtm(s, '067'), carrier: td5 ? clean(td5.el[3]) || clean(td5.el[5]) : null, bol: null, lines: [], packs: 0, segments: s.length };
  let po = null, sscc = null;
  for (const x of s) {
    if (x.id === 'REF' && ['BM', 'BOL'].includes(clean(x.el[1])) && !out.bol) out.bol = clean(x.el[2]);
    if (x.id === 'HL') { const level = clean(x.el[3]); if (level === 'O') { po = null; sscc = null; } if (level === 'P' || level === 'T') { sscc = null; out.packs++; } }
    if (x.id === 'PRF') po = clean(x.el[1]);
    if (x.id === 'MAN' && ['GM', 'SM', 'AA'].includes(clean(x.el[1]))) sscc = clean(x.el[2]);
    if (x.id === 'LIN') out.lines.push({ po_number: po, sscc, ...productIds(x.el, 2), qty: null, uom: null });
    if (x.id === 'SN1' && out.lines.length) { const l = out.lines[out.lines.length - 1]; l.qty = plain(x.el[2]); l.uom = clean(x.el[3]); }
  }
  return out;
}

/** 997 / 999 Functional acknowledgement. */
export function read997(tx) {
  const s = tx.segments; const ak1 = (s.find((x) => x.id === 'AK1') || { el: [] }).el; const ak9 = (s.find((x) => x.id === 'AK9') || { el: [] }).el;
  const sets = s.filter((x) => x.id === 'AK2').map((x) => ({ set: clean(x.el[1]), control: clean(x.el[2]) }));
  const statuses = s.filter((x) => x.id === 'AK5' || x.id === 'IK5').map((x) => clean(x.el[1]));
  sets.forEach((x, i) => { x.status = statuses[i] || null; });
  const code = clean(ak9[1]);
  return { set: tx.set, control: tx.control, acknowledges_group: clean(ak1[2]), functional: clean(ak1[1]), group_status: code === 'A' ? 'accepted' : code === 'E' ? 'accepted_with_errors' : code === 'R' ? 'rejected' : code === 'P' ? 'partially_accepted' : code || null, sets, segments: s.length };
}

export const X12_READERS = Object.freeze({ 810: read810, 850: read850, 856: read856, 997: read997, 999: read997 });

/** Parse and read every supported transaction in an X12 file. */
export function readX12(text, opts) {
  const p = parseX12(text, opts);
  const records = []; const skipped = {};
  for (const tx of p.transactions) {
    const fn = X12_READERS[tx.set];
    if (!fn) { skipped[tx.set] = (skipped[tx.set] || 0) + 1; continue; }
    try { records.push({ interchange: tx.interchange, group: tx.group, ...fn(tx) }); } catch (e) { p.problems.push({ segment: tx.segments[0] && tx.segments[0].n, code: 'read_failed', message: `${tx.set} ${tx.control}: ${String(e.message || e).slice(0, 200)}` }); }
  }
  return { ...p, transactions: undefined, transaction_count: p.transactions.length, records, skipped_sets: skipped };
}

/**
 * Flatten 850, 810 and 856 records into one row per line, for agents that take tables:
 * { doc_type: 'po'|'invoice'|'asn', doc_number, po_number, date, line, buyer_part, vendor_part, upc, qty, uom, unit_price, sscc, ship_to }.
 */
export function ediLines(records) {
  const rows = [];
  for (const r of records) {
    if (r.set === '850') for (const l of r.lines) rows.push({ doc_type: 'po', doc_number: r.po_number, po_number: r.po_number, date: r.po_date, line: l.line, buyer_part: l.buyer_part, vendor_part: l.vendor_part, upc: l.upc, qty: l.qty, uom: l.uom, unit_price: l.unit_price, sscc: null, ship_to: r.ship_to, requested_delivery: r.requested_delivery });
    if (r.set === '810') for (const l of r.lines) rows.push({ doc_type: 'invoice', doc_number: r.invoice_number, po_number: r.po_number, date: r.invoice_date, line: l.line, buyer_part: l.buyer_part, vendor_part: l.vendor_part, upc: l.upc, qty: l.qty, uom: l.uom, unit_price: l.unit_price, sscc: null, ship_to: null });
    if (r.set === '856') r.lines.forEach((l, k) => rows.push({ doc_type: 'asn', doc_number: r.shipment_id, po_number: l.po_number, date: r.ship_date || String(r.asn_date || '').slice(0, 10) || null, line: String(k + 1), buyer_part: l.buyer_part, vendor_part: l.vendor_part, upc: l.upc, qty: l.qty, uom: l.uom, unit_price: null, sscc: l.sscc, ship_to: null, asn_date: r.asn_date }));
  }
  return rows;
}
