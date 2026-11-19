// Catalogue of export files from ERP, MRP, MES, quality and EDI systems
// that the Fairmake agents recognise.
//
// Each entry says how to recognise the file (column names that must be there).
// An agent turns an entry into a profile by adding its own column map:
//
//   exportProfile('slack_members', { user: 'fullname', email: 'email' })
//
// basis:
//   'documented'  the column names were checked against the vendor's own
//                 documentation (source and date given);
//   'recalled'    the layout was written from knowledge of the export and was
//                 not checked against documentation or a live account;
//   'tested'      an agent was run on a real published file in this layout
//                 (which file and when given). Only public files are used.
// No layout was tested against a customer's live account. When a header differs, the
// file still maps by each column's "also called" list, `inspect` shows what was
// matched, and fairmake-sources.json names the columns by hand.

const e = (id, system, label, signature, extra = {}) => Object.freeze({ id, system, label, signature, basis: 'recalled', ...extra });

export const EXPORTS = Object.freeze(Object.fromEntries([
  // Work orders, jobs and job cost
  e('epicor_job_cost', 'Epicor Kinetic', 'Job cost summary (BAQ export, one row per job)', ['Job', 'Part', 'Est Mtl Cost', 'Act Mtl Cost']),
  e('netsuite_work_orders', 'NetSuite', 'Work order saved search (default column labels)', ['Document Number', 'Assembly', 'Quantity', 'Built']),
  e('jobboss_job_summary', 'JobBOSS', 'Job cost summary report (CSV)', ['Job', 'Customer', 'Quoted Price', 'Act Total Cost']),
  e('infor_csi_job_operations', 'Infor CloudSuite Industrial (SyteLine)', 'Job operations list export', ['Job', 'Oper Num', 'Work Center', 'Hours Remaining']),
  e('mes_production_counts', 'MES (generic)', 'Production counts by work order', ['Work Order', 'Machine', 'Good Count', 'Reject Count']),
  e('mes_downtime_events', 'MES (generic)', 'Downtime events export', ['Machine', 'Start Time', 'End Time', 'Downtime Reason']),
  // Labor and overhead
  e('jobboss_labor_detail', 'JobBOSS', 'Labor detail report (CSV)', ['Employee', 'Work Center', 'Job', 'Hours']),
  e('jobboss_labor_by_wc', 'JobBOSS', 'Labor hours by work center (CSV)', ['Work Center', 'Period', 'Act Run Hrs']),
  // Bills of material and items
  e('katana_recipes', 'Katana', 'Recipes (bill of materials) export', ['Product variant code', 'Ingredient variant code', 'Quantity']),
  e('mrpeasy_boms', 'MRPeasy', 'Bills of materials export', ['BOM number', 'Product', 'Part number', 'Quantity']),
  e('mrpeasy_stock_items', 'MRPeasy', 'Stock items export', ['Part No.', 'In stock', 'Reorder point']),
  e('acumatica_stock_items', 'Acumatica', 'Stock items (IN202500) list export', ['Inventory ID', 'Description', 'Tariff Code', 'Country of Origin']),
  // Inventory
  e('fishbowl_cycle_count', 'Fishbowl', 'Cycle count export', ['Part Number', 'Location', 'Qty On Hand', 'Qty Counted']),
  e('fishbowl_lots', 'Fishbowl', 'Inventory by tracking (lot and expiration) export', ['Part Number', 'Lot Number', 'Expiration Date', 'Qty']),
  e('qbe_inventory_valuation', 'QuickBooks Enterprise', 'Inventory Valuation Detail report (CSV or Excel)', ['Item', 'On Hand', 'Avg Cost', 'Asset Value'], { dropTotals: true }),
  e('netsuite_assembly_components', 'NetSuite', 'Assembly build components with inventory detail (saved search)', ['Document Number', 'Assembly', 'Component', 'Lot/Serial Number']),
  // Purchasing and receiving
  e('sap_b1_grpo_lines', 'SAP Business One', 'Goods Receipt PO document rows export', ['Document Number', 'Vendor Code', 'Item No.', 'Unit Price']),
  e('sap_b1_open_po', 'SAP Business One', 'Open Items List, purchase orders', ['Document Number', 'Vendor Name', 'Item No.', 'Open Qty']),
  e('acumatica_purchase_receipts', 'Acumatica', 'Purchase receipt lines (PO302000) export', ['Receipt Nbr.', 'Vendor', 'Inventory ID', 'Receipt Qty.']),
  e('netsuite_purchase_lines', 'NetSuite', 'Transaction saved search, purchase lines (default column labels)', ['Document Number', 'Vendor', 'Item', 'Rate']),
  e('epicor_receipts', 'Epicor Kinetic', 'Receipt entry lines export', ['Pack Slip', 'Supplier', 'Part', 'Lot']),
  // Customers, orders and EDI
  e('netsuite_open_sales_orders', 'NetSuite', 'Open sales order lines (saved search)', ['Document Number', 'Customer', 'Item', 'Expected Ship Date']),
  e('qbe_sales_detail', 'QuickBooks Enterprise', 'Sales by Customer Detail report (CSV)', ['Type', 'Num', 'Name', 'Item', 'Sales Price']),
  e('retailer_remittance', 'Retailer supplier portal (generic)', 'Remittance detail with deductions', ['Check Number', 'Invoice Number', 'Deduction Amount', 'Reason Code']),
  e('edi_asn_report', 'EDI provider (generic)', 'ASN transaction report export', ['PO Number', 'ASN Number', 'SSCC', 'Ship Date']),
  // Quality, maintenance and safety
  e('qms_ncr_log', 'QMS (generic)', 'Nonconformance log export', ['NCR Number', 'Date Opened', 'Part Number', 'Defect Code']),
  e('calibration_register', 'Calibration software (generic)', 'Gauge register export', ['Gauge ID', 'Last Calibration', 'Calibration Interval', 'Result']),
  e('cmms_pm_schedule', 'CMMS (generic)', 'Preventive maintenance schedule export', ['Asset', 'PM Task', 'Frequency (days)', 'Last Completed']),
  e('ehs_incident_log', 'EHS software (generic)', 'Incident log export', ['Case Number', 'Date of Injury', 'Job Title', 'Days Away']),
  e('osha_ita_case_detail', 'OSHA Injury Tracking Application', 'Case detail data (Forms 300 and 301) as OSHA publishes it', ['establishment_id', 'case_number', 'date_of_incident', 'incident_outcome', 'dafw_num_away', 'djtr_num_tr'], { basis: 'tested', tested: 'OSHA ITA Case Detail Data 2024 (published file, osha.gov/itadata), 19 Nov 2026' }),
].map((x) => [x.id, x])));

/** A profile for an agent: a catalogue entry plus the agent's column map. */
export function exportProfile(key, map, extra = {}) {
  const base = EXPORTS[key];
  if (!base) throw new Error(`unknown export "${key}"`);
  return { ...base, map, ...extra };
}

export const EXPORTS_BASIS_NOTE = 'Where a layout says "checked", its column names were compared with the vendor\'s documentation on that date; where it says "tested", an agent was run on a real published file in that layout. The other layouts were written from knowledge of the export and were not checked. None was tested against a customer\'s live account.';

/**
 * Row hook for grouped reports (QuickBooks style): a row with only its first
 * cell filled names the group for the rows under it; "Total for ..." rows end it.
 * The group name is written to `field` on each detail row.
 */
export function carryGroup(field, { groupColumn = '', isDetail } = {}) {
  return (rows) => {
    const out = []; let group = '';
    for (const r of rows) {
      const label = String(r[groupColumn] ?? '').trim();
      const detail = isDetail ? isDetail(r) : Object.entries(r).some(([k, v]) => k !== groupColumn && k !== field && String(v ?? '').trim() !== '');
      if (label && /^(grand\s+)?total\b/i.test(label)) continue;
      if (label && !detail) { group = label; continue; }
      if (!detail) continue;
      const { [groupColumn]: _drop, ...rest } = r;
      out.push({ ...rest, [field]: String(r[field] ?? '').trim() || label || group });
    }
    return out;
  };
}

/** Row hook: keep the first row for each value of `field` (Shopify repeats an order once per line item). */
export function firstRowPer(field) {
  return (rows) => { const seen = new Set(); return rows.filter((r) => { const k = String(r[field] ?? ''); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
}

/** "First Last" from two columns, for exports that split the name. */
export const fullName = (first, last) => ({ from: [first, last], compute: (_r, get) => [get(first), get(last)].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ') });
