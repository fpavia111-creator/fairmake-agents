import { readFileSync } from 'node:fs';
import { defineFairmakeAgent, findingRows } from 'fairmake-core';
import { JOB_FIELDS, JOB_PROFILES, DEFAULTS, SETTINGS_SCHEMA, jobMargins, requoteText } from './margins.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const args = { jobs: { type: 'string', description: 'Job cost summary under --root: quoted price and cost, actual cost and amount invoiced per job' } };

export const manifest = defineFairmakeAgent({
  name: pkg.name, version: pkg.version, prefix: 'job_margin',
  description: 'Compares every job\'s quote with what it actually cost and what was invoiced: flags losses, cost overruns and closed jobs not billed in full, lists margins under target, rolls margins up by customer and estimator, and drafts a note to estimating. Changes no price and sends no invoice.',
  args, required: ['jobs'],
  sources: { jobs: { label: 'Job cost summary', args: ['jobs'], fields: JOB_FIELDS, profiles: JOB_PROFILES } },
  settings: { schema: SETTINGS_SCHEMA, defaults: DEFAULTS },
  run: ({ read, s }) => jobMargins(read('jobs'), s),
  line: (r) => `${r.jobs} job(s), ${r.revenue} revenue against ${r.actual_cost} cost: losses ${r.losses}, overruns ${r.overruns}, not billed ${r.under_billed}. ${r.flag} to act on, ${r.review} without a quote, ${r.watch} under target, ${r.ok} on target.`,
  item: { key: 'job', arg: 'job', label: 'job' },
  check: { title: 'Check quoted against actual job margins', description: 'For each job, compare quoted price and cost with actual cost and the amount invoiced. Flags losses, overruns past the threshold and closed jobs invoiced below the quote; lists margins under target and jobs with no quote. Rolls up by customer and estimator (estimator names are masked in results).' },
  report: {
    base: 'job-margins', title: 'Quoted against actual job margin',
    rows: (r) => r.items.map((i) => ({ job: i.job, customer: i.customer, estimator: i.estimator, quoted_price: i.quoted_price, quoted_cost: i.quoted_cost, actual_cost: i.actual_cost, invoiced: i.invoiced, margin: i.margin, margin_pct: i.margin_pct, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') })),
    htmlColumns: ['job', 'customer', 'quoted_price', 'quoted_cost', 'actual_cost', 'invoiced', 'margin_pct', 'status', 'reasons'],
    sections: (r) => [{ title: 'By customer', rows: r.by_customer, columns: ['customer', 'jobs', 'revenue', 'cost', 'margin', 'margin_pct'] }, { title: 'By estimator', rows: r.by_estimator, columns: ['estimator', 'jobs', 'overruns', 'margin_pct'] }, { title: 'By finding', rows: findingRows(r.by_finding), columns: ['code', 'count', 'amount'] }],
    limits: ['Margin is revenue (invoiced, or the quoted price until invoiced) minus actual cost as your export states them; overhead allocation follows your ERP.'],
  },
  draft: {
    noun: 'requote_note', verb: 'send', category: 'binding_send', actor: 'the operations manager',
    description: 'Write drafts/requote_note-open.md: the jobs that lost money, overran or were under-billed, for the estimating and sales lead to review before the next quote. Marked DRAFT. Sending goes through job_margin_request_send (one click).',
    args: { from: { type: 'string', description: 'Your name' } },
    build: (r, a) => { if (!r.flag) throw new Error('no job lost money, overran or was under-billed'); return { id: 'open', text: requoteText(r, a), amount: Math.round((r.losses + r.under_billed) * 100) / 100 }; },
  },
  refused: [
    { name: 'erp_update_price_list', category: 'production_deploy', description: 'Never changes quotes, price lists or estimates in the ERP.' },
    { name: 'customer_invoice_send', category: 'binding_send', description: 'Never invoices a customer or sends anything to one.' },
  ],
  prompt: { name: 'job_margin_review', title: 'Review job margins', text: 'You are helping an owner or controller of a job shop with fairmake-job-margins. Call job_margin_check on the job cost summary. Lead with losses and under-billed closed jobs, then overruns by estimator and customer. Offer job_margin_write_report and job_margin_draft_requote_note. Estimator names are masked in results; the report file keeps them.' },
});

export const DEMO = {
  intro: 'Fairmake Job Margins demo: ten fictional jobs at a fictional job shop.',
  files: { jobs: 'jobs.csv', settings: 'settings.json' },
  explain: { job: 'J-5003' },
  draft: { from: 'Morgan Owner (fictional)' },
};
