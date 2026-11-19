import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { NCR_FIELDS, CAPA_FIELDS, NCR_PROFILES, DEFAULTS, SETTINGS_SCHEMA, ncrCapa, capaReminderText } from './ncr.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = {
  ncrs: { type: 'string', description: 'Nonconformance log under --root: NCR, dates opened and closed, part, supplier, defect code, disposition, CAPA, status, owner' },
  capas: { type: 'string', description: 'Corrective action log under --root: CAPA, dates opened, due and closed, root cause, effectiveness verified, status, owner' },
  as_of: { type: 'string', format: 'date', description: 'Date to age from, YYYY-MM-DD (default today)' },
};

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'ncr',
  description: 'Ages nonconformance reports and corrective actions: flags NCRs open past the limit, CAPAs past due, CAPAs closed without an effectiveness check and repeat defects with no CAPA; reviews NCRs with no disposition, CAPAs with no root cause and links to missing CAPAs; drafts a reminder for the quality team. Owner names are masked in results. Closes nothing and contacts no supplier.',
  args, required: ['ncrs'],
  sources: { ncrs: { label: 'Nonconformance log', args: ['ncrs'], fields: NCR_FIELDS, profiles: NCR_PROFILES }, capas: { label: 'Corrective action log', args: ['capas'], fields: CAPA_FIELDS } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ a, read, s }) => ncrCapa({ ncrs: read('ncrs'), capas: read('capas') }, s, a.as_of),
  line: (r) => `${r.ncrs} NCR(s) (${r.open_ncrs} open) and ${r.capas} CAPA(s) as of ${r.as_of}: ${r.flag} need action, ${r.review} to complete, ${r.ok} in order; ${r.repeat_defects.length} repeat defect(s) with no CAPA.`,
  item: { key: 'id', arg: 'id', label: 'NCR or CAPA' },
  check: { title: 'Check NCR and CAPA aging', description: 'Flags NCRs open past the limit, CAPAs past their due date, CAPAs closed with no effectiveness check, and the same part and defect seen the repeat number of times with no CAPA; reviews NCRs with no disposition, CAPAs with no root cause and NCRs pointing at CAPAs not in the log.' },
  report: {
    base: 'ncr-capa-aging', title: (r) => `Nonconformance and corrective action aging as of ${r.as_of}`,
    rows: (r) => r.items.map((i) => ({ id: i.id, kind: i.kind, part: i.part, defect: i.defect, owner: i.owner, opened: i.opened, closed: i.closed, due: i.due, days: i.age_days, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['id', 'kind', 'part', 'defect', 'owner', 'opened', 'due', 'days', 'status', 'reasons'],
    sections: (r) => [{ title: 'Repeat defects', rows: r.repeat_defects, columns: ['part', 'defect', 'ncrs'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count'] }],
    limits: ['Limits come from your settings, not from any quality standard; your quality manual decides what is overdue.'],
  },
  draft: {
    noun: 'capa_reminder', verb: 'send', category: 'binding_send', actor: 'the quality manager',
    description: 'Write drafts/capa_reminder-open.md: every NCR and CAPA that needs action, with owner and dates, for the quality team. Marked DRAFT. Sending goes through ncr_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (r.flag + r.review === 0) throw new Error('every NCR and CAPA is in order'); return { id: 'open', text: capaReminderText(r, a) }; },
  },
  refused: [
    { name: 'qms_close_capa', category: 'production_deploy', description: 'Never opens, closes or edits an NCR or CAPA in the QMS.' },
    { name: 'supplier_notice_send', category: 'binding_send', description: 'Never sends a corrective action request or notice to a supplier.' },
  ],
  prompt: { name: 'ncr_capa_review', title: 'Review NCR and CAPA aging', text: 'You are helping a quality manager with fairmake-ncr-capa-aging. Call ncr_check with the NCR and CAPA logs, as_of today. Lead with repeat defects with no CAPA, overdue CAPAs and CAPAs closed without a check that they worked, then old NCRs. Offer ncr_write_report and ncr_draft_capa_reminder. Owner names are masked in results.' },
});

export const DEMO = {
  intro: 'Fairmake NCR CAPA Aging demo: ten fictional NCRs and four CAPAs, as of 2026-11-18.',
  files: { ncrs: 'ncrs.csv', capas: 'capas.csv', settings: 'settings.json', as_of: '2026-11-18' },
  explain: { id: 'CAPA-21' },
  draft: { from: 'Quinn Quality (fictional)' },
};
