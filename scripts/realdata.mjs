#!/usr/bin/env node
// Real public data, in its published format, through the agents. Nothing private is used.
// Downloads go to _realdata/ (git-ignored); only this script and the results are committed.
//
//   node scripts/realdata.mjs --download     fetch the public files (needs the network, about 100 MB)
//   node scripts/realdata.mjs                run the agents on them, re-count independently, write docs/realdata-<date>.md and .json
//
// Sources
//   1. U.S. Department of Labor, OSHA, Injury Tracking Application (ITA) Case Detail Data for 2024
//      (cases from employers' Forms 300 and 301, published at osha.gov/itadata). The script keeps
//      manufacturing establishments (NAICS 31 to 33) in one state, with OSHA's own column names and
//      formats (outcome codes 1 to 4, dates like 16JAN2024), and runs fairmake-osha-300-log on that
//      file. Every case is re-counted here with separate code written from the form's rules, and the
//      two are compared case by case. The published data has no employee names and no return dates.
//   2. U.S. International Trade Commission, Harmonized Tariff Schedule of the United States, current
//      edition, JSON export (hts.usitc.gov). Every 10-digit statistical line becomes one item (and,
//      where the general duty is a plain percentage or Free, one entry line), and every 8- and 10-digit
//      number goes into the code list, so fairmake-hts-codes should report nothing: any finding is a
//      false positive of its format, list or duty rules.
import { createReadStream, mkdirSync, openSync, readSync, closeSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInflateRaw } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AgentRuntime } from '../packages/fairmake-core/src/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RD = join(ROOT, '_realdata');
const DATE = '2026-11-19';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; fairmake-agents real-data test; github.com/fpavia111-creator/fairmake-agents)' };
const STATE = 'OH';
const OSHA = { url: 'https://www.osha.gov/sites/default/files/ITA_Case_Detail_Data_2024_through_12-31-2025.zip', page: 'https://www.osha.gov/Establishment-Specific-Injury-and-Illness-Data', file: 'osha/ita-case-detail-2024.zip' };
const HTS = { url: 'https://hts.usitc.gov/reststop/exportList?from=0101&to=9999&format=JSON&styles=false', page: 'https://hts.usitc.gov/', file: 'hts/hts-export.json' };

async function download(url, file) {
  const p = join(RD, file); mkdirSync(dirname(p), { recursive: true });
  const res = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  console.log(`downloaded ${file} (${Math.round(statSync(p).size / 1e6)} MB)`);
}

// ---------------------------------------------------------------- zip and CSV streams ----
// The OSHA file is one CSV of about 520 MB inside a zip: read it as a stream, never whole.
function zipEntryStream(path) {
  const size = statSync(path).size; const fd = openSync(path, 'r');
  const tail = Buffer.alloc(Math.min(size, 65557)); readSync(fd, tail, 0, tail.length, size - tail.length);
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); if (eocd < 0) throw new Error('not a zip file');
  const cdOffset = tail.readUInt32LE(eocd + 16);
  const cd = Buffer.alloc(46); readSync(fd, cd, 0, 46, cdOffset);
  const method = cd.readUInt16LE(10), csize = cd.readUInt32LE(20), local = cd.readUInt32LE(42);
  const lh = Buffer.alloc(30); readSync(fd, lh, 0, 30, local); closeSync(fd);
  const start = local + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
  const raw = createReadStream(path, { start, end: start + csize - 1 });
  const out = method === 8 ? raw.pipe(createInflateRaw()) : raw;
  out.setEncoding('utf8');
  return out;
}
async function* csvRows(stream) {
  let field = '', row = [], q = false, pendingQuote = false;
  for await (const s of stream) {
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (pendingQuote) { pendingQuote = false; if (ch === '"') { field += '"'; continue; } q = false; }
      if (q) { if (ch === '"') pendingQuote = true; else field += ch; continue; }
      if (ch === '"') q = true; else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n') { row.push(field.replace(/\r$/, '')); yield row; row = []; field = ''; } else field += ch;
    }
  }
  if (field || row.length) { row.push(field); yield row; }
}
const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const int = (v) => Math.trunc(Number(String(v || '0').trim()) || 0);

async function callAll(manifest, root, tool, args) {
  // Every item with a finding, whatever the limit: one call per status.
  const rt = new AgentRuntime(manifest, { root, audit: false, memory: false });
  const items = []; let summary = null, result = null;
  for (const status of ['flag', 'review', 'watch']) {
    const r = await rt.call(tool, { ...args, status, limit: 5000 });
    if (r.status !== 'executed') throw new Error(`${tool}: ${r.status} ${r.error || ''}`);
    if (r.result.items_total > 5000 && r.result.items.length === 5000) throw new Error(`${tool}: more than 5000 ${status} items`);
    items.push(...r.result.items); summary = r.result.summary; result = r.result;
  }
  return { items, summary, result };
}

// ---------------------------------------------------------------- 1. OSHA ITA case data ----
const KEEP = ['establishment_id', 'case_number', 'job_description', 'date_of_incident', 'incident_outcome', 'dafw_num_away', 'djtr_num_tr', 'type_of_incident', 'NEW_INCIDENT_LOCATION', 'NEW_INCIDENT_DESCRIPTION', 'naics_code', 'state'];
async function osha() {
  const rel = `osha/${STATE.toLowerCase()}-manufacturing-2024.csv`;
  let idx = null, total = 0, mfg = 0; const rows = [];
  for await (const r of csvRows(zipEntryStream(join(RD, OSHA.file)))) {
    if (!idx) { idx = Object.fromEntries(r.map((h, i) => [h.trim(), i])); for (const k of KEEP) if (!(k in idx)) throw new Error(`OSHA file has no column ${k}`); continue; }
    total++;
    const naics = r[idx.naics_code] || '';
    if (!/^3[1-3]/.test(naics)) continue; mfg++;
    if ((r[idx.state] || '').trim() !== STATE) continue;
    rows.push(Object.fromEntries(KEEP.map((k) => [k, (r[idx[k]] ?? '').trim()])));
  }
  writeFileSync(join(RD, rel), [KEEP.join(','), ...rows.map((x) => KEEP.map((k) => cell(x[k])).join(','))].join('\n') + '\n');

  // Independent re-count from OSHA's form rules (written separately from the agent).
  const expect = new Map();
  for (const x of rows) {
    const o = x.incident_outcome, away = int(x.dafw_num_away), rest = int(x.djtr_num_tr); const c = new Set();
    if (!x.job_description || !x.date_of_incident || !x.NEW_INCIDENT_LOCATION || !x.NEW_INCIDENT_DESCRIPTION || !x.type_of_incident || !o) c.add('missing_field');
    if ((o === '3' || o === '4') && away > 0) c.add('outcome_days_mismatch');
    if (o === '4' && rest > 0) c.add('outcome_days_mismatch');
    if (o === '2' && away === 0) c.add('days_missing');
    if (o === '3' && rest === 0) c.add('days_missing');
    if (away + rest > 180) c.add('days_over_cap');
    expect.set(`${x.establishment_id} #${x.case_number}`, c);
  }
  const { manifest } = await import(pathToFileURL(join(ROOT, 'packages', 'fairmake-osha-300-log', 'src', 'index.js')).href);
  const t0 = Date.now();
  const { items, summary, result } = await callAll(manifest, RD, 'osha_log_check', { cases: rel });
  const ms = Date.now() - t0;
  const got = new Map(items.map((i) => [i.case_number, new Set(i.findings.map((f) => f.code))]));
  const disagree = [];
  for (const [k, c] of expect) { const g = got.get(k) || new Set(); const a = [...c].sort().join(' '), b = [...g].sort().join(' '); if (a !== b) disagree.push({ case: k, recount: a, agent: b }); }
  for (const k of got.keys()) if (!expect.has(k)) disagree.push({ case: k, recount: '(not in file)', agent: [...got.get(k)].join(' ') });
  const byCode = {}; for (const i of items) for (const f of i.findings) byCode[f.code] = (byCode[f.code] || 0) + 1;
  const outcomes = {}; for (const x of rows) outcomes[x.incident_outcome || 'blank'] = (outcomes[x.incident_outcome || 'blank'] || 0) + 1;
  const ests = new Set(rows.map((x) => x.establishment_id)).size;
  // Examples without establishment or narrative: outcome code and day counts only.
  const examples = {};
  for (const i of items) for (const f of i.findings) { (examples[f.code] ||= []); if (examples[f.code].length < 3) { const x = rows.find((y) => `${y.establishment_id} #${y.case_number}` === i.case_number); examples[f.code].push(`outcome ${x.incident_outcome}, ${x.dafw_num_away} days away, ${x.djtr_num_tr} restricted${f.code === 'missing_field' ? `, ${f.detail.replace(/^Case .*? is missing /, 'missing ')}` : ''}`); } }
  return { source: 'OSHA ITA Case Detail Data 2024', url: OSHA.page, file_url: OSHA.url, licence: 'U.S. government work (public domain), published by OSHA', rows_in_file: total, manufacturing_rows: mfg, state: STATE, cases: rows.length, establishments: ests, outcomes, agent_summary: summary, cases_with_findings: items.length, findings_by_code: byCode, recount_disagreements: disagree.length, disagreement_examples: disagree.slice(0, 10), examples, ms, return_dates_found: result.return_dates_found };
}

// ---------------------------------------------------------------- 2. USITC tariff schedule ----
async function hts() {
  const lines = JSON.parse(readFileSync(join(RD, HTS.file), 'utf8'));
  const digits = (s) => String(s || '').replace(/[^0-9]/g, '');
  const rateOf = (g) => { const s = String(g || '').trim(); if (/^free$/i.test(s)) return 0; const m = /^(\d+(?:\.\d+)?)%$/.exec(s); return m ? Number(m[1]) : s ? 'other' : null; };
  const codes = {}; const items = []; const entries = []; let parent = null; let other = 0;
  for (const l of lines) {
    const d = digits(l.htsno); if (!d) continue;
    if (d.length === 8) parent = { d, rate: rateOf(l.general) };
    if (d.length !== 8 && d.length !== 10) continue;
    let rate = rateOf(l.general); if (d.length === 10 && rate === null && parent && d.startsWith(parent.d)) rate = parent.rate;
    codes[l.htsno] = typeof rate === 'number' ? { duty_pct: rate } : {};
    if (rate === 'other') other++;
    if (d.length === 10) {
      items.push({ item: `HTS-${d}`, description: `${String(l.description || '').replace(/[\r\n]+/g, ' ').slice(0, 80)} (${l.htsno})`, hts_code: l.htsno, country_of_origin: 'US', supplier: 'Public tariff schedule' });
      if (typeof rate === 'number') entries.push({ entry_line: `E-${d}`, item: `HTS-${d}`, hts_code: l.htsno, country_of_origin: 'US', duty_rate: rate, entered_value: 1000 });
    }
  }
  const dir = join(RD, 'hts'); const csv = (rows) => [Object.keys(rows[0]).join(','), ...rows.map((r) => Object.values(r).map(cell).join(','))].join('\n') + '\n';
  writeFileSync(join(dir, 'items.csv'), csv(items)); writeFileSync(join(dir, 'entries.csv'), csv(entries));
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ note: 'Code list built from the USITC export: every 8- and 10-digit number, with the general duty where it is Free or a plain percentage.', codes }) + '\n');
  const { manifest } = await import(pathToFileURL(join(ROOT, 'packages', 'fairmake-hts-codes', 'src', 'index.js')).href);
  const t0 = Date.now();
  const { items: found, summary } = await callAll(manifest, RD, 'hts_check', { items: 'hts/items.csv', entries: 'hts/entries.csv', settings: 'hts/settings.json' });
  const ms = Date.now() - t0;
  const byCode = {}; for (const i of found) for (const f of i.findings) byCode[f.code] = (byCode[f.code] || 0) + 1;
  return { source: 'USITC Harmonized Tariff Schedule (current edition, JSON export)', url: HTS.page, file_url: HTS.url, licence: 'U.S. government work (public domain), published by the U.S. International Trade Commission', lines: lines.length, codes_in_list: Object.keys(codes).length, codes_with_specific_or_compound_duty: other, items: items.length, entry_lines: entries.length, agent_summary: summary, items_with_findings: found.length, findings_by_code: byCode, examples: found.slice(0, 5).map((i) => `${i.item}: ${i.findings.map((f) => f.detail).join(' ')}`), ms };
}

// ---------------------------------------------------------------- main ----
if (process.argv.includes('--download')) {
  await download(OSHA.url, OSHA.file);
  await download(HTS.url, HTS.file);
  process.exit(0);
}
for (const f of [OSHA.file, HTS.file]) if (!existsSync(join(RD, f))) { console.error(`missing _realdata/${f}: run with --download first`); process.exit(1); }
const res = { date: DATE, osha: await osha(), hts: await hts() };
const o = res.osha, h = res.hts;
console.log(`OSHA: ${o.cases} ${STATE} manufacturing cases (${o.establishments} establishments, of ${o.manufacturing_rows} manufacturing and ${o.rows_in_file} rows nationally): ${o.cases_with_findings} with findings ${JSON.stringify(o.findings_by_code)}; ${o.recount_disagreements} disagreement(s) with the re-count; ${o.ms} ms`);
console.log(`HTS: ${h.items} items, ${h.entry_lines} entry lines, ${h.codes_in_list} codes in the list: ${h.items_with_findings} item(s) with findings ${JSON.stringify(h.findings_by_code)}; ${h.ms} ms`);
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs', `realdata-${DATE}.json`), JSON.stringify(res, null, 2) + '\n');
const L = [`# Real public data through the agents (${DATE})`, '',
  'Made by `node scripts/realdata.mjs` (downloads with `--download` into the git-ignored `_realdata/`). Public files only, in the format their publisher uses; no customer or private data.', '',
  `## ${o.source}`, '', `- Source: ${o.url} (file: ${o.file_url}), downloaded ${DATE}. Licence: ${o.licence}.`,
  `- What ran: \`fairmake-osha-300-log\` on the ${o.cases.toLocaleString('en-US')} cases from ${o.establishments} manufacturing establishments (NAICS 31 to 33) in ${STATE === 'OH' ? 'Ohio' : STATE}, read in OSHA's own layout (${o.rows_in_file.toLocaleString('en-US')} rows in the national file, ${o.manufacturing_rows.toLocaleString('en-US')} of them manufacturing). Outcomes in the file: ${Object.entries(o.outcomes).map(([k, v]) => `code ${k}: ${v}`).join(', ')}. Time: ${(o.ms / 1000).toFixed(1)} s.`,
  `- Agent summary: ${o.agent_summary}`,
  `- Findings: ${Object.entries(o.findings_by_code).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'} (${o.cases_with_findings} cases).`,
  `- Independent re-count of every case from the form's rules: **${o.recount_disagreements} disagreement(s)**${o.recount_disagreements ? `: ${o.disagreement_examples.map((d) => `${d.case} re-count "${d.recount}" agent "${d.agent}"`).join('; ')}` : ''}.`,
  '- Examples (outcome code and day counts only; no establishment or narrative is reproduced here):', ...Object.entries(o.examples).map(([k, v]) => `  - ${k}: ${v.join('; ')}`),
  '- False positives: every finding agrees with the published numbers; whether each one is an error on the employer\'s log or a choice OSHA allows (for example days counted past the 180-day cap) is for the employer to say. The published data has no return dates, so no case is listed as open, and no names.', '',
  `## ${h.source}`, '', `- Source: ${h.url} (export: ${h.file_url}), downloaded ${DATE}. Licence: ${h.licence}.`,
  `- What ran: \`fairmake-hts-codes\` on ${h.items.toLocaleString('en-US')} items (one per 10-digit statistical line) and ${h.entry_lines.toLocaleString('en-US')} entry lines, with a code list of ${h.codes_in_list.toLocaleString('en-US')} 8- and 10-digit numbers (${h.codes_with_specific_or_compound_duty} have a specific or compound duty and are listed without a percentage). Time: ${(h.ms / 1000).toFixed(1)} s.`,
  `- Agent summary: ${h.agent_summary}`,
  `- Findings: ${Object.entries(h.findings_by_code).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}. Every finding here would be a false positive, since the items, entries and list are the schedule itself.${h.examples.length ? ` Examples: ${h.examples.join(' | ')}` : ''}`, ''];
writeFileSync(join(ROOT, 'docs', `realdata-${DATE}.md`), L.join('\n'));
console.log(`Wrote docs/realdata-${DATE}.md and .json`);
