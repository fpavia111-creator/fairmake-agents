#!/usr/bin/env node
// Writes the top of every agent README from the agent itself: what it does, what it
// checks (each finding code with a real sentence from the fictional demo data), the
// settings with their defaults, and the limits. scripts/readme-sections.mjs then adds the
// generated block (demo run, tools, columns, install, modes, CLI) before "## Limits".
//
//   node scripts/readme-head.mjs [agent ...]
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AgentRuntime, FAIRMAKE_LIMITS } from '../packages/fairmake-core/src/index.js';

const ACR = { wip: 'WIP', bom: 'BOM', ncr: 'NCR', capa: 'CAPA', osha: 'OSHA', hts: 'HTS', edi: 'EDI', asn: 'ASN' };
export const titleOf = (n) => n.split('-').map((w) => ACR[w] || w[0].toUpperCase() + w.slice(1)).join(' ');
const PK = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const esc = (s) => String(s ?? '').replace(/\|/g, '\|').replace(/\n/g, ' ');
for (const n of readdirSync(PK).filter((x) => /^fairmake-(?!core$)/.test(x) && (!only.length || only.includes(x))).sort()) {
  const mod = await import(pathToFileURL(join(PK, n, 'src', 'index.js')).href);
  const { manifest, DEMO, DEFAULTS } = { ...mod, DEMO: (await import(pathToFileURL(join(PK, n, 'src', 'manifest.js')).href)).DEMO };
  const prefix = manifest.tools[0].name.replace(/_check$/, '');
  const root = mkdtempSync(join(tmpdir(), `${n}-head-`)); cpSync(join(PK, n, 'fixtures'), root, { recursive: true });
  const r = await new AgentRuntime(manifest, { root, audit: false, memory: false }).call(`${prefix}_check`, DEMO.files);
  rmSync(root, { recursive: true, force: true });
  const examples = new Map();
  for (const i of (r.result && r.result.items) || []) for (const f of i.findings) if (!examples.has(f.code)) examples.set(f.code, { status: i.status, detail: f.detail });
  const personal = Object.values(manifest.sources || {}).some((s) => Object.values(s.fields).some((fd) => fd && fd.personal));
  const props = manifest.configSchemas.settings ? manifest.configSchemas.settings.properties : {};
  const pkg = JSON.parse(readFileSync(join(PK, n, 'package.json'), 'utf8'));
  const desc = pkg.description.replace(/^[^:]+:\s*/, '');
  const L = [`# ${titleOf(n)}`, '', '`' + n + '` · MCP server and CLI · MIT', '', desc.charAt(0).toUpperCase() + desc.slice(1), '',
    `Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.`, '',
    '## What it checks', '', manifest.tools[0].description, '',
    '| Finding | Example from the fictional demo data |', '|---|---|',
    ...[...examples.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([code, e]) => `| \`${code}\` | ${esc(e.detail)} |`), '',
    'Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.', ''];
  // What a buyer needs to know before trying it: the files it reads, what it never does, who decides.
  const check = manifest.tools[0]; const req = new Set(check.inputSchema.required || []);
  const inputs = Object.entries(check.inputSchema.properties || {}).filter(([k]) => !['limit', 'status'].includes(k));
  const refused = manifest.tools.filter((t) => !t.handler);
  const draft = manifest.tools.find((t) => /_draft_/.test(t.name)); const request = manifest.tools.find((t) => /_request_/.test(t.name));
  L.push('## What it needs, and what stays with a person', '',
    ...inputs.map(([k, v]) => `- \`${k}\` (${req.has(k) ? 'required' : 'optional'}): ${esc(String(v.description || '').replace(/^Optional\s+/, '').trim())}`), '',
    'It never does these, and any other tool name is blocked:', '',
    ...refused.map((t) => `- ${esc(t.description.replace(/^Listed so agents can see it is refused\.\s*/i, ''))}`), '',
    ...(draft && request ? [`\`${draft.name}\` writes a draft marked DRAFT; nothing goes out from it. Approving it (\`${request.name}\`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.`, ''] : []));
  if (Object.keys(props).length) {
    L.push('## Settings', '', `Put the ones you want to change in a JSON file and pass it as \`settings\`; anything left out uses the default. The result lists the settings it used under \`settings_used\`.`, '', '| Setting | Default | Meaning |', '|---|---|---|');
    for (const [k, v] of Object.entries(props).filter(([k]) => k !== 'note')) L.push(`| \`${k}\` | \`${esc(JSON.stringify(DEFAULTS ? DEFAULTS[k] : null))}\` | ${esc(v.description)} |`);
    L.push('');
  }
  L.push('## Limits', '', `- ${FAIRMAKE_LIMITS.files}`, `- ${FAIRMAKE_LIMITS.settings}`, `- ${FAIRMAKE_LIMITS.advice}`, ...(personal ? [`- ${FAIRMAKE_LIMITS.masking}`] : []), '- Column names for the named exports were written from knowledge of those systems and not checked against a live account; `inspect` shows how a file was read and `fairmake-sources.json` names columns by hand.', '- The bundled fixtures are fictional. Version 0.1.0.', '');
  const f = join(PK, n, 'README.md');
  const old = existsSync(f) ? readFileSync(f, 'utf8') : '';
  const block = (/<!-- generated:start -->[\s\S]*?<!-- generated:end -->/.exec(old) || [])[0];
  let txt = L.join('\n');
  if (block) txt = txt.replace('\n## Limits', `\n${block}\n\n## Limits`);
  writeFileSync(f, txt);
  console.log(`${n}: README head written (${examples.size} finding codes)`);
}
