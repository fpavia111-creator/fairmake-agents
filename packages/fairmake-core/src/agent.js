// One Fairmake agent from a short spec: the check, explain and report tools, the
// draft → one-click pair, the refused tools, the policy and a demo. Every agent keeps
// its own domain logic (a pure function over its rows) and its own manifest file;
// this only removes the wiring the thirty agents would otherwise repeat.
//
//   defineFairmakeAgent({
//     name, version, prefix, description,
//     args, required, sources, configSchemas,
//     run(a, ctx) -> r            r.items: [{ <item.key>, status, findings: [{ code, amount, detail }] }]
//     line(r) -> one sentence
//     item: { key, arg, label, describe?(i) }
//     check: { title, description },
//     report: { base, title, rows(r), columns?, htmlColumns, sections?(r), limits, ics?(r) },
//     draft: { noun, verb, category, actor, description, args, required, build(r, a, ctx) },
//     refused: [{ name, category, description }],
//     prompt: { name, title, description, text },
//     demo: { intro, args, explain, draft },
//   })
import { fileURLToPath } from 'node:url';
import { defineManifest } from './manifest.js';
import { MODEL_PIN, writeWorklist, draftPair, refusedTools } from './kit.js';
import { toIcs } from './formats.js';
import { demoRuntime, printStep } from './demo.js';

const clip = (v, n = 80) => { const s = String(v ?? ''); return s.length > n ? `${s.slice(0, n)}…` : s; };
const keyOf = (v) => String(v ?? '').trim().toUpperCase();

/** The default one-line description of an item for the explain tool. */
export const describeItem = (key) => (i) => `${i[key]}: ${i.status}${i.findings && i.findings.length ? `. ${i.findings.map((f) => f.detail).join(' ')}` : '. Nothing to report.'}`;

export function defineFairmakeAgent(spec) {
  const { name, version, prefix, args, required = [], item, report } = spec;
  const OUT = spec.outDir || `fairmake-out/${prefix}`;
  const checkName = (spec.check && spec.check.name) || `${prefix}_check`;
  const run = (a, ctx) => spec.run(a, ctx);
  const props = { ...args };
  const tools = [
    {
      name: checkName, kind: 'read', title: spec.check.title, description: spec.check.description,
      inputSchema: { type: 'object', additionalProperties: false, required, properties: props },
      handler: async (a, ctx) => { const r = run(a, ctx); return { summary: spec.line(r), ...r }; },
    },
    {
      name: `${prefix}_explain`, kind: 'read', title: `Explain one ${item.label}`,
      description: `Show one ${item.label}'s figures and findings, from the same files as ${checkName}.`,
      inputSchema: { type: 'object', additionalProperties: false, required: [...required, item.arg], properties: { ...props, [item.arg]: { type: 'string', description: `The ${item.label} to explain, as it appears in the file` } } },
      handler: async (a, ctx) => {
        const r = run(a, ctx);
        const want = keyOf(a[item.arg]);
        const hits = r.items.filter((i) => keyOf(i[item.key]) === want);
        if (!hits.length) throw new Error(`${item.label} "${clip(a[item.arg])}" was not found; pass one from ${checkName}`);
        const describe = item.describe || describeItem(item.key);
        return { summary: hits.map(describe).join('\n'), items: hits };
      },
    },
    {
      name: `${prefix}_write_report`, kind: 'report', title: report.toolTitle || `Write the ${report.base} report`,
      description: report.description || `Write ${report.base}.csv (one row per ${item.label}, with a decision column for people to fill in) and ${report.base}.html${report.ics ? ' and a calendar (.ics) of due dates' : ''} into out_dir (default ${OUT}).`,
      inputSchema: { type: 'object', additionalProperties: false, required, properties: { ...props, out_dir: { type: 'string' } } },
      handler: async (a, ctx) => {
        const r = run(a, ctx);
        const rows = report.rows(r, a);
        const columns = report.columns || Object.keys(rows[0] || Object.fromEntries((report.htmlColumns || []).map((c) => [c, 0])));
        const title = typeof report.title === 'function' ? report.title(r, a) : report.title;
        const dir = a.out_dir || OUT;
        const w = writeWorklist(ctx, dir, report.base, { title, intro: spec.line(r), rows, columns, htmlColumns: report.htmlColumns, labels: report.labels || {}, sections: report.sections ? report.sections(r, a) : [], limits: report.limits || [] });
        if (report.ics) {
          const cal = report.ics(r, a);
          if (cal && cal.events && cal.events.length) w.files.push(ctx.writeFile(ctx.outDir(dir), cal.file || `${report.base}.ics`, toIcs(cal.events, { calName: cal.calName || title })));
        }
        return { summary: `${title} written: ${spec.line(r)}`, ...w };
      },
    },
  ];
  const rules = tools.map((t) => ({ tool: t.name, decision: 'allow' }));
  if (spec.draft) {
    const d = spec.draft;
    const pair = draftPair({
      prefix, noun: d.noun, verb: d.verb, category: d.category || 'binding_send', outDir: OUT, actor: d.actor || 'a person on your team',
      title: d.title, description: d.description, required: d.required || required, args: { ...props, ...(d.args || {}) },
      build: (a, ctx) => d.build(run(a, ctx), a, ctx),
    });
    tools.push(...pair.tools); rules.push(...pair.rules);
  }
  const refused = refusedTools(spec.refused || []);
  tools.push(...refused.tools); rules.push(...refused.rules);
  rules.push({ tool: '*', decision: 'block', reason: `Not on the ${name} allowlist.` });
  return defineManifest({
    name, version, description: spec.description, model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
    configSchemas: spec.configSchemas || {}, sources: spec.sources || {}, argDocs: spec.argDocs || {},
    prompts: spec.prompt ? [{ name: spec.prompt.name, title: spec.prompt.title, description: spec.prompt.description || spec.prompt.title, arguments: spec.prompt.arguments || required.map((k) => ({ name: k, description: (args[k] && args[k].description) || k, required: true })), text: spec.prompt.text }] : [],
    tools, policy: { rules },
  });
}

/**
 * A demo on the agent's fictional fixtures, in a temporary folder, with Auto mode on for the
 * draft only (the one-click step still waits). demo: { intro, args, explain, draft, top }.
 */
export function fairmakeDemo(manifest, fixturesUrl, demo) {
  return async () => {
    const tools = manifest.tools.map((t) => t.name);
    const draft = tools.find((t) => /_draft_/.test(t)); const request = tools.find((t) => /_request_/.test(t));
    const rt = demoRuntime(manifest, fileURLToPath(fixturesUrl), { mode: 'auto', autoActions: draft ? [draft] : [] });
    process.stdout.write(`${demo.intro} Auto mode on for drafts only.\n`);
    const check = await rt.call(tools[0], demo.args);
    printStep('Check the files', check);
    if (check.result && demo.top) for (const l of demo.top(check.result)) process.stdout.write(`    ${l}\n`);
    if (demo.explain) printStep(`Explain ${Object.values(demo.explain)[0]}`, await rt.call(tools[1], { ...demo.args, ...demo.explain }));
    printStep('Write the report', await rt.call(tools[2], demo.args));
    if (draft && demo.draft) {
      const d = await rt.call(draft, { ...demo.args, ...demo.draft });
      printStep('Write the draft', d);
      if (d.result && request) printStep('Auto: approving it still waits for one named click', await rt.call(request, { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
    }
    const refused = manifest.tools.find((t) => (manifest.policy.rules.find((r) => r.tool === t.name) || {}).decision === 'block');
    if (refused) printStep(`The agent tries ${refused.name}`, await rt.call(refused.name, {}));
  };
}
