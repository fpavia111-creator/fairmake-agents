// Tariff code consistency: tariff (HTS) codes and countries of origin in the item master, checked for gaps and format,
// against your own list of codes, and against the codes, origins and duty rates used on customs entry lines.
// It never says what a code should be.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, str, itemKey, groupBy } from 'fairmake-core';
import { normalizeName } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const ITEM_FIELDS = Object.freeze({
  item: t(['Item', 'Part', 'Part Number', 'Inventory ID', 'SKU', 'Item No.'], { required: true }),
  description: t(['Description', 'Item Description', 'Name']),
  hts_code: t(['HTS Code', 'HTS', 'Tariff Code', 'HS Code', 'Harmonized Code', 'Commodity Code'], { translate: 'hts' }),
  country_of_origin: t(['Country of Origin', 'COO', 'Origin', 'Origin Country']),
  supplier: t(['Supplier', 'Vendor', 'Preferred Vendor']),
});
export const ENTRY_FIELDS = Object.freeze({
  entry_line: t(['Entry Line', 'Entry Line ID', 'Line ID'], { required: true }),
  item: t(['Item', 'Part', 'Part Number', 'Part No.']),
  hts_code: t(['HTS Code', 'HTS', 'Tariff Number', 'HS Code'], { translate: 'hts' }),
  country_of_origin: t(['Country of Origin', 'COO', 'Origin']),
  duty_rate: t(['Duty Rate', 'Duty %', 'Rate %', 'Ad Valorem Rate'], { type: 'number' }),
  entered_value: t(['Entered Value', 'Value', 'Customs Value'], { type: 'money' }),
});
/** Acumatica stock items. Written from knowledge of the export; not checked against a live system. */
export const ITEM_PROFILES = Object.freeze([
  exportProfile('acumatica_stock_items', { item: 'Inventory ID', description: 'Description', hts_code: 'Tariff Code', country_of_origin: 'Country of Origin', supplier: 'Preferred Vendor' }, { note: 'Acumatica stock items list: tariff code and country of origin as kept in the item master.' }),
]);

export const DEFAULTS = Object.freeze({ codes: {} });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    codes: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false, properties: { duty_pct: { type: 'number', minimum: 0, maximum: 1000 }, note: { type: 'string' } } }, description: 'Your own list of tariff codes in use (from your broker or classification file), with the duty % you expect for each' },
  },
});
const digits = (v) => str(v).replace(/[^0-9]/g, '');
const fmt = (v) => { const d = digits(v); return d.length === 10 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}` : d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}` : str(v); };

/** Check the item master and entry lines. Finding codes: missing_hts, hts_format, hts_not_in_list, missing_coo, entry_hts_differs, entry_coo_differs, duty_rate_differs, same_description_split. */
export function htsCodes({ items, entries }, s = DEFAULTS) {
  const list = new Map(Object.entries(s.codes || {}).map(([k, v]) => [digits(k), v]));
  const E = groupBy(entries.filter((e) => str(e.entry_line) && str(e.item)), (e) => itemKey(e.item));
  const M = [...groupBy(items.filter((i) => str(i.item)), (i) => itemKey(i.item)).values()].map((xs) => xs[0]);
  const byDesc = groupBy(M.filter((i) => digits(i.hts_code).length >= 6 && str(i.description)), (i) => normalizeName(i.description, { stripEntity: false }));
  const out = M.map((i) => {
    const code = digits(i.hts_code); const f = [];
    if (!code) f.push(finding('missing_hts', null, `${i.item} has no tariff code in the item master.`));
    else if (![6, 8, 10].includes(code.length)) f.push(finding('hts_format', null, `${i.item} has tariff code "${str(i.hts_code)}", which is not 6, 8 or 10 digits.`, 'review'));
    else if (list.size && !list.has(code)) f.push(finding('hts_not_in_list', null, `${i.item} uses ${fmt(code)}, which is not in your list of codes.`, 'review'));
    if (!str(i.country_of_origin)) f.push(finding('missing_coo', null, `${i.item} has no country of origin.`, 'review'));
    const same = byDesc.get(normalizeName(i.description || '', { stripEntity: false })) || [];
    const others = same.filter((o) => o !== i && digits(o.hts_code).slice(0, 6) !== code.slice(0, 6));
    if (code && others.length) f.push(finding('same_description_split', null, `${i.item} and ${others.map((o) => o.item).join(', ')} share the description "${str(i.description)}" but sit under different headings (${fmt(code)} and ${others.map((o) => fmt(o.hts_code)).join(', ')}).`, 'watch'));
    let duty = 0;
    for (const e of (E.get(itemKey(i.item)) || []).sort((a, b) => (itemKey(a.entry_line) < itemKey(b.entry_line) ? -1 : 1))) {
      const ec = digits(e.hts_code);
      if (code && ec && ec !== code) f.push(finding('entry_hts_differs', null, `Entry line ${e.entry_line} declared ${i.item} under ${fmt(ec)}; the item master says ${fmt(code)}.`));
      if (str(e.country_of_origin) && str(i.country_of_origin) && str(e.country_of_origin).toUpperCase() !== str(i.country_of_origin).toUpperCase()) f.push(finding('entry_coo_differs', null, `Entry line ${e.entry_line} declared origin ${e.country_of_origin}; the item master says ${i.country_of_origin}.`, 'review'));
      const expected = list.get(ec || code);
      if (expected && expected.duty_pct !== undefined && e.duty_rate !== null && e.duty_rate !== undefined && Math.abs(e.duty_rate - expected.duty_pct) > 0.001) {
        const amt = round2(Math.abs(e.duty_rate - expected.duty_pct) / 100 * (e.entered_value ?? 0)); duty += amt;
        f.push(finding('duty_rate_differs', amt || null, `Entry line ${e.entry_line}: duty ${e.duty_rate}% on ${fmt(ec || code)}, your list says ${expected.duty_pct}% (${amt} on ${e.entered_value ?? '?'} entered value, ${e.duty_rate > expected.duty_pct ? 'possibly overpaid' : 'possibly underpaid'}).`));
      }
    }
    return { item: str(i.item), description: str(i.description), hts_code: code ? fmt(code) : '', country_of_origin: str(i.country_of_origin), supplier: str(i.supplier), entry_lines: (E.get(itemKey(i.item)) || []).length, duty_difference: round2(duty), status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.item) < itemKey(b.item) ? -1 : 1));
  const masterKeys = new Set(M.map((i) => itemKey(i.item)));
  const unknown = entries.filter((e) => str(e.item) && !masterKeys.has(itemKey(e.item))).map((e) => str(e.item));
  return {
    items_checked: out.length, entry_lines: entries.length, entry_items_not_in_master: [...new Set(unknown)].sort(), duty_difference: round2(out.reduce((x, i) => x + i.duty_difference, 0)),
    flag: out.filter((i) => i.status === 'flag').length, review: out.filter((i) => i.status === 'review').length, watch: out.filter((i) => i.status === 'watch').length, ok: out.filter((i) => i.status === 'ok').length,
    by_finding: tallyFindings(out), by_status: countBy(out), items: out,
  };
}

export function brokerQueryText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status === 'flag' || i.status === 'review');
  return ['# Tariff code questions for our customs broker', '', '**To:** [TO CONFIRM customs broker contact]', `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    'Our item master and recent entries disagree on the items below. Please confirm the correct classification, origin and duty for each; we have not changed anything.', '',
    '| Item | Description | Item master code | Origin | Question |', '| --- | --- | --- | --- | --- |', ...rows.map((i) => `| ${i.item} | ${i.description} | ${i.hts_code} | ${i.country_of_origin} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
