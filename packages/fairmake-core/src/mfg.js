// Manufacturing and distribution helpers shared by the Fairmake agents. Pure functions, no I/O.
//
// Nothing here is an accounting standard, a costing method a plant must use, or a rule
// of law. Thresholds (variance tolerance, aging buckets, count tolerances by ABC class)
// are working defaults that a buyer overrides in a settings file; every agent says which
// defaults it used.
import { normalizeName } from './text.js';
import { readNumber } from './intl.js';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const round4 = (n) => Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
export const num = (v) => { if (v === null || v === undefined || v === '') return null; if (typeof v === 'number') return Number.isFinite(v) ? v : null; const n = readNumber(v); return Number.isFinite(n) ? n : null; };
export const sum = (xs) => round2(xs.reduce((s, x) => s + (Number(x) || 0), 0));
export const str = (v) => String(v ?? '').trim();
/** a / b as a percentage with one decimal, or null when b is 0 or missing. */
export const pct = (a, b) => { const x = Number(a), y = Number(b); return Number.isFinite(x) && Number.isFinite(y) && y !== 0 ? Math.round((x / y) * 1000) / 10 : null; };
/** Ratio with four decimals, or null. */
export const ratio = (a, b) => { const x = Number(a), y = Number(b); return Number.isFinite(x) && Number.isFinite(y) && y !== 0 ? round4(x / y) : null; };

// ------------------------------------------------------------- items, parties ----

/**
 * Key for a part number, SKU or item code: trimmed, upper case, inner spaces folded.
 * Dashes and leading zeros are kept, because "AB-100" and "AB100" can be two parts in
 * one item master. Use the item master's own aliases when they are the same part.
 */
export function itemKey(v) {
  return str(v).normalize('NFKC').toUpperCase().replace(/\s+/g, ' ');
}

/** Key for a supplier, customer or retailer name: legal forms dropped ("Acme Castings, Inc." = "ACME CASTINGS"). Codes such as "V1001" stay as they are. */
export function partyKey(v) {
  const s = str(v);
  if (!s) return '';
  if (/^[A-Z0-9][A-Z0-9_-]{1,15}$/.test(s) && /\d/.test(s)) return s.toLowerCase();
  return normalizeName(s) || normalizeName(s, { stripEntity: false }) || s.toLowerCase();
}

/** True when two names or codes name the same party (same key). */
export const sameParty = (a, b) => { const x = partyKey(a), y = partyKey(b); return !!x && x === y; };

/** A test for "is this the party the person named?": partyIs(wanted)(name). */
export const partyIs = (wanted) => { const w = partyKey(wanted); return (name) => !!w && partyKey(name) === w; };

/** Group rows by a key function into a Map, keeping order. */
export function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}

/** Stable sort by a string key (ties keep input order). */
export function sortBy(rows, key) {
  return rows.map((r, i) => ({ r, i, k: String(key(r)) })).sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i)).map((x) => x.r);
}

// ------------------------------------------------------------------- dates ----

const DAY = 86400000;
const toMs = (v) => { const s = str(v); if (!s) return NaN; const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}Z`; return Date.parse(iso); };
export const isoDate = (v) => { const t = toMs(v); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null; };
export function daysBetween(a, b) { const x = toMs(a), y = toMs(b); return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / DAY) : null; }
export function hoursBetween(a, b) { const x = toMs(a), y = toMs(b); return Number.isFinite(x) && Number.isFinite(y) ? Math.round(((y - x) / 3600000) * 100) / 100 : null; }
export function addDays(d, n) { const t = toMs(d); return Number.isFinite(t) ? new Date(t + n * DAY).toISOString().slice(0, 10) : null; }
export const inWindow = (d, from, to) => { const x = isoDate(d); return !!x && (!from || x >= isoDate(from)) && (!to || x <= isoDate(to)); };
/** Today as YYYY-MM-DD, or the as_of date a caller passed. */
export const asOfDate = (v) => isoDate(v) || new Date().toISOString().slice(0, 10);
/** Monday of the ISO week a date falls in (YYYY-MM-DD). */
export function weekStart(d) { const t = toMs(isoDate(d)); if (!Number.isFinite(t)) return null; const wd = (new Date(t).getUTCDay() + 6) % 7; return new Date(t - wd * DAY).toISOString().slice(0, 10); }
/** Months between two dates, one decimal (30.44 days a month). */
export function monthsBetween(a, b) { const d = daysBetween(a, b); return d === null ? null : Math.round((d / 30.44) * 10) / 10; }
/** The bucket label a number of days falls in: agingBucket(45, [30, 60, 90]) -> "31-60". */
export function agingBucket(days, edges = [30, 60, 90]) {
  if (days === null || days === undefined || !Number.isFinite(Number(days))) return 'unknown';
  let lo = 0;
  for (const e of edges) { if (days <= e) return `${lo}-${e}`; lo = e + 1; }
  return `${edges[edges.length - 1]}+`;
}

// ---------------------------------------------------------------- findings ----

/** One finding on an item: { code, amount, detail }. amount is money (or null when there is none). */
export const finding = (code, amount, detail) => ({ code, amount: amount === null || amount === undefined || !Number.isFinite(Number(amount)) ? null : round2(amount), detail });

/** Count and total findings by code across items: { code: { count, amount } }. Codes are sorted. */
export function tallyFindings(items) {
  const by = {};
  for (const i of items) for (const f of i.findings || []) { const b = by[f.code] || (by[f.code] = { count: 0, amount: 0 }); b.count++; b.amount = round2(b.amount + (Number(f.amount) || 0)); }
  return Object.fromEntries(Object.entries(by).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** Count items by status: { status: n }, sorted by status. */
export function countBy(items, key = 'status') {
  const out = {};
  for (const i of items) { const k = String(i[key] ?? ''); out[k] = (out[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** Rows for a "By finding" report section. */
export const findingRows = (byFinding) => Object.entries(byFinding).map(([code, v]) => ({ code, count: v.count, amount: v.amount }));

/** True when a yes/no text reads as yes ("Y", "yes", "true", "1", "x", "ja", "oui", "sí", "sim", "はい", "是", "예"). */
export function yes(v) {
  return /^(y|yes|true|1|x|ja|oui|si|sí|sim|はい|是|예|t|on)$/i.test(str(v));
}
