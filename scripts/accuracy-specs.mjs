// What each agent's fictional fixtures plant on purpose, how the clean set is made from them,
// and the one-field mutation cases. Used by scripts/accuracy.mjs.
//
// planted:   { 'item key': [finding codes] }: everything the fixture notes (fixtures/README.md)
//            say the demo data contains. Any other finding on the demo data counts as unplanned.
// clean:     edits that remove each planted problem and nothing else, applied to the fixture CSVs
//            and written to fixtures/clean/. The clean set must give zero findings.
//              ['set', file, where, values]   change matching rows
//              ['drop', file, where]          remove matching rows
//              ['dropLast', file, where]      remove the last matching row (a duplicate)
//              ['add', file, row]             add a row
// clean_json: whole JSON inputs (settings, specs) for the clean set, where a planted problem lives
//            in a JSON file rather than a CSV (written to fixtures/clean/ too).
// planted_summary: { field: [values] } for problems the result lists in a summary field rather
//            than as an item (counted with the planted problems; a value there on the clean set is
//            a false positive).
// mutations: one edit (normally one field in one row) on the clean set, and the finding it must
//            raise: { id, op, expect: ['item key', 'code'] }.
// Item keys are the first field of each result item.

export const SPECS = {
  'fairmake-cost-variance': {
    planted: { 'WO-1002': ['material_over'], 'WO-1003': ['labor_over', 'overhead_over'], 'WO-1004': ['large_favorable'], 'WO-1005': ['no_standard'], 'WO-1006': ['cost_no_output'], 'WO-1010': ['labor_over'] },
    clean: [
      ['set', 'work-orders.csv', { work_order: 'WO-1002' }, { act_material: '2020' }],
      ['set', 'work-orders.csv', { work_order: 'WO-1003' }, { act_labor: '820', act_overhead: '400' }],
      ['set', 'work-orders.csv', { work_order: 'WO-1004' }, { act_material: '3000', act_labor: '600', act_overhead: '400' }],
      ['drop', 'work-orders.csv', { work_order: 'WO-1005' }],
      ['set', 'work-orders.csv', { work_order: 'WO-1006' }, { qty_completed: '100' }],
      ['set', 'work-orders.csv', { work_order: 'WO-1010' }, { act_labor: '300' }],
    ],
    mutations: [
      { id: 'material-overrun', op: ['set', 'work-orders.csv', { work_order: 'WO-1001' }, { act_material: '1400' }], expect: ['WO-1001', 'material_over'] },
      { id: 'overhead-overrun', op: ['set', 'work-orders.csv', { work_order: 'WO-1008' }, { act_overhead: '400' }], expect: ['WO-1008', 'overhead_over'] },
      { id: 'closed-no-output', op: ['set', 'work-orders.csv', { work_order: 'WO-1001' }, { qty_completed: '0' }], expect: ['WO-1001', 'cost_no_output'] },
    ],
  },

  'fairmake-purchase-price-variance': {
    planted: { 'RC-1002-1': ['ppv_unfavorable', 'price_jump'], 'RC-1003-1': ['ppv_unfavorable'], 'RC-1005-1': ['uom_suspect'], 'RC-1006-1': ['ppv_favorable'], 'RC-1007-1': ['ppv_favorable'], 'RC-1008-1': ['no_standard'], 'RC-1010-1': ['ppv_unfavorable', 'price_jump'] },
    clean: [
      ['set', 'receipts.csv', { receipt: 'RC-1002-1' }, { unit_price: '4.10' }],
      ['set', 'receipts.csv', { receipt: 'RC-1003-1' }, { unit_price: '4.10' }],
      ['set', 'receipts.csv', { receipt: 'RC-1005-1' }, { unit_price: '0.05' }],
      ['set', 'receipts.csv', { receipt: 'RC-1006-1' }, { std_cost: '52.00' }],
      ['set', 'receipts.csv', { receipt: 'RC-1007-1' }, { std_cost: '52.00' }],
      ['set', 'receipts.csv', { receipt: 'RC-1008-1' }, { std_cost: '1.25' }],
      ['set', 'receipts.csv', { receipt: 'RC-1010-1' }, { unit_price: '88.00' }],
    ],
    mutations: [
      { id: 'price-over-standard', op: ['set', 'receipts.csv', { receipt: 'RC-1012-1' }, { unit_price: '2.40' }], expect: ['RC-1012-1', 'ppv_unfavorable'] },
      { id: 'unit-slip', op: ['set', 'receipts.csv', { receipt: 'RC-1004-1' }, { unit_price: '0.50' }], expect: ['RC-1004-1', 'uom_suspect'] },
      { id: 'missing-standard', op: ['set', 'receipts.csv', { receipt: 'RC-1011-1' }, { std_cost: '' }], expect: ['RC-1011-1', 'no_standard'] },
    ],
  },

  'fairmake-bom-cost-rollup': {
    planted: { 'BRKT-7': ['stale_price'], 'HSG-300': ['cost_up'], 'IMP-200': ['cost_up'], 'KIT-9': ['no_standard'], 'LOOP-A': ['circular_bom'], 'LOOP-B': ['circular_bom'], 'VALVE-50': ['missing_price'] },
    clean: [
      ['set', 'prices.csv', { item: 'CAS-310', price_date: '2026-11-08' }, { price: '83.00' }],
      ['set', 'items.csv', { item: 'IMP-200' }, { std_cost: '9.06' }],
      ['set', 'items.csv', { item: 'PUMP-100' }, { std_cost: '132.44' }],
      ['add', 'prices.csv', { item: 'STEM-5', price: '4.80', price_date: '2026-10-10' }],
      ['drop', 'bom.csv', { parent: 'LOOP-A' }],
      ['drop', 'bom.csv', { parent: 'LOOP-B' }],
      ['drop', 'items.csv', { item: 'LOOP-A' }],
      ['drop', 'items.csv', { item: 'LOOP-B' }],
      ['set', 'items.csv', { item: 'KIT-9' }, { std_cost: '6.00' }],
      ['set', 'prices.csv', { item: 'PLT-A36' }, { price_date: '2026-06-01' }],
    ],
    mutations: [
      { id: 'casting-price-up', op: ['set', 'prices.csv', { item: 'CAS-310', price_date: '2026-11-08' }, { price: '95.00' }], expect: ['HSG-300', 'cost_up'] },
      { id: 'old-seal-price', op: ['set', 'prices.csv', { item: 'SEAL-10' }, { price_date: '2025-01-01' }], expect: ['VALVE-50', 'stale_price'] },
      { id: 'body-price-missing', op: ['drop', 'prices.csv', { item: 'BODY-55' }], expect: ['VALVE-50', 'missing_price'] },
    ],
  },

  'fairmake-overhead-absorption': {
    planted: { ASSY: ['no_rate'], CNC: ['under_absorbed', 'low_volume'], PAINT: ['over_absorbed'], SAW: ['no_actual'] },
    clean: [
      ['set', 'hours.csv', { work_center: 'CNC' }, { hours: '400' }],
      ['set', 'actuals.csv', { work_center: 'PAINT' }, { actual_overhead: '4000' }],
      ['add', 'rates.csv', { work_center: 'ASSY', rate: '18.00', budget_hours: '500' }],
      ['add', 'actuals.csv', { work_center: 'SAW', period: '2026-10', actual_overhead: '2000' }],
      ['add', 'actuals.csv', { work_center: 'SAW', period: '2026-11', actual_overhead: '2000' }],
    ],
    mutations: [
      { id: 'weld-spend-up', op: ['set', 'actuals.csv', { work_center: 'WELD', period: '2026-11' }, { actual_overhead: '9000' }], expect: ['WELD', 'under_absorbed'] },
      { id: 'paint-spend-down', op: ['set', 'actuals.csv', { work_center: 'PAINT', period: '2026-11' }, { actual_overhead: '2000' }], expect: ['PAINT', 'over_absorbed'] },
    ],
  },

  'fairmake-wip-aging': {
    planted: { 'WO-2002': ['past_due'], 'WO-2003': ['stale', 'past_due'], 'WO-2004': ['closed_with_wip'], 'WO-2006': ['negative_wip'], 'WO-2007': ['over_completed'], 'WO-2008': ['past_due'], 'WO-2010': ['stale'] },
    clean: [
      ['set', 'work-orders.csv', { work_order: 'WO-2002' }, { due_date: '2026-12-10' }],
      ['set', 'work-orders.csv', { work_order: 'WO-2003' }, { due_date: '2026-12-30', last_activity: '2026-11-25' }],
      ['set', 'work-orders.csv', { work_order: 'WO-2004' }, { wip_value: '0' }],
      ['set', 'work-orders.csv', { work_order: 'WO-2006' }, { wip_value: '150' }],
      ['set', 'work-orders.csv', { work_order: 'WO-2007' }, { qty_completed: '45' }],
      ['set', 'work-orders.csv', { work_order: 'WO-2008' }, { due_date: '2026-12-31' }],
      ['set', 'work-orders.csv', { work_order: 'WO-2010' }, { last_activity: '2026-11-20' }],
    ],
    mutations: [
      { id: 'due-date-passed', op: ['set', 'work-orders.csv', { work_order: 'WO-2001' }, { due_date: '2026-11-25' }], expect: ['WO-2001', 'past_due'] },
      { id: 'no-recent-activity', op: ['set', 'work-orders.csv', { work_order: 'WO-2002' }, { last_activity: '2026-10-20' }], expect: ['WO-2002', 'stale'] },
      { id: 'negative-balance', op: ['set', 'work-orders.csv', { work_order: 'WO-2001' }, { wip_value: '-40' }], expect: ['WO-2001', 'negative_wip'] },
    ],
  },

  'fairmake-job-margins': {
    planted: { 'J-5002': ['loss', 'cost_overrun'], 'J-5003': ['cost_overrun', 'below_target'], 'J-5004': ['under_billed', 'below_target'], 'J-5006': ['no_quote'], 'J-5007': ['below_target'], 'J-5009': ['loss', 'cost_overrun'] },
    clean: [
      ['set', 'jobs.csv', { job: 'J-5002' }, { actual_cost: '6100' }],
      ['set', 'jobs.csv', { job: 'J-5003' }, { actual_cost: '11200' }],
      ['set', 'jobs.csv', { job: 'J-5004' }, { invoiced: '6000' }],
      ['set', 'jobs.csv', { job: 'J-5006' }, { quoted_price: '2500', quoted_cost: '1800' }],
      ['set', 'jobs.csv', { job: 'J-5007' }, { actual_cost: '9200' }],
      ['set', 'jobs.csv', { job: 'J-5009' }, { actual_cost: '2050' }],
    ],
    mutations: [
      { id: 'cost-overrun', op: ['set', 'jobs.csv', { job: 'J-5008' }, { actual_cost: '17000' }], expect: ['J-5008', 'cost_overrun'] },
      { id: 'invoiced-below-quote', op: ['set', 'jobs.csv', { job: 'J-5001' }, { invoiced: '9000' }], expect: ['J-5001', 'under_billed'] },
      { id: 'loss', op: ['set', 'jobs.csv', { job: 'J-5010' }, { actual_cost: '5400' }], expect: ['J-5010', 'loss'] },
    ],
  },

  'fairmake-landed-cost': {
    planted: { 'FB-7': ['unmatched_charge'], 'FB-8': ['unmatched_charge'], 'RCV-701': ['not_allocated'], 'RCV-703': ['not_allocated', 'landed_pct_outlier'], 'RCV-704': ['no_freight_bill'], 'RCV-705': ['over_allocated'], 'RCV-707': ['not_allocated', 'landed_pct_outlier'] },
    clean: [
      ['set', 'receipts.csv', { receipt: 'RCV-701' }, { landed_allocated: '400' }],
      ['set', 'receipts.csv', { receipt: 'RCV-703' }, { goods_value: '60000', landed_allocated: '2250' }],
      ['add', 'charges.csv', { charge_id: 'FB-9', receipt: 'RCV-704', vendor: 'Ridgeline Freight Example', charge_type: 'Freight', amount: '200', invoice_date: '2026-11-07' }],
      ['set', 'receipts.csv', { receipt: 'RCV-704' }, { landed_allocated: '200' }],
      ['set', 'receipts.csv', { receipt: 'RCV-705' }, { landed_allocated: '0' }],
      ['set', 'charges.csv', { charge_id: 'FB-5' }, { amount: '40' }],
      ['set', 'receipts.csv', { receipt: 'RCV-707' }, { landed_allocated: '40' }],
      ['drop', 'charges.csv', { charge_id: 'FB-7' }],
      ['drop', 'charges.csv', { charge_id: 'FB-8' }],
    ],
    mutations: [
      { id: 'freight-not-allocated', op: ['set', 'receipts.csv', { receipt: 'RCV-702' }, { landed_allocated: '0' }], expect: ['RCV-702', 'not_allocated'] },
      { id: 'bill-names-unknown-receipt', op: ['set', 'charges.csv', { charge_id: 'FB-6' }, { receipt: 'RCV-798' }], expect: ['FB-6', 'unmatched_charge'] },
    ],
  },

  'fairmake-bom-routing-gaps': {
    planted: { 'CART-50': ['component_unknown', 'routing_no_time'], 'FRAME-20': ['zero_qty', 'component_inactive', 'routing_no_work_center'], 'GUARD-30': ['no_bom'], 'KIT-60': ['parent_unknown'], 'LOOP-A': ['circular_bom'], 'LOOP-B': ['circular_bom'], 'PANEL-40': ['no_routing'], 'SEAL-10': ['buy_with_bom'] },
    clean: [
      ['add', 'items.csv', { item: 'WHEEL-X', item_type: 'Buy', item_status: 'Active' }],
      ['set', 'routings.csv', { item: 'CART-50' }, { run_hours: '0.2' }],
      ['set', 'items.csv', { item: 'OLD-BRKT' }, { item_status: 'Active' }],
      ['set', 'bom.csv', { parent: 'FRAME-20', component: 'BOLT-M8' }, { qty_per: '4' }],
      ['set', 'routings.csv', { item: 'FRAME-20', operation: '20' }, { work_center: 'PAINT' }],
      ['add', 'bom.csv', { parent: 'GUARD-30', component: 'PLATE-5', qty_per: '1' }],
      ['add', 'items.csv', { item: 'KIT-60', item_type: 'Make', item_status: 'Active' }],
      ['add', 'routings.csv', { item: 'KIT-60', operation: '10', work_center: 'ASSY', setup_hours: '0.1', run_hours: '0.1' }],
      ['drop', 'bom.csv', { parent: 'LOOP-A' }],
      ['drop', 'bom.csv', { parent: 'LOOP-B' }],
      ['drop', 'items.csv', { item: 'LOOP-A' }],
      ['drop', 'items.csv', { item: 'LOOP-B' }],
      ['drop', 'routings.csv', { item: 'LOOP-A' }],
      ['drop', 'routings.csv', { item: 'LOOP-B' }],
      ['add', 'routings.csv', { item: 'PANEL-40', operation: '10', work_center: 'BRAKE', setup_hours: '0.2', run_hours: '0.1' }],
      ['drop', 'bom.csv', { parent: 'SEAL-10' }],
    ],
    mutations: [
      { id: 'zero-quantity', op: ['set', 'bom.csv', { parent: 'PUMP-100', component: 'PLATE-5' }, { qty_per: '0' }], expect: ['PUMP-100', 'zero_qty'] },
      { id: 'component-made-obsolete', op: ['set', 'items.csv', { item: 'BOLT-M8' }, { item_status: 'Obsolete' }], expect: ['PUMP-100', 'component_inactive'] },
      { id: 'step-without-work-center', op: ['set', 'routings.csv', { item: 'PUMP-100' }, { work_center: '' }], expect: ['PUMP-100', 'routing_no_work_center'] },
    ],
  },

  'fairmake-scrap-yield': {
    planted: { 'WO-4002': ['scrap_over_standard'], 'WO-4003': ['scrap_over_standard', 'no_reason'], 'WO-4004': ['qty_mismatch'], 'WO-4006': ['yield_over_100'], 'WO-4008': ['scrap_over_standard'] },
    clean: [
      ['set', 'production.csv', { work_order: 'WO-4002' }, { qty_good: '95', qty_scrap: '5' }],
      ['set', 'production.csv', { work_order: 'WO-4003' }, { qty_good: '196', qty_scrap: '4', scrap_reason: 'Burn' }],
      ['set', 'production.csv', { work_order: 'WO-4004' }, { qty_good: '294' }],
      ['set', 'production.csv', { work_order: 'WO-4006' }, { qty_good: '80' }],
      ['set', 'production.csv', { work_order: 'WO-4008', prod_date: '2026-11-12' }, { qty_good: '245', qty_scrap: '5' }],
    ],
    mutations: [
      { id: 'standard-lowered', op: ['set', 'standards.csv', { item: 'HSG-300' }, { std_scrap_pct: '1' }], expect: ['WO-4007', 'scrap_over_standard'] },
      { id: 'counts-do-not-add-up', op: ['set', 'production.csv', { work_order: 'WO-4009' }, { qty_good: '140' }], expect: ['WO-4009', 'qty_mismatch'] },
      { id: 'more-good-than-started', op: ['set', 'production.csv', { work_order: 'WO-4001' }, { qty_started: '480' }], expect: ['WO-4001', 'yield_over_100'] },
    ],
  },

  'fairmake-labor-efficiency': {
    planted: { ASSY: ['high_efficiency', 'hours_no_output'], SAW: ['output_no_hours'], WELD: ['low_efficiency', 'high_indirect'] },
    clean: [
      ['drop', 'labor.csv', { entry: 'L9' }],
      ['set', 'labor.csv', { entry: 'L8' }, { hours: '15' }],
      ['add', 'labor.csv', { entry: 'L11', employee: 'Gus Example', work_center: 'SAW', work_order: 'WO-7', labor_date: '2026-11-04', hours: '2', indirect: 'N' }],
      ['set', 'earned.csv', { work_order: 'WO-3' }, { qty_completed: '65' }],
      ['set', 'labor.csv', { entry: 'L7' }, { hours: '2' }],
    ],
    mutations: [
      { id: 'paint-output-halved', op: ['set', 'earned.csv', { work_order: 'WO-6' }, { qty_completed: '5' }], expect: ['PAINT', 'low_efficiency'] },
      { id: 'cnc-indirect-up', op: ['set', 'labor.csv', { entry: 'L4' }, { hours: '8' }], expect: ['CNC', 'high_indirect'] },
    ],
  },

  'fairmake-machine-downtime': {
    planted: { 'CNC-2': ['low_availability', 'chronic_reason', 'no_reason'], 'LASER-1': ['no_schedule'], 'PRESS-1': ['overlapping_events'], 'WELD-1': ['open_event'] },
    clean: [
      ['set', 'events.csv', { event: 'E5' }, { reason: 'Tool change', end: '2026-11-04T15:00:00' }],
      ['set', 'events.csv', { event: 'E6' }, { reason: 'Tool change' }],
      ['add', 'schedule.csv', { machine: 'LASER-1', scheduled_hours: '40' }],
      ['set', 'events.csv', { event: 'E9' }, { start: '2026-11-03T13:00:00', end: '2026-11-03T14:00:00' }],
      ['set', 'events.csv', { event: 'E10' }, { end: '2026-11-05T16:00:00' }],
    ],
    mutations: [
      { id: 'stop-without-reason', op: ['set', 'events.csv', { event: 'E1' }, { reason: '' }], expect: ['CNC-1', 'no_reason'] },
      { id: 'fewer-scheduled-hours', op: ['set', 'schedule.csv', { machine: 'PRESS-1' }, { scheduled_hours: '15' }], expect: ['PRESS-1', 'low_availability'] },
      { id: 'machine-off-schedule', op: ['drop', 'schedule.csv', { machine: 'WELD-1' }], expect: ['WELD-1', 'no_schedule'] },
    ],
  },

  'fairmake-capacity-load': {
    planted: { CNC: ['overloaded_week', 'near_capacity'], SAW: ['no_calendar'], WELD: ['past_due_load'] },
    clean: [
      ['set', 'operations.csv', { work_order: 'WO-2', operation: '20' }, { hours_remaining: '20' }],
      ['set', 'operations.csv', { work_order: 'WO-4' }, { hours_remaining: '50' }],
      ['set', 'operations.csv', { work_order: 'WO-1', operation: '20' }, { due_date: '2026-11-20' }],
      ['add', 'calendar.csv', { work_center: 'SAW', hours_per_day: '8', days_per_week: '5', efficiency_pct: '100' }],
    ],
    mutations: [
      { id: 'assembly-overloaded', op: ['set', 'operations.csv', { work_order: 'WO-6' }, { hours_remaining: '45' }], expect: ['ASSY', 'overloaded_week'] },
      { id: 'weld-due-date-passed', op: ['set', 'operations.csv', { work_order: 'WO-5' }, { due_date: '2026-11-12' }], expect: ['WELD', 'past_due_load'] },
    ],
  },

  'fairmake-preventive-maintenance': {
    planted: { 'PM-101': ['due_soon'], 'PM-102': ['overdue'], 'PM-103': ['due_soon'], 'PM-104': ['meter_overdue'], 'PM-105': ['never_done'], 'PM-106': ['no_interval'], 'PM-107': ['due_soon'] },
    clean: [
      ['set', 'pm-schedule.csv', { task: 'PM-101' }, { last_done: '2026-11-10' }],
      ['set', 'pm-schedule.csv', { task: 'PM-102' }, { last_done: '2026-11-10' }],
      ['set', 'pm-schedule.csv', { task: 'PM-103' }, { interval_days: '30' }],
      ['set', 'pm-schedule.csv', { task: 'PM-104' }, { hours_since: '400' }],
      ['set', 'pm-schedule.csv', { task: 'PM-105' }, { last_done: '2026-11-01' }],
      ['set', 'pm-schedule.csv', { task: 'PM-106' }, { interval_days: '90' }],
      ['set', 'pm-schedule.csv', { task: 'PM-107' }, { interval_days: '30' }],
    ],
    mutations: [
      { id: 'missed-by-date', op: ['set', 'pm-schedule.csv', { task: 'PM-108' }, { last_done: '2026-10-01' }], expect: ['PM-108', 'overdue'] },
      { id: 'over-run-hours', op: ['set', 'pm-schedule.csv', { task: 'PM-104' }, { hours_since: '1100' }], expect: ['PM-104', 'meter_overdue'] },
      { id: 'no-record-of-doing-it', op: ['set', 'pm-schedule.csv', { task: 'PM-110' }, { last_done: '' }], expect: ['PM-110', 'never_done'] },
    ],
  },

  'fairmake-calibration-due': {
    planted: { 'CAL-003': ['overdue', 'used_while_overdue'], 'HG-004': ['due_soon'], 'MIC-002': ['failed_then_used'], 'PG-005': ['never_calibrated'], 'THR-009': ['due_soon'], 'TW-006': ['no_interval'] },
    clean: [
      ['set', 'gauges.csv', { gauge: 'CAL-003' }, { last_cal: '2026-01-01' }],
      ['set', 'gauges.csv', { gauge: 'HG-004' }, { last_cal: '2026-03-01' }],
      ['set', 'gauges.csv', { gauge: 'MIC-002' }, { cal_result: 'Pass' }],
      ['set', 'gauges.csv', { gauge: 'PG-005' }, { last_cal: '2026-06-01', cal_result: 'Pass' }],
      ['set', 'gauges.csv', { gauge: 'THR-009' }, { last_cal: '2026-08-01' }],
      ['set', 'gauges.csv', { gauge: 'TW-006' }, { interval_days: '365' }],
    ],
    mutations: [
      { id: 'failed-gauge-in-use', op: ['set', 'gauges.csv', { gauge: 'MIC-008' }, { cal_result: 'Fail' }], expect: ['MIC-008', 'failed_then_used'] },
      { id: 'calibration-lapsed', op: ['set', 'gauges.csv', { gauge: 'MIC-001' }, { last_cal: '2025-06-01' }], expect: ['MIC-001', 'overdue'] },
    ],
  },

  'fairmake-cycle-counts': {
    planted: { 'CC-1002': ['out_of_tolerance'], 'CC-1003': ['out_of_tolerance', 'repeat_variance'], 'CC-1006': ['not_counted'], 'CC-1007': ['negative_system'], 'CC-1008': ['out_of_tolerance'], 'CC-1009': ['repeat_variance'] },
    clean: [
      ['set', 'counts.csv', { count_id: 'CC-1002' }, { counted_qty: '40' }],
      ['set', 'counts.csv', { count_id: 'CC-1003' }, { counted_qty: '1200' }],
      ['set', 'counts.csv', { count_id: 'CC-1009' }, { counted_qty: '800' }],
      ['set', 'counts.csv', { count_id: 'CC-1006' }, { counted_qty: '25' }],
      ['set', 'counts.csv', { count_id: 'CC-1007' }, { system_qty: '30' }],
      ['set', 'counts.csv', { count_id: 'CC-1008' }, { counted_qty: '15' }],
    ],
    mutations: [
      { id: 'c-item-short-in-value', op: ['set', 'counts.csv', { count_id: 'CC-1010' }, { counted_qty: '8500' }], expect: ['CC-1010', 'out_of_tolerance'] },
      { id: 'a-item-one-short', op: ['set', 'counts.csv', { count_id: 'CC-1012' }, { counted_qty: '7' }], expect: ['CC-1012', 'out_of_tolerance'] },
      { id: 'system-below-zero', op: ['set', 'counts.csv', { count_id: 'CC-1001' }, { system_qty: '-5' }], expect: ['CC-1001', 'negative_system'] },
    ],
  },

  'fairmake-obsolete-inventory': {
    planted: { 'BAR-1018': ['excess'], 'GSK-220': ['slow_moving'], 'KIT-9': ['inactive_with_stock'], 'PLT-OLD': ['obsolete'], 'SEAL-NEW': ['no_movement_data'], 'SPR-77': ['obsolete'], 'VLV-OLD': ['obsolete'] },
    clean: [
      ['set', 'inventory.csv', { item: 'VLV-OLD' }, { last_used: '2026-11-01', usage_12m: '600' }],
      ['set', 'inventory.csv', { item: 'GSK-220' }, { last_used: '2026-11-01', usage_12m: '600' }],
      ['set', 'inventory.csv', { item: 'BAR-1018' }, { on_hand: '1000' }],
      ['drop', 'inventory.csv', { item: 'PLT-OLD' }],
      ['set', 'inventory.csv', { item: 'KIT-9' }, { item_status: 'Active' }],
      ['set', 'inventory.csv', { item: 'SEAL-NEW' }, { last_used: '2026-11-15', usage_12m: '200' }],
      ['set', 'inventory.csv', { item: 'SPR-77' }, { last_used: '2026-11-01', usage_12m: '160' }],
    ],
    mutations: [
      { id: 'bracket-stops-moving', op: ['set', 'inventory.csv', { item: 'BRK-100' }, { last_used: '2025-09-01' }], expect: ['BRK-100', 'obsolete'] },
      { id: 'housing-discontinued', op: ['set', 'inventory.csv', { item: 'HSG-300' }, { item_status: 'Discontinued' }], expect: ['HSG-300', 'inactive_with_stock'] },
      { id: 'bracket-usage-falls', op: ['set', 'inventory.csv', { item: 'BRK-100' }, { usage_12m: '200' }], expect: ['BRK-100', 'excess'] },
    ],
  },

  'fairmake-shelf-life': {
    planted: { 'L-2601': ['expired_on_hand'], 'L-2602': ['expiring_soon', 'short_dated_shipment'], 'L-2603': ['fefo_skipped'], 'L-2604': ['no_expiry'], 'L-2605': ['shipped_expired'], 'L-2607': ['expiring_soon'], 'L-2608': ['fefo_skipped'] },
    clean: [
      ['set', 'lots.csv', { lot: 'L-2601' }, { on_hand: '0' }],
      ['set', 'lots.csv', { lot: 'L-2602' }, { expiry_date: '2027-04-01' }],
      ['set', 'shipments.csv', { shipment: 'S-2' }, { lot: 'L-2602' }],
      ['set', 'lots.csv', { lot: 'L-2604' }, { expiry_date: '2027-07-01' }],
      ['set', 'shipments.csv', { shipment: 'S-3' }, { lot: 'L-2606' }],
      ['set', 'lots.csv', { lot: 'L-2607' }, { expiry_date: '2027-03-01' }],
      ['set', 'shipments.csv', { shipment: 'S-4' }, { lot: 'L-2607' }],
    ],
    mutations: [
      { id: 'lubricant-expiring', op: ['set', 'lots.csv', { lot: 'L-2606' }, { expiry_date: '2026-12-01' }], expect: ['L-2606', 'expiring_soon'] },
      { id: 'retailer-gets-short-date', op: ['set', 'lots.csv', { lot: 'L-2606' }, { expiry_date: '2027-01-15' }], expect: ['L-2606', 'short_dated_shipment'] },
      { id: 'lot-without-expiry', op: ['set', 'lots.csv', { lot: 'L-2608' }, { expiry_date: '' }], expect: ['L-2608', 'no_expiry'] },
    ],
  },

  'fairmake-reorder-points': {
    planted: { 'BAR-4140': ['at_reorder_point', 'rop_stale'], 'BRG-6204': ['stockout', 'rop_stale'], 'CAS-310': ['rop_stale'], 'GSK-220': ['rop_stale'], 'PLT-A36': ['no_rop'], 'SEAL-10': ['below_safety_stock', 'at_reorder_point'] },
    clean: [
      ['set', 'items.csv', { item: 'BRG-6204' }, { on_hand: '600', reorder_point: '380' }],
      ['set', 'items.csv', { item: 'SEAL-10' }, { on_hand: '500' }],
      ['set', 'items.csv', { item: 'GSK-220' }, { reorder_point: '160' }],
      ['set', 'items.csv', { item: 'BAR-4140' }, { on_hand: '2000', reorder_point: '1900' }],
      ['set', 'items.csv', { item: 'CAS-310' }, { on_hand: '80', reorder_point: '60' }],
      ['set', 'items.csv', { item: 'PLT-A36' }, { reorder_point: '10' }],
    ],
    mutations: [
      { id: 'housing-below-safety', op: ['set', 'items.csv', { item: 'HSG-300' }, { on_hand: '3' }], expect: ['HSG-300', 'below_safety_stock'] },
      { id: 'bolts-allocated', op: ['set', 'items.csv', { item: 'BOLT-M8' }, { allocated: '7000' }], expect: ['BOLT-M8', 'at_reorder_point'] },
      { id: 'bolt-rop-cut', op: ['set', 'items.csv', { item: 'BOLT-M8' }, { reorder_point: '3000' }], expect: ['BOLT-M8', 'rop_stale'] },
    ],
  },

  'fairmake-lot-traceability': {
    planted: { 'FG-1002': ['used_before_received', 'consumed_without_lot'], 'FG-1003': ['lot_not_received'], 'WO-4 (no finished lot)': ['consumed_without_lot'], 'S5 (no lot)': ['shipped_no_lot'], 'SN-7001': ['shipped_unknown_lot', 'serial_shipped_twice'] },
    clean: [
      ['set', 'receipts.csv', { lot: 'RL-503' }, { receipt_date: '2026-11-01' }],
      ['set', 'consumption.csv', { record: 'C5' }, { component_lot: 'RL-502' }],
      ['add', 'receipts.csv', { lot: 'RL-599', item: 'GSK-220', receipt_date: '2026-10-20', supplier: 'Demo Seals Inc' }],
      ['set', 'consumption.csv', { record: 'C8' }, { finished_lot: 'FG-1004' }],
      ['drop', 'shipments.csv', { shipment: 'S4' }],
      ['add', 'consumption.csv', { record: 'C10', work_order: 'WO-6', finished_lot: 'SN-7001', component: 'BAR-4140', component_lot: 'RL-501', qty: '1', consume_date: '2026-11-08' }],
      ['set', 'shipments.csv', { shipment: 'S5' }, { lot_or_serial: 'FG-1002' }],
    ],
    mutations: [
      { id: 'issue-without-lot', op: ['set', 'consumption.csv', { record: 'C1' }, { component_lot: '' }], expect: ['FG-1001', 'consumed_without_lot'] },
      { id: 'ship-unknown-lot', op: ['set', 'shipments.csv', { shipment: 'S7' }, { lot_or_serial: 'FG-1999' }], expect: ['FG-1999', 'shipped_unknown_lot'] },
      { id: 'received-after-use', op: ['set', 'receipts.csv', { lot: 'RL-501' }, { receipt_date: '2026-10-20' }], expect: ['FG-1001', 'used_before_received'] },
    ],
  },

  'fairmake-late-purchase-orders': {
    planted: { 'PO-601-1': ['past_due', 'promise_after_due'], 'PO-601-2': ['promise_after_need'], 'PO-602-1': ['no_promise'], 'PO-603-1': ['past_due'], 'PO-603-2': ['promise_after_due'], 'PO-604-2': ['over_received'], 'PO-606-1': ['past_due'] },
    clean: [
      ['set', 'po-lines.csv', { po_line: 'PO-601-1' }, { qty_received: '1000' }],
      ['set', 'po-lines.csv', { po_line: 'PO-601-2' }, { promise_date: '2026-11-20' }],
      ['set', 'po-lines.csv', { po_line: 'PO-602-1' }, { promise_date: '2026-12-05' }],
      ['set', 'po-lines.csv', { po_line: 'PO-603-1' }, { qty_received: '20000' }],
      ['set', 'po-lines.csv', { po_line: 'PO-603-2' }, { promise_date: '2026-11-25' }],
      ['set', 'po-lines.csv', { po_line: 'PO-604-2' }, { qty_received: '20' }],
      ['set', 'po-lines.csv', { po_line: 'PO-606-1' }, { qty_received: '30' }],
    ],
    mutations: [
      { id: 'promise-slips', op: ['set', 'po-lines.csv', { po_line: 'PO-604-1' }, { promise_date: '2026-12-05' }], expect: ['PO-604-1', 'promise_after_due'] },
      { id: 'over-receipt', op: ['set', 'po-lines.csv', { po_line: 'PO-605-2' }, { qty_received: '650' }], expect: ['PO-605-2', 'over_received'] },
      { id: 'never-confirmed', op: ['set', 'po-lines.csv', { po_line: 'PO-605-1' }, { order_date: '2026-11-10' }], expect: ['PO-605-1', 'no_promise'] },
    ],
  },

  'fairmake-supplier-scorecards': {
    planted: { 'Sample Steel Supply': ['few_receipts'], 'Fastener Example Co': ['price_over_po'], 'Demo Castings LLC': ['high_ppm'], 'North Example Metals': ['low_on_time'] },
    clean: [
      ['set', 'receipts.csv', { receipt: 'R3' }, { receipt_date: '2026-11-01' }],
      ['set', 'receipts.csv', { receipt: 'R4' }, { qty_rejected: '0' }],
      ['set', 'receipts.csv', { receipt: 'R5' }, { qty_rejected: '0' }],
      ['set', 'receipts.csv', { receipt: 'R9' }, { unit_price: '0.05' }],
      ['add', 'receipts.csv', { receipt: 'R15', supplier: 'Sample Steel Supply', item: 'PLT-A36', due_date: '2026-11-15', receipt_date: '2026-11-15', qty_received: '30', qty_rejected: '0', unit_price: '52.00', po_price: '52.00' }],
    ],
    mutations: [
      { id: 'seal-delivery-late', op: ['set', 'receipts.csv', { receipt: 'R13' }, { receipt_date: '2026-10-25' }], expect: ['Demo Seals Inc', 'low_on_time'] },
      { id: 'seal-rejects', op: ['set', 'receipts.csv', { receipt: 'R14' }, { qty_rejected: '50' }], expect: ['Demo Seals Inc', 'high_ppm'] },
    ],
  },

  'fairmake-rebate-claims': {
    planted: { 'DSI-2026': ['rebate_accruing', 'near_next_tier'], 'FEC-2026': ['rebate_accruing', 'over_contract_price'], 'NWM-2026': ['rebate_unclaimed', 'claim_window_passed'] },
    clean_note: 'a rebate earned on an agreement that is still running is reported as rebate_accruing by design, so the clean set keeps the two running agreements below their first tier and adds the missing claim to the ended one.',
    clean: [
      ['add', 'claims.csv', { agreement: 'NWM-2026', amount: '1400', claim_date: '2026-10-20' }],
      ['set', 'purchases.csv', { line: 'P6' }, { unit_price: '0.05' }],
      ['drop', 'purchases.csv', { line: 'P5' }],
      ['drop', 'purchases.csv', { line: 'P8' }],
    ],
    mutations: [
      { id: 'paid-over-agreed-price', op: ['set', 'purchases.csv', { line: 'P6' }, { unit_price: '0.07' }], expect: ['FEC-2026', 'over_contract_price'] },
      { id: 'close-to-first-tier', op: ['set', 'purchases.csv', { line: 'P9' }, { qty: '7500' }], expect: ['DSI-2026', 'near_next_tier'] },
      { id: 'claim-short', op: ['set', 'claims.csv', { agreement: 'NWM-2026', amount: '1400' }, { amount: '400' }], expect: ['NWM-2026', 'rebate_unclaimed'] },
    ],
  },

  'fairmake-retailer-deductions': {
    planted: { 'D-9001': ['disputable'], 'D-9002': ['disputable'], 'D-9003': ['needs_evidence'], 'D-9004': ['disputable', 'window_closed'], 'D-9005': ['needs_evidence', 'small_amount'], 'D-9006': ['needs_evidence'], 'D-9007': ['unknown_reason', 'no_reference'], 'D-9008': ['needs_evidence'], 'D-9009': ['no_reference', 'needs_evidence'] },
    clean_note: 'no clean set: every deduction is a decision for a person (accept, dispute or find documents), so each one gets a finding by design. Mutations run on the demo files.',
    clean: null,
    mutations: [
      { id: 'asn-sent-in-time', op: ['set', 'shipments.csv', { invoice: 'INV-3006' }, { asn_sent: '2026-11-02T09:00:00' }], expect: ['D-9006', 'disputable'] },
      { id: 'shortage-with-pod', op: ['set', 'shipments.csv', { invoice: 'INV-3008' }, { pod: 'Y' }], expect: ['D-9008', 'disputable'] },
    ],
  },

  'fairmake-order-backlog': {
    planted: { 'SO-501-1': ['past_due', 'promised_after_request'], 'SO-502-1': ['promised_after_request'], 'SO-503-1': ['due_soon'], 'SO-503-2': ['no_promise'], 'SO-504-1': ['past_due', 'promised_after_request'], 'SO-504-2': ['on_hold'] },
    clean: [
      ['set', 'orders.csv', { order_line: 'SO-501-1' }, { qty_open: '0' }],
      ['set', 'orders.csv', { order_line: 'SO-502-1' }, { requested_date: '2026-12-10' }],
      ['set', 'orders.csv', { order_line: 'SO-503-1' }, { requested_date: '2026-12-01', promise_date: '2026-12-01' }],
      ['set', 'orders.csv', { order_line: 'SO-503-2' }, { promise_date: '2026-12-15' }],
      ['set', 'orders.csv', { order_line: 'SO-504-1' }, { qty_open: '0' }],
      ['set', 'orders.csv', { order_line: 'SO-504-2' }, { line_status: 'Open' }],
    ],
    mutations: [
      { id: 'promise-later-than-asked', op: ['set', 'orders.csv', { order_line: 'SO-505-1' }, { promise_date: '2027-01-05' }], expect: ['SO-505-1', 'promised_after_request'] },
      { id: 'promise-missing', op: ['set', 'orders.csv', { order_line: 'SO-505-2' }, { promise_date: '' }], expect: ['SO-505-2', 'no_promise'] },
      { id: 'put-on-hold', op: ['set', 'orders.csv', { order_line: 'SO-505-1' }, { line_status: 'Credit Hold' }], expect: ['SO-505-1', 'on_hold'] },
    ],
  },

  'fairmake-ncr-capa-aging': {
    planted: { 'CAPA-21': ['capa_overdue'], 'CAPA-22': ['no_root_cause'], 'CAPA-23': ['closed_unverified'], 'NCR-101': ['ncr_overdue', 'no_disposition'], 'NCR-103': ['repeat_without_capa'], 'NCR-105': ['no_disposition', 'capa_not_found'], 'NCR-107': ['no_disposition'] },
    clean: [
      ['set', 'capas.csv', { capa: 'CAPA-21' }, { due: '2026-12-15' }],
      ['set', 'capas.csv', { capa: 'CAPA-22' }, { root_cause: 'Gauge drift' }],
      ['set', 'capas.csv', { capa: 'CAPA-23' }, { verified: 'Y' }],
      ['set', 'ncrs.csv', { ncr: 'NCR-101' }, { closed: '2026-09-20', disposition: 'Scrap', ncr_status: 'Closed' }],
      ['set', 'ncrs.csv', { ncr: 'NCR-103' }, { capa: 'CAPA-22' }],
      ['set', 'ncrs.csv', { ncr: 'NCR-105' }, { disposition: 'Rework', capa: 'CAPA-21' }],
      ['set', 'ncrs.csv', { ncr: 'NCR-107' }, { disposition: 'Scrap' }],
    ],
    mutations: [
      { id: 'closed-without-check', op: ['set', 'capas.csv', { capa: 'CAPA-20' }, { verified: 'N' }], expect: ['CAPA-20', 'closed_unverified'] },
      { id: 'ncr-left-open', op: ['set', 'ncrs.csv', { ncr: 'NCR-108' }, { opened: '2026-10-01' }], expect: ['NCR-108', 'ncr_overdue'] },
      { id: 'capa-due-passed', op: ['set', 'capas.csv', { capa: 'CAPA-22' }, { due: '2026-11-10' }], expect: ['CAPA-22', 'capa_overdue'] },
    ],
  },

  'fairmake-osha-300-log': {
    planted: { '2026-003': ['days_missing', 'open_case'], '2026-004': ['outcome_days_mismatch', 'late_entry'], '2026-005': ['days_missing', 'privacy_name_on_log'], '2026-006': ['missing_field'], '2026-007': ['days_over_cap', 'open_case'], '2026-008': ['first_aid_recordable'] },
    clean: [
      ['set', 'cases.csv', { case_number: '2026-003' }, { days_restricted: '10', return_date: '2026-04-26' }],
      ['set', 'cases.csv', { case_number: '2026-004' }, { outcome: 'Days away', entered_date: '2026-05-21' }],
      ['set', 'cases.csv', { case_number: '2026-005' }, { employee: 'Privacy case', days_away: '1' }],
      ['set', 'cases.csv', { case_number: '2026-006' }, { job_title: 'Machinist', location: 'CNC cell' }],
      ['set', 'cases.csv', { case_number: '2026-007' }, { days_away: '60', days_restricted: '30', return_date: '2026-11-10' }],
      ['set', 'cases.csv', { case_number: '2026-008' }, { recordable: 'N' }],
    ],
    mutations: [
      { id: 'entered-late', op: ['set', 'cases.csv', { case_number: '2026-001' }, { entered_date: '2026-03-01' }], expect: ['2026-001', 'late_entry'] },
      { id: 'job-title-blank', op: ['set', 'cases.csv', { case_number: '2026-001' }, { job_title: '' }], expect: ['2026-001', 'missing_field'] },
      { id: 'outcome-contradicts-days', op: ['set', 'cases.csv', { case_number: '2026-002' }, { outcome: 'Other recordable' }], expect: ['2026-002', 'outcome_days_mismatch'] },
    ],
  },

  'fairmake-hts-codes': {
    planted: { 'BOLT-M8': ['same_description_split'], 'BOLT-M8-ZP': ['same_description_split'], 'BRG-6204': ['entry_coo_differs'], 'CAS-310': ['missing_hts'], 'GSK-220': ['hts_format'], 'HSG-300': ['duty_rate_differs'], 'NUT-M8': ['entry_hts_differs'], 'SEAL-10': ['hts_not_in_list', 'missing_coo'] },
    planted_summary: { entry_items_not_in_master: ['VALVE-9'] },
    clean_json: {
      'settings.json': {
        note: 'Fictional code list kept with the customs broker (clean set: codes for every item added).',
        codes: { '7318.15.2065': { duty_pct: 0 }, '7318.16.0085': { duty_pct: 0 }, '8482.10.5044': { duty_pct: 9 }, '7208.51.00': { duty_pct: 0 }, '8413.91.9095': { duty_pct: 0 }, '7325.10.0080': { duty_pct: 0 }, '4016.93.5050': { duty_pct: 2.5 }, '8484.90.0000': { duty_pct: 0 }, '8481.80.9050': { duty_pct: 2 } },
      },
    },
    clean: [
      ['set', 'items.csv', { item: 'BOLT-M8-ZP' }, { hts_code: '7318.15.2065' }],
      ['set', 'entries.csv', { entry_line: 'E2-2' }, { country_of_origin: 'JP' }],
      ['set', 'items.csv', { item: 'CAS-310' }, { hts_code: '7325.10.0080' }],
      ['set', 'items.csv', { item: 'GSK-220' }, { hts_code: '8484.90.0000' }],
      ['set', 'entries.csv', { entry_line: 'E3-1' }, { duty_rate: '0' }],
      ['set', 'entries.csv', { entry_line: 'E2-1' }, { hts_code: '7318.16.0085' }],
      ['set', 'items.csv', { item: 'SEAL-10' }, { hts_code: '4016.93.5050', country_of_origin: 'US' }],
      ['add', 'items.csv', { item: 'VALVE-9', description: 'Ball valve', hts_code: '8481.80.9050', country_of_origin: 'IT', supplier: 'Demo Valves Example' }],
    ],
    mutations: [
      { id: 'origin-blank', op: ['set', 'items.csv', { item: 'PLT-A36' }, { country_of_origin: '' }], expect: ['PLT-A36', 'missing_coo'] },
      { id: 'duty-declared-differently', op: ['set', 'entries.csv', { entry_line: 'E1-2' }, { duty_rate: '5' }], expect: ['BRG-6204', 'duty_rate_differs'] },
      { id: 'entry-under-other-code', op: ['set', 'entries.csv', { entry_line: 'E1-1' }, { hts_code: '7318.16.0085' }], expect: ['BOLT-M8', 'entry_hts_differs'] },
    ],
  },

  'fairmake-edi-asn-errors': {
    planted: { 'PO-8001': ['duplicate_sscc'], 'PO-8002': ['asn_over_po', 'asn_qty_mismatch', 'asn_late'], 'PO-8003': ['missing_sscc'], 'PO-8004': ['asn_item_not_on_po', 'asn_qty_mismatch', 'duplicate_sscc'], 'PO-8005': ['no_asn'], 'PO-8099': ['po_not_found'] },
    clean: [
      ['set', 'asns.csv', { asn: 'ASN-2' }, { qty: '10', sent_at: '2026-11-06T08:30:00' }],
      ['set', 'asns.csv', { asn: 'ASN-3' }, { sscc: '000123450000000033' }],
      ['set', 'asns.csv', { asn: 'ASN-4' }, { item: 'BRK-200', sscc: '000123450000000044' }],
      ['add', 'asns.csv', { asn: 'ASN-6', po_number: 'PO-8005', item: 'BRK-100', qty: '12', sscc: '000123450000000066', ship_date: '2026-11-09', sent_at: '2026-11-09T08:30:00' }],
      ['drop', 'asns.csv', { asn: 'ASN-5' }],
    ],
    mutations: [
      { id: 'asn-quantity-off', op: ['set', 'asns.csv', { asn: 'ASN-1', item: 'BRK-200' }, { qty: '10' }], expect: ['PO-8001', 'asn_qty_mismatch'] },
      { id: 'asn-sent-late', op: ['set', 'asns.csv', { asn: 'ASN-3' }, { sent_at: '2026-11-07T12:00:00' }], expect: ['PO-8003', 'asn_late'] },
      { id: 'carton-label-reused', op: ['set', 'asns.csv', { asn: 'ASN-6' }, { sscc: '000123450000000033' }], expect: ['PO-8005', 'duplicate_sscc'] },
    ],
  },

  'fairmake-edi-invoice-check': {
    planted: { 'INV-4002': ['price_mismatch'], 'INV-4004': ['qty_over_po'], 'INV-4005': ['item_not_on_po'], 'INV-4006': ['po_not_found'], 'INV-4007': ['price_mismatch', 'qty_over_po', 'possible_duplicate'] },
    clean: [
      ['set', 'invoices.csv', { invoice: 'INV-4002' }, { unit_price: '12.00' }],
      ['drop', 'invoices.csv', { invoice: 'INV-4007' }],
      ['set', 'invoices.csv', { invoice: 'INV-4004' }, { qty: '20' }],
      ['drop', 'invoices.csv', { invoice: 'INV-4005' }],
      ['drop', 'invoices.csv', { invoice: 'INV-4006' }],
    ],
    mutations: [
      { id: 'price-above-po', op: ['set', 'invoices.csv', { invoice: 'INV-4001', line: '2' }, { unit_price: '7.50' }], expect: ['INV-4001', 'price_mismatch'] },
      { id: 'billed-more-than-ordered', op: ['set', 'invoices.csv', { invoice: 'INV-4003' }, { qty: '70' }], expect: ['INV-4003', 'qty_over_po'] },
      { id: 'po-unknown', op: ['set', 'invoices.csv', { invoice: 'INV-4004' }, { po_number: 'PO-9998' }], expect: ['INV-4004', 'po_not_found'] },
    ],
  },

  'fairmake-material-certs': {
    planted: { 'RC-2002': ['out_of_spec'], 'RC-2003': ['cert_missing'], 'RC-2004': ['cert_lot_mismatch'], 'RC-2005': ['property_missing'], 'RC-2006': ['cert_not_found'], 'RC-2008': ['no_spec'] },
    clean_json: {
      'specs.json': {
        note: 'Fictional purchase specs (clean set: the gasket added). Values are illustrative, not taken from any standard.',
        items: {
          'BAR-4140': { cert_required: true, properties: { tensile_ksi: { min: 95 }, hardness_hrc: { max: 32 } } },
          'PLT-A36': { cert_required: true, properties: { yield_ksi: { min: 36 } } },
          'CAS-310': { cert_required: true, properties: { tensile_ksi: { min: 30 } } },
          'SCR-M8': { cert_required: false },
          'GSK-220': { cert_required: false },
        },
      },
    },
    clean: [
      ['set', 'certs.csv', { cert_id: 'MTR-1002', property: 'tensile_ksi' }, { value: '98' }],
      ['add', 'certs.csv', { cert_id: 'MTR-1003', lot: 'H-1003', property: 'tensile_ksi', value: '101' }],
      ['add', 'certs.csv', { cert_id: 'MTR-1003', lot: 'H-1003', property: 'hardness_hrc', value: '29' }],
      ['set', 'receipts.csv', { receipt: 'RC-2003' }, { cert_id: 'MTR-1003' }],
      ['set', 'certs.csv', { cert_id: 'MTR-2001' }, { lot: 'P-77' }],
      ['add', 'certs.csv', { cert_id: 'MTR-2002', lot: 'P-78', property: 'yield_ksi', value: '42' }],
      ['add', 'certs.csv', { cert_id: 'COC-9', lot: 'C-5', property: 'tensile_ksi', value: '35' }],
    ],
    mutations: [
      { id: 'hardness-over-max', op: ['set', 'certs.csv', { cert_id: 'MTR-1001', property: 'hardness_hrc' }, { value: '34' }], expect: ['RC-2001', 'out_of_spec'] },
      { id: 'cert-not-attached', op: ['set', 'receipts.csv', { receipt: 'RC-2001' }, { cert_id: '' }], expect: ['RC-2001', 'cert_missing'] },
      { id: 'cert-for-other-heat', op: ['set', 'certs.csv', { cert_id: 'MTR-2001' }, { lot: 'P-70' }], expect: ['RC-2004', 'cert_lot_mismatch'] },
    ],
  },
};
