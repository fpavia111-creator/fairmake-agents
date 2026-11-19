// Machine downtime from MES exports: availability, MTBF and MTTR by machine, chronic reasons, events with no reason or no end.
import { exportProfile, finding, statusOf, tallyFindings, countBy, round2, pct, str, itemKey, groupBy, hoursBetween, yes } from 'fairmake-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const EVENT_FIELDS = Object.freeze({
  event: t(['Event', 'Event ID', 'Downtime ID', 'Stop ID', 'ID'], { required: true }),
  machine: t(['Machine', 'Asset', 'Equipment', 'Line', 'Work Center'], { required: true }),
  start: t(['Start', 'Start Time', 'Down Start', 'Stopped At', 'From'], { type: 'datetime' }),
  end: t(['End', 'End Time', 'Down End', 'Restarted At', 'To'], { type: 'datetime' }),
  reason: t(['Reason', 'Downtime Reason', 'Stop Reason', 'Reason Code', 'Cause']),
  planned: t(['Planned', 'Planned Stop', 'Scheduled', 'Is Planned']),
});
export const SCHEDULE_FIELDS = Object.freeze({
  machine: t(['Machine', 'Asset', 'Equipment', 'Line', 'Work Center'], { required: true }),
  scheduled_hours: t(['Scheduled Hours', 'Planned Production Time', 'Available Hours', 'Shift Hours'], { type: 'number' }),
});
/** Generic MES downtime export. Written from knowledge of such exports; not checked against a live system. */
export const EVENT_PROFILES = Object.freeze([
  exportProfile('mes_downtime_events', { event: { from: ['Machine', 'Start Time'], compute: (_r, get) => `${String(get('Machine') ?? '').trim()}@${String(get('Start Time') ?? '').trim()}` }, machine: 'Machine', start: 'Start Time', end: 'End Time', reason: 'Downtime Reason', planned: 'Planned' }, { note: 'MES downtime events: the event id is the machine and start time.' }),
]);

export const DEFAULTS = Object.freeze({ min_availability_pct: 85, chronic_count: 3 });
export const SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string', description: 'Free text for your own records' },
    min_availability_pct: { type: 'number', minimum: 0, maximum: 100, description: 'A machine available less than this share of its scheduled hours (unplanned stops only) is flagged' },
    chronic_count: { type: 'integer', minimum: 2, maximum: 1000, description: 'An unplanned reason seen this many times on one machine is chronic' },
  },
});

/** Downtime by machine. Finding codes: low_availability, chronic_reason, no_reason, open_event, overlapping_events, no_schedule. */
export function machineDowntime({ events, schedule }, s = DEFAULTS) {
  const SCH = new Map(schedule.filter((x) => str(x.machine)).map((x) => [itemKey(x.machine), x.scheduled_hours]));
  const E = groupBy(events.filter((e) => str(e.machine) && str(e.event)), (e) => itemKey(e.machine));
  const allReasons = [];
  const items = [...new Set([...E.keys(), ...SCH.keys()])].sort().map((k) => {
    const evs = (E.get(k) || []).map((e) => ({ ...e, hours: e.start && e.end ? hoursBetween(e.start, e.end) : null, isPlanned: yes(e.planned) })).sort((a, b) => (String(a.start) < String(b.start) ? -1 : String(a.start) > String(b.start) ? 1 : (itemKey(a.event) < itemKey(b.event) ? -1 : 1)));
    const name = evs.length ? str(evs[0].machine) : str((schedule.find((x) => itemKey(x.machine) === k) || {}).machine);
    const sched = SCH.has(k) ? SCH.get(k) : null; const unplanned = evs.filter((e) => !e.isPlanned && e.hours > 0);
    const down = round2(evs.filter((e) => e.hours > 0).reduce((x, e) => x + e.hours, 0)); const udown = round2(unplanned.reduce((x, e) => x + e.hours, 0));
    const avail = sched ? pct(sched - udown, sched) : null; const f = [];
    if (avail !== null && avail < s.min_availability_pct) f.push(finding('low_availability', null, `${name} lost ${udown} of ${sched} scheduled hours to unplanned stops: ${avail}% available (target ${s.min_availability_pct}%).`));
    const byReason = groupBy(unplanned.filter((e) => str(e.reason)), (e) => str(e.reason).toLowerCase());
    for (const xs of [...byReason.values()].filter((xs) => xs.length >= s.chronic_count).sort((a, b) => b.length - a.length)) f.push(finding('chronic_reason', null, `${name} stopped ${xs.length} times for "${str(xs[0].reason)}" (${round2(xs.reduce((x, e) => x + e.hours, 0))} hours).`, 'watch'));
    const noReason = evs.filter((e) => !str(e.reason)); if (noReason.length) f.push(finding('no_reason', null, `${noReason.length} stop(s) on ${name} have no reason code (${noReason.map((e) => str(e.event)).join(', ')}).`, 'review'));
    const open = evs.filter((e) => e.start && !e.end); if (open.length) f.push(finding('open_event', null, `${open.length} stop(s) on ${name} have no end time (${open.map((e) => str(e.event)).join(', ')}): still down, or the restart was not recorded.`, 'review'));
    const timed = evs.filter((e) => e.hours !== null); const over = [];
    for (let i = 1; i < timed.length; i++) if (String(timed[i].start) < String(timed[i - 1].end)) over.push(`${str(timed[i - 1].event)}/${str(timed[i].event)}`);
    if (over.length) f.push(finding('overlapping_events', null, `Stops overlap on ${name} (${over.join(', ')}): the same downtime may be counted twice.`, 'review'));
    if (evs.length && sched === null) f.push(finding('no_schedule', null, `${name} has stops but no scheduled hours, so availability cannot be measured.`, 'review'));
    for (const e of evs.filter((x) => x.hours > 0)) allReasons.push({ reason: str(e.reason) || '(none)', planned: e.isPlanned, hours: e.hours });
    return { machine: name, scheduled_hours: sched, stops: evs.length, unplanned_stops: unplanned.length, downtime_hours: down, unplanned_hours: udown, availability_pct: avail, mttr_hours: unplanned.length ? round2(udown / unplanned.length) : null, mtbf_hours: unplanned.length && sched ? round2((sched - udown) / unplanned.length) : null, status: statusOf(f), findings: f };
  });
  const by_reason = [...groupBy(allReasons, (x) => `${x.reason.toLowerCase()}|${x.planned}`).values()].map((xs) => ({ reason: xs[0].reason, planned: xs[0].planned ? 'yes' : 'no', stops: xs.length, hours: round2(xs.reduce((x, e) => x + e.hours, 0)) })).sort((a, b) => b.hours - a.hours || (a.reason < b.reason ? -1 : 1));
  const S = round2(items.reduce((x, i) => x + (i.scheduled_hours || 0), 0)), U = round2(items.reduce((x, i) => x + i.unplanned_hours, 0)), US = round2(items.filter((i) => i.scheduled_hours).reduce((x, i) => x + i.unplanned_hours, 0));
  return {
    machines: items.length, stops: events.length, scheduled_hours: S, downtime_hours: round2(items.reduce((x, i) => x + i.downtime_hours, 0)), unplanned_hours: U, availability_pct: pct(S - US, S),
    flag: items.filter((i) => i.status === 'flag').length, review: items.filter((i) => i.status === 'review').length, watch: items.filter((i) => i.status === 'watch').length, ok: items.filter((i) => i.status === 'ok').length,
    by_reason, by_finding: tallyFindings(items), by_status: countBy(items), items,
  };
}

export function maintenanceRequestText(r, { from } = {}) {
  const rows = r.items.filter((i) => i.findings.some((f) => ['low_availability', 'chronic_reason'].includes(f.code)));
  return ['# Machines to look at', '', '**To:** [TO CONFIRM maintenance lead]', `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `Unplanned stops took ${r.unplanned_hours} of ${r.scheduled_hours} scheduled hours. Please plan a root-cause look at the machines below.`, '',
    '| Machine | Availability % | Unplanned hours | MTTR (h) | MTBF (h) | Detail |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.machine} | ${i.availability_pct ?? ''} | ${i.unplanned_hours} | ${i.mttr_hours ?? ''} | ${i.mtbf_hours ?? ''} | ${i.findings.filter((f) => ['low_availability', 'chronic_reason'].includes(f.code)).map((f) => f.detail).join(' ')} |`)].join('\n');
}
