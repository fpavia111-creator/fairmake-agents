// One Fairmake agent from a short spec, so all of them have the same shape:
//
//   <prefix>_check          read    run the check on your exported files
//   <prefix>_explain        read    one item with its findings and the numbers behind them
//   <prefix>_write_report   report  CSV worklist (blank decision column) + HTML page (+ .ics when dates matter)
//   <prefix>_draft_<noun>   write   a draft marked DRAFT (optional)
//   <prefix>_request_<verb> action  one named person's click, even in Auto (optional)
//   refused tools, listed so a host model can see they exist and are refused.
//
// The factory reads every source through the core (column names, encodings, local dates
// and decimal marks), keeps only the columns the agent declares, trims every value, turns
// amounts, numbers and dates into one form, and sorts the rows by their content, so a result
// never depends on row order, column order or stray columns. Values in fields marked
// `personal: true` (people's names, contact details) are masked in everything returned to
// the AI model; the report and draft files written on the customer's machine keep them.
import { fileURLToPath } from 'node:url';
import { defineManifest } from './manifest.js';
import { MODEL_PIN, writeWorklist, draftPair, refusedTools } from './kit.js';
import { toIcs } from './formats.js';
import { sha256 } from './util.js';
import { demoRuntime, printStep } from './demo.js';
import { str, num, isoDate } from './mfg.js';
import { normalizeName } from './text.js';

export const FAIRMAKE_LIMITS = Object.freeze({
  files: 'Reads only the files you give it. It does not log in to an ERP, MES, CMMS, QMS, EDI network, bank, supplier or customer portal, and changes nothing in them.',
  settings: 'Thresholds and rules are settings in your own file, with working defaults listed in the result as settings_used. They are not a costing, quality or safety standard; check them against your own policies and contracts.',
  advice: 'Not legal, tax, customs, safety or accounting advice. A person decides what to change, post, send or pay.',
  masking: 'People\'s names in these files are masked in results returned to the AI model. The report and draft files written here keep the real values: keep them in a private folder.',
});

const LIMIT_ARG = { type: 'integer', minimum: 1, maximum: 5000, description: 'Most items to return to the model (the report file always has all of them; default 200)' };
const STATUS_ARG = { type: 'string', enum: ['flag', 'review', 'watch', 'ok'], description: 'Only return items with this status; totals still cover every item' };
const SETTINGS_ARG = { type: 'string', description: 'Optional settings JSON under --root; anything left out uses the defaults listed in the result as settings_used' };
const clip = (v, n = 80) => { const s = String(v ?? ''); return s.length > n ? `${s.slice(0, n)}…` : s; };
const keyOf = (v) => String(v ?? '').trim().toUpperCase();

// ---------------------------------------------------------------- masking ----

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const initials = (s) => { const w = str(s).split(/[\s,]+/).filter(Boolean); return w.length ? w.map((x) => x[0].toUpperCase()).join('.') + '.' : '?'; };
/** A stable masked token for a person's name: "D.R.#3f9a2c" (initials and a short hash). */
export function maskName(v) { const s = str(v); return s ? `${initials(s)}#${sha256(normalizeName(s, { stripEntity: false }) || s.toLowerCase()).slice(0, 6)}` : s; }

class Masker {
  constructor() { this.values = new Map(); this.re = null; }
  add(v) { const s = str(v); if (s.length < 3 || this.values.has(s)) return; this.values.set(s, maskName(s)); this.re = null; }
  resolve(x) { const s = str(x); const hits = [...this.values.entries()].filter(([, t]) => t === s).map(([v]) => v); return hits.length ? hits : [s]; }
  apply(o) {
    if (!this.values.size) return o;
    if (!this.re) this.re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...this.values.keys()].sort((a, b) => b.length - a.length).map(escRe).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
    const walk = (v) => {
      if (typeof v === 'string') return this.values.has(v) ? this.values.get(v) : v.replace(this.re, (m) => this.values.get(m) || m);
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
      return v;
    };
    return walk(o);
  }
}

// ----------------------------------------------------------------- reading ----

function project(row, fields) {
  const out = {};
  for (const [f, fd] of Object.entries(fields)) {
    let v = row[f];
    if (typeof v === 'string') v = v.trim();
    if (v === undefined || v === '') v = null;
    if (v !== null && fd && (fd.type === 'money' || fd.type === 'number')) { const n = num(v); v = n === null ? null : n; }
    if (v !== null && fd && fd.type === 'date') v = isoDate(v) || v;
    if (v !== null && typeof v === 'object') v = JSON.stringify(v);
    out[f] = v;
  }
  return out;
}
const rowKey = (r) => Object.values(r).map((v) => (v === null || v === undefined ? '' : String(v))).join('\u0001');
/** Merge a settings file over the defaults (one level deep for objects). */
export function mergeSettings(defaults, given) {
  const out = { ...defaults };
  for (const [k, v] of Object.entries(given || {})) {
    if (k === 'note') continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && defaults[k] && typeof defaults[k] === 'object' && !Array.isArray(defaults[k])) out[k] = { ...defaults[k], ...v };
    else out[k] = v;
  }
  return out;
}

/** The default one-line description of an item for the explain tool. */
export const describeItem = (key) => (i) => `${i[key]}: ${i.status}${i.findings && i.findings.length ? `. ${i.findings.map((f) => f.detail).join(' ')}` : '. Nothing to report.'}`;

/**
 * spec: {
 *   name, version, prefix, description,
 *   args: { name: schema }, required: [names],       file and option arguments shared by every tool
 *   sources: { kind: { label, args: [argName], fields, profiles? } },
 *   settings: { schema, defaults } | undefined,       adds a `settings` JSON argument
 *   run({ a, read, s, ctx }) -> r                     r.items: [{ <item.key>, status, findings: [{ code, amount, detail }] }]
 *   line(r) -> one sentence
 *   item: { key, arg, label, describe?(i) },
 *   check: { title, description },
 *   report: { base, title, rows(r), htmlColumns, sections?(r), limits?, ics?(r) },
 *   draft: { noun, verb, category, actor, description, args, required, build(r, a, s) -> { id, text, amount?, extra? } },
 *   refused: [{ name, category, description }],
 *   prompt: { name, title, text },
 * }
 */
export function defineFairmakeAgent(spec) {
  const { name, version, prefix, item, report } = spec;
  const required = spec.required || [];
  const OUT = spec.outDir || `fairmake-out/${prefix.replace(/_/g, '-')}`;
  const checkName = `${prefix}_check`;
  const args = { ...spec.args, ...(spec.settings ? { settings: SETTINGS_ARG } : {}) };
  const sources = spec.sources || {};
  const personal = new Set(Object.values(sources).flatMap((s) => Object.entries(s.fields).filter(([, fd]) => fd && fd.personal).map(([f]) => f)));
  const masked = personal.size > 0;
  const argKind = new Map(); for (const [kind, s] of Object.entries(sources)) for (const a of s.args || [kind]) argKind.set(a, kind);

  // Runs the agent's own logic once for a call. Masker collects personal values as files are read.
  function evaluate(a, ctx) {
    const masker = new Masker();
    const read = (argName) => {
      const p = a[argName];
      if (p === undefined || p === null || p === '') return [];
      const kind = argKind.get(argName);
      const raw = ctx.records(p, kind);
      const fields = kind ? sources[kind].fields : null;
      const rows = (fields ? raw.map((r) => project(r, fields)) : raw).map((r) => ({ r, k: rowKey(r) })).sort((x, y) => (x.k < y.k ? -1 : x.k > y.k ? 1 : 0)).map((x) => x.r);
      if (masked && fields) for (const r of rows) for (const f of personal) if (f in r && r[f] !== null) masker.add(r[f]);
      return rows;
    };
    const s = spec.settings ? mergeSettings(spec.settings.defaults, a.settings ? ctx.readJson(a.settings, 'settings') : {}) : {};
    const r = spec.run({ a, read, s, ctx });
    return { r: spec.settings ? { ...r, settings_used: s } : r, masker, s };
  }

  const checkProps = { ...args, status: STATUS_ARG, limit: LIMIT_ARG };
  const tools = [
    {
      name: checkName, kind: 'read', title: spec.check.title, description: spec.check.description,
      inputSchema: { type: 'object', additionalProperties: false, required, properties: checkProps },
      handler: async (a, ctx) => {
        const { r, masker } = evaluate(a, ctx);
        const list = a.status ? r.items.filter((i) => i.status === a.status) : r.items;
        const lim = a.limit || 200;
        return masker.apply({ summary: spec.line(r), ...r, items: list.slice(0, lim), items_total: r.items.length, items_shown: Math.min(lim, list.length) });
      },
    },
    {
      name: `${prefix}_explain`, kind: 'read', title: `Explain one ${item.label}`,
      description: `Show one ${item.label}'s figures and findings, from the same files as ${checkName}.`,
      inputSchema: { type: 'object', additionalProperties: false, required: [...required, item.arg], properties: { ...args, [item.arg]: { type: 'string', description: `The ${item.label} to explain, as it appears in the file or in ${checkName}` } } },
      handler: async (a, ctx) => {
        const { r, masker } = evaluate(a, ctx);
        const wanted = new Set(masker.resolve(a[item.arg]).map(keyOf));
        const hits = r.items.filter((i) => wanted.has(keyOf(i[item.key])));
        if (!hits.length) throw new Error(`${item.label} "${clip(a[item.arg])}" was not found; pass one from ${checkName}`);
        const describe = item.describe || describeItem(item.key);
        return masker.apply({ summary: hits.map(describe).join('\n'), items: hits });
      },
    },
    {
      name: `${prefix}_write_report`, kind: 'report', title: report.toolTitle || `Write the ${report.base} report`,
      description: report.description || `Write ${report.base}.csv (one row per ${item.label}, with a blank decision column for people to fill in) and ${report.base}.html${report.ics ? ', plus a calendar (.ics) of the due dates' : ''} into out_dir (default ${OUT}).`,
      inputSchema: { type: 'object', additionalProperties: false, required, properties: { ...args, out_dir: { type: 'string' } } },
      handler: async (a, ctx) => {
        const { r, masker } = evaluate(a, ctx);
        const rows = report.rows(r, a).map((x) => ({ ...x, decision: '' }));
        const columns = Object.keys(rows[0] || Object.fromEntries([...(report.htmlColumns || []), 'decision'].map((c) => [c, 0])));
        const title = typeof report.title === 'function' ? report.title(r, a) : report.title;
        const dir = a.out_dir || OUT;
        const limits = [...(report.limits || []), FAIRMAKE_LIMITS.files, FAIRMAKE_LIMITS.advice, ...(masked ? [FAIRMAKE_LIMITS.masking] : [])];
        const w = writeWorklist(ctx, dir, report.base, { title, intro: spec.line(r), rows, columns, htmlColumns: report.htmlColumns, labels: report.labels || {}, sections: report.sections ? report.sections(r, a) : [], limits });
        if (report.ics) {
          const cal = report.ics(r, a);
          if (cal && cal.events && cal.events.length) w.files.push(ctx.writeFile(ctx.outDir(dir), `${report.base}.ics`, toIcs(cal.events, { calName: cal.calName || title })));
        }
        return masker.apply({ summary: `${title} written: ${spec.line(r)}`, ...w });
      },
    },
  ];
  const rules = tools.map((t) => ({ tool: t.name, decision: 'allow' }));
  if (spec.draft) {
    const d = spec.draft;
    const pair = draftPair({
      prefix, noun: d.noun, verb: d.verb, category: d.category || 'binding_send', outDir: OUT, actor: d.actor || 'a person on your team',
      title: d.title, description: d.description, required: d.required || required, args: { ...args, ...(d.args || {}) },
      build: (a, ctx) => { const { r, s } = evaluate(a, ctx); return d.build(r, a, s); },
    });
    const [draftTool, reqTool] = pair.tools;
    // The draft file keeps real names (it is written on the customer's machine); its summary to the model is masked.
    const inner = draftTool.handler;
    draftTool.handler = async (a, ctx) => { const out = await inner(a, ctx); const { masker } = evaluate(a, ctx); return masker.apply(out); };
    tools.push(draftTool, reqTool); rules.push(...pair.rules);
  }
  const refused = refusedTools(spec.refused || []);
  tools.push(...refused.tools); rules.push(...refused.rules);
  rules.push({ tool: '*', decision: 'block', reason: `Not on the ${name} allowlist.` });
  return defineManifest({
    name, version, description: spec.description, model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
    configSchemas: spec.settings ? { settings: spec.settings.schema } : {}, sources, argDocs: spec.argDocs || {},
    prompts: spec.prompt ? [{ name: spec.prompt.name, title: spec.prompt.title, description: spec.prompt.description || spec.prompt.title, arguments: required.map((k) => ({ name: k, description: (args[k] && args[k].description) || k, required: true })), text: spec.prompt.text }] : [],
    tools, policy: { rules },
  });
}

/**
 * A demo on the agent's fictional fixtures in a temporary folder, with Auto opted in for the
 * draft only: the one-click request still waits, then a named person approves it.
 * demo: { intro, files, explain: { arg: value }, draft: { extra args } }
 */
export function fairmakeDemo(manifest, fixturesUrl, demo) {
  return async () => {
    const names = manifest.tools.map((t) => t.name);
    const draft = names.find((t) => /_draft_/.test(t)); const request = names.find((t) => /_request_/.test(t));
    const rt = demoRuntime(manifest, fileURLToPath(fixturesUrl), { mode: 'auto', autoActions: draft ? [draft] : [] });
    process.stdout.write(`${demo.intro} Auto mode is on for drafts only.\n`);
    const check = await rt.call(names[0], { ...demo.files, limit: 12 });
    printStep('Run the check on the exported files', check);
    for (const i of (check.result && check.result.items) || []) if (i.status !== 'ok') process.stdout.write(`    ${String(i.status).padEnd(12)} ${String(i[Object.keys(i)[0]]).slice(0, 30).padEnd(31)} ${(i.findings || []).map((f) => f.code).join(', ')}\n`);
    if (demo.explain) printStep(`Explain ${Object.values(demo.explain)[0]}`, await rt.call(names[1], { ...demo.files, ...demo.explain }));
    printStep('Write the report (CSV worklist and HTML page)', await rt.call(names[2], demo.files));
    if (draft && demo.draft) {
      const d = await rt.call(draft, { ...demo.files, ...demo.draft });
      printStep('Write the draft (Auto is opted in for drafts)', d);
      if (d.status === 'executed' && request) {
        const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Contact details confirmed by phone' };
        const s = await rt.call(request, args);
        printStep('Auto: approving the draft stays one named click', s);
        if (s.approval_id) { rt.approvals.approve(s.approval_id, 'Pat Planner (fictional)'); printStep('Same call after the named click (recorded; a person acts on it)', await rt.call(request, args)); }
      }
    }
    const refused = manifest.tools.find((t) => (manifest.policy.rules.find((r) => r.tool === t.name) || {}).decision === 'block');
    if (refused) printStep(`The agent tries ${refused.name} itself`, await rt.call(refused.name, {}));
  };
}
