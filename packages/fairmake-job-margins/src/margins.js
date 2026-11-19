// Quoted against actual job margin: losses, cost overruns, under-billing and margins under target.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, pct, str, itemKey, partyKey, groupBy } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const JOB_FIELDS = Object.freeze({
  job: t(['Job', 'Job Number', 'Job No.', 'Work Order', 'Project'], { required: true }),
  customer: t(['Customer', 'Customer Name', 'Client']),
  estimator: t(['Estimator', 'Quoted By', 'Salesperson', 'Sales Rep'], { personal: true }),
  quoted_price: t(['Quoted Price', 'Quote Price', 'Sell Price', 'Quote Amount', 'Contract Value'], { type: 'money' }),
  quoted_cost: t(['Quoted Cost', 'Est Total Cost', 'Estimated Cost', 'Quote Cost'], { type: 'money' }),
  actual_cost: t(['Actual Cost', 'Act Total Cost', 'Total Actual Cost', 'Job Cost'], { type: 'money' }),
  invoiced: t(['Invoiced', 'Invoiced Amount', 'Billed', 'Revenue', 'Amount Invoiced'], { type: 'money' }),
  job_status: t(['Status', 'Job Status']),
  closed_date: t(['Closed Date', 'Close Date', 'Completed Date'], { type: 'date' }),
});
/** JobBOSS job cost summary. Written from knowledge of the export; not checked against a live system. */
export const JOB_PROFILES = Object.freeze([
  exportProfile('jobboss_job_summary', { job: 'Job', customer: 'Customer', estimator: 'Estimator', quoted_price: 'Quoted Price', quoted_cost: 'Est Total Cost', actual_cost: 'Act Total Cost', invoiced: 'Invoiced Amount', job_status: 'Status' }, { note: 'JobBOSS job cost summary: quoted and estimated against actual cost per job.' }),
]);

export const DEFAULTS = Object.freeze({ target_margin_pct: 20, overrun_pct: 10, min_amount: 100 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    target_margin_pct: { type: 'number', minimum: -100, maximum: 100, description: 'A job below this gross margin percentage is listed for review' },
    overrun_pct: { type: 'number', minimum: 0, maximum: 1000, description: 'Actual cost this far above the quoted cost is a cost overrun' },
    min_amount: { type: 'number', minimum: 0, description: 'Overruns and under-billing below this amount are ignored' },
  },
});
const CLOSED = /clos|complet|shipped|invoiced|done/i;

/** Every job's margin. Finding codes: loss, cost_overrun, under_billed, below_target, no_quote. */
export function jobMargins(rows, s = DEFAULTS) {
  const by = groupBy(rows.filter((r) => str(r.job)), (r) => itemKey(r.job));
  const items = [...by.values()].map((ls) => {
    const r = ls[0]; const job = str(r.job); const add = (k) => (ls.some((l) => l[k] !== null && l[k] !== undefined) ? round2(ls.reduce((x, l) => x + (Number(l[k]) || 0), 0)) : null);
    const qp = add('quoted_price'), qc = add('quoted_cost'), ac = add('actual_cost'), inv = add('invoiced');
    const st = ls.map((l) => str(l.job_status)).find(Boolean) || ''; const closed = CLOSED.test(st);
    const revenue = inv !== null && inv > 0 ? inv : qp; const margin = revenue !== null && ac !== null ? round2(revenue - ac) : null; const mp = margin === null ? null : pct(margin, revenue);
    const f = [];
    if (qp === null || qc === null) f.push(finding('no_quote', null, `${job} has no quoted ${qp === null ? 'price' : 'cost'}, so it cannot be compared with its quote.`, 'review'));
    if (margin !== null && margin < 0) f.push(finding('loss', -margin, `${job} lost ${round2(-margin)}: ${revenue} ${inv ? 'invoiced' : 'quoted'} against ${ac} actual cost.`));
    if (qc && ac !== null && ac - qc > s.min_amount && pct(ac - qc, qc) > s.overrun_pct) f.push(finding('cost_overrun', round2(ac - qc), `${job} cost ${ac} against ${qc} quoted (${pct(ac - qc, qc)}% over).`));
    if (closed && qp && inv !== null && qp - inv > s.min_amount) f.push(finding('under_billed', round2(qp - inv), `${job} is ${st.toLowerCase()} with ${inv} invoiced against ${qp} quoted: ${round2(qp - inv)} not billed.`));
    if (margin !== null && margin >= 0 && mp < s.target_margin_pct) f.push(finding('below_target', null, `${job} made ${mp}% against a ${s.target_margin_pct}% target.`, 'watch'));
    return { job, customer: r.customer || '', estimator: r.estimator || '', job_status: st, quoted_price: qp, quoted_cost: qc, actual_cost: ac, invoiced: inv, quoted_margin_pct: qp && qc !== null ? pct(qp - qc, qp) : null, margin, margin_pct: mp, status: statusOf(f), findings: f };
  }).sort((a, b) => (itemKey(a.job) < itemKey(b.job) ? -1 : 1));
  const roll = (key, label) => [...groupBy(items, (i) => partyKey(i[key]) || '(none)').values()].map((xs) => { const rev = round2(xs.reduce((x, i) => x + ((i.invoiced || i.quoted_price) || 0), 0)); const cost = round2(xs.reduce((x, i) => x + (i.actual_cost || 0), 0)); return { [label]: xs[0][key] || '(none)', jobs: xs.length, revenue: rev, cost, margin: round2(rev - cost), margin_pct: pct(rev - cost, rev), overruns: xs.filter((i) => i.findings.some((f) => f.code === 'cost_overrun')).length }; }).sort((a, b) => a.margin - b.margin || (a[label] < b[label] ? -1 : 1));
  return {
    jobs: items.length, revenue: round2(items.reduce((x, i) => x + ((i.invoiced || i.quoted_price) || 0), 0)), actual_cost: round2(items.reduce((x, i) => x + (i.actual_cost || 0), 0)),
    losses: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'loss').reduce((y, f) => y + f.amount, 0), 0)),
    overruns: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'cost_overrun').reduce((y, f) => y + f.amount, 0), 0)),
    under_billed: round2(items.reduce((x, i) => x + i.findings.filter((f) => f.code === 'under_billed').reduce((y, f) => y + f.amount, 0), 0)),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_customer: roll('customer', 'customer'), by_estimator: roll('estimator', 'estimator'), by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function requoteText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status === 'flag');
  return ['# Jobs that missed their quote', '', '**To:** [TO CONFIRM estimating and sales lead]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `${rows.length} job(s) lost money, overran their quoted cost or were not billed in full (losses ${r.losses}, overruns ${r.overruns}, not billed ${r.under_billed}). Before the next quote for the same parts or customers, please check the quoted hours, material and price.`, '',
    '| Job | Customer | Quoted price | Quoted cost | Actual cost | Invoiced | Detail |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.job} | ${i.customer} | ${i.quoted_price ?? ''} | ${i.quoted_cost ?? ''} | ${i.actual_cost ?? ''} | ${i.invoiced ?? ''} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
