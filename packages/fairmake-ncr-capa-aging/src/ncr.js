// Nonconformance (NCR) and corrective action (CAPA) aging: open NCRs past the limit, NCRs with no disposition,
// CAPAs overdue, without a root cause or closed without a check that they worked, and repeat defects with no CAPA.
import { exportProfile, finding, statusOf, tallyFindings, countBy, str, itemKey, groupBy, daysBetween, asOfDate, yes } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const NCR_FIELDS = Object.freeze({
  ncr: t(['NCR', 'NCR Number', 'NCR No.', 'Nonconformance'], { required: true }),
  opened: t(['Opened', 'Date Opened', 'Open Date', 'Reported'], { type: 'date' }),
  closed: t(['Closed', 'Date Closed', 'Close Date'], { type: 'date' }),
  part: t(['Part', 'Part Number', 'Item', 'Product']),
  supplier: t(['Supplier', 'Vendor', 'Source']),
  defect_code: t(['Defect Code', 'Defect', 'Defect Type', 'Failure Mode']),
  disposition: t(['Disposition', 'MRB Disposition', 'Decision']),
  capa: t(['CAPA', 'CAPA Number', 'Corrective Action', 'CAR']),
  ncr_status: t(['Status', 'NCR Status', 'State']),
  owner: t(['Owner', 'Assigned To', 'Responsible'], { personal: true }),
});
export const CAPA_FIELDS = Object.freeze({
  capa: t(['CAPA', 'CAPA Number', 'CAR', 'Corrective Action'], { required: true }),
  opened: t(['Opened', 'Date Opened', 'Open Date'], { type: 'date' }),
  due: t(['Due', 'Due Date', 'Target Date'], { type: 'date' }),
  closed: t(['Closed', 'Date Closed', 'Close Date'], { type: 'date' }),
  root_cause: t(['Root Cause', 'Cause', 'Root Cause Analysis']),
  verified: t(['Verified', 'Effectiveness Verified', 'Effective', 'Verification Done']),
  capa_status: t(['Status', 'CAPA Status', 'State']),
  owner: t(['Owner', 'Assigned To', 'Responsible'], { personal: true }),
});
/** Generic QMS nonconformance log. Written from knowledge of such exports; not checked against a live system. */
export const NCR_PROFILES = Object.freeze([
  exportProfile('qms_ncr_log', { ncr: 'NCR Number', opened: 'Date Opened', closed: 'Date Closed', part: 'Part Number', supplier: 'Supplier', defect_code: 'Defect Code', disposition: 'Disposition', capa: 'CAPA Number', ncr_status: 'Status', owner: 'Owner' }, { note: 'QMS nonconformance log: one row per NCR.' }),
]);

export const DEFAULTS = Object.freeze({ ncr_days: 30, repeat_count: 3 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    ncr_days: { type: 'integer', minimum: 1, maximum: 730, description: 'An NCR open longer than this many days is overdue' },
    repeat_count: { type: 'integer', minimum: 2, maximum: 100, description: 'This many NCRs for the same part and defect with no CAPA is a repeat defect' },
  },
});
const CLOSED = /clos|complete|done|cancel/i;

/** NCRs and CAPAs. Finding codes: ncr_overdue, no_disposition, capa_not_found, capa_overdue, no_root_cause, closed_unverified, repeat_without_capa. */
export function ncrCapa({ ncrs, capas }, s = DEFAULTS, asOf) {
  const today = asOfDate(asOf);
  const C = new Map(capas.filter((c) => str(c.capa)).map((c) => [itemKey(c.capa), c]));
  const N = [...groupBy(ncrs.filter((n) => str(n.ncr)), (n) => itemKey(n.ncr)).values()].map((xs) => xs[0]);
  const isOpen = (closed, status) => !closed && !CLOSED.test(str(status));
  const out = N.map((n) => {
    const open = isOpen(n.closed, n.ncr_status); const age = n.opened ? daysBetween(n.opened, n.closed || today) : null; const f = [];
    if (open && age !== null && age > s.ncr_days) f.push(finding('ncr_overdue', null, `NCR ${n.ncr} (${n.part || '?'}, ${n.defect_code || 'no defect code'}) has been open ${age} days.`));
    if (!str(n.disposition) && (!open || (age !== null && age > 7))) f.push(finding('no_disposition', null, `NCR ${n.ncr} has no disposition (use as is, rework, scrap, return).`, 'review'));
    if (str(n.capa) && !C.has(itemKey(n.capa))) f.push(finding('capa_not_found', null, `NCR ${n.ncr} points to CAPA ${n.capa}, which is not in the CAPA log.`, 'review'));
    return { id: str(n.ncr), kind: 'ncr', part: str(n.part), defect: str(n.defect_code), opened: n.opened, closed: n.closed || null, due: null, age_days: age, owner: str(n.owner), status: statusOf(f), findings: f };
  });
  const groups = groupBy(N.filter((n) => str(n.part) && str(n.defect_code)), (n) => `${itemKey(n.part)}|${itemKey(n.defect_code)}`);
  const repeat_defects = [];
  for (const xs of groups.values()) {
    if (xs.length < s.repeat_count || xs.some((n) => str(n.capa))) continue;
    const latest = [...xs].sort((a, b) => (`${a.opened}|${itemKey(a.ncr)}` < `${b.opened}|${itemKey(b.ncr)}` ? -1 : 1)).pop();
    repeat_defects.push({ part: str(latest.part), defect: str(latest.defect_code), ncrs: xs.length });
    const o = out.find((x) => x.id === str(latest.ncr));
    o.findings.push(finding('repeat_without_capa', null, `${xs.length} NCRs for ${latest.part} with defect ${latest.defect_code} (${xs.map((n) => str(n.ncr)).sort().join(', ')}) and no corrective action.`)); o.status = statusOf(o.findings);
  }
  for (const c of C.values()) {
    const open = isOpen(c.closed, c.capa_status); const f = [];
    if (open && c.due && c.due < today) f.push(finding('capa_overdue', null, `CAPA ${c.capa} was due ${c.due} (${daysBetween(c.due, today)} days ago) and is still open.`));
    if (!str(c.root_cause) && (!open || (c.opened && daysBetween(c.opened, today) > 14))) f.push(finding('no_root_cause', null, `CAPA ${c.capa} has no root cause recorded.`, 'review'));
    if (!open && !yes(c.verified)) f.push(finding('closed_unverified', null, `CAPA ${c.capa} was closed ${c.closed || ''} without a check that the action worked.`.replace(/\s+/g, ' ')));
    out.push({ id: str(c.capa), kind: 'capa', part: '', defect: '', opened: c.opened, closed: c.closed || null, due: c.due || null, age_days: c.opened ? daysBetween(c.opened, c.closed || today) : null, owner: str(c.owner), status: statusOf(f), findings: f });
  }
  out.sort((a, b) => (`${a.kind}|${itemKey(a.id)}` < `${b.kind}|${itemKey(b.id)}` ? -1 : 1));
  repeat_defects.sort((a, b) => b.ncrs - a.ncrs || (a.part < b.part ? -1 : 1));
  return {
    as_of: today, ncrs: N.length, open_ncrs: out.filter((o) => o.kind === 'ncr' && !o.closed).length, capas: C.size,
    flag: out.filter((o) => o.status === 'flag').length, review: out.filter((o) => o.status === 'review').length, ok: out.filter((o) => o.status === 'ok').length,
    repeat_defects, by_finding: tallyFindings(out), by_status: countBy(out), items: out,
  };
}

export function capaReminderText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.status !== 'ok');
  return ['# Open quality actions', '', '**To:** [TO CONFIRM quality team]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `As of ${r.as_of}: ${r.open_ncrs} NCR(s) open, ${rows.length} NCR or CAPA record(s) need action. Please update each in the QMS; this note closes nothing.`, '',
    '| Record | Kind | Owner | Opened | Due | Detail |', '| --- | --- | --- | --- | --- | --- |', ...rows.map((i) => `| ${i.id} | ${i.kind} | ${i.owner} | ${i.opened || ''} | ${i.due || ''} | ${i.findings.map((f) => f.detail).join(' ')} |`)].join('\n');
}
