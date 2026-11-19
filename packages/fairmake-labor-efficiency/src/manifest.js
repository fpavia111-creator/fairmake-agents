import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { LABOR_FIELDS, EARNED_FIELDS, LABOR_PROFILES, DEFAULTS, SETTINGS_SCHEMA, laborEfficiency, standardsReviewText } from './labor.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  labor: { type: 'string', description: 'Labor tickets under --root: entry, employee, work center, work order, date, hours and whether the time was indirect' },
  earned: { type: 'string', description: 'Completions under --root: work order, work center, quantity completed and standard hours per unit' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'labor',
  description: 'Measures labor efficiency by work center (standard hours earned by completions against direct hours clocked): flags work centers below target, lists likely loose standards, reviews high indirect time and hours or completions with nothing on the other side, and drafts a review for the supervisor. Results are by work center; employee names are masked. Changes no payroll or time record.',
  args, required: ['labor', 'earned'],
  sources: { labor: { label: 'Labor tickets', args: ['labor'], fields: LABOR_FIELDS, profiles: LABOR_PROFILES }, earned: { label: 'Completions with standard hours', args: ['earned'], fields: EARNED_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => laborEfficiency({ labor: read('labor'), earned: read('earned') }, s),
  line: (r) => `${r.work_centers} work center(s), ${r.entries} labor ticket(s): ${r.earned_hours} standard hours earned on ${r.direct_hours} direct hours (${r.efficiency_pct}%), ${r.indirect_hours} indirect. ${r.flag} below target, ${r.review} to review, ${r.watch} to watch, ${r.ok} on target.`,
  item: { key: 'work_center', arg: 'work_center', label: 'work center' },
  check: { title: 'Check labor efficiency by work center', description: 'For each work center, compare standard hours earned (quantity completed times standard hours per unit) with direct hours clocked. Flags efficiency below the target, lists efficiency above the ceiling, reviews indirect time above the limit, hours on work orders with no completions and completions with no hours. Results are by work center, never by person.' },
  report: {
    base: 'labor-efficiency', title: 'Labor efficiency by work center',
    rows: (r) => r.items.map((i) => ({ work_center: i.work_center, direct_hours: i.direct_hours, indirect_hours: i.indirect_hours, earned_hours: i.earned_hours, efficiency_pct: i.efficiency_pct, indirect_pct: i.indirect_pct, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['work_center', 'direct_hours', 'earned_hours', 'efficiency_pct', 'indirect_pct', 'status', 'reasons'],
    sections: (r) => [{ title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['Efficiency is by work center, from the hours and standards in your files. It is not a measure of any one person and should not be used as one.'],
  },
  draft: {
    noun: 'standards_review', verb: 'send', category: 'binding_send', actor: 'the operations manager',
    description: 'Write drafts/standards_review-open.md: the work centers below target, above the ceiling or with unclear hours, for the supervisor and industrial engineer. Marked DRAFT. Sending goes through labor_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review + r.watch === 0) throw new Error('every work center is on target'); return { id: 'open', text: standardsReviewText(r, a) }; },
  },
  refused: [
    { name: 'payroll_change', category: 'move_money', description: 'Never changes pay, bonuses or payroll.' },
    { name: 'timeclock_edit', category: 'production_deploy', description: 'Never edits labor tickets or time clock records.' },
  ],
  prompt: { name: 'labor_efficiency_review', title: 'Review labor efficiency', text: 'You are helping an operations manager with fairmake-labor-efficiency. Call labor_check with labor tickets and completions. Talk about work centers, never individuals; employee names are masked. Lead with work centers below target, then loose standards and unclear hours. Offer labor_write_report and labor_draft_standards_review.' },
});

export const DEMO = {
  intro: 'Fairmake Labor Efficiency demo: fictional labor tickets and completions on five work centers.',
  files: { labor: 'labor.csv', earned: 'earned.csv', settings: 'settings.json' },
  explain: { work_center: 'WELD' },
  draft: { from: 'Morgan Ops Manager (fictional)' },
};
