/**
 * Excel Export Utility for Medical Record Audit (MRA)
 * Generates multi-worksheet Excel (.xlsx) workbooks adhering to MRA hospital design guidelines:
 * - Font: Tahoma (Size 11) consistently across all sheets, headers, and cells
 * - Color Theme: MRA System Concept — Navy Blue (#1E3A8A) & Pink Accent (#DB2777)
 * - AutoFit Columns & Rows: Precise column widths based on true visual Thai text length,
 *   with AutoFilter allowance (+4.5) and row heights (26 for header, 22+ for data)
 * - AutoFilter: Enabled on all table header columns
 * - Strict DataTypes: Real numbers for counts (#,##0), scores (#,##0.0), percentages (0.0%), and strings (@) for codes/HN
 * - Clean thin borders (#CBD5E1) on all cells with professional zebra striping
 */

import type ExcelJS from 'exceljs';

// ── Typography & Palette Tokens ──
const FONT_NAME = 'Tahoma';
const FONT_SIZE = 11;

const BLUE_NAVY_ARGB = 'FF1E3A8A'; // Blue-900 / Navy Primary
const PINK_ACCENT_ARGB = 'FFDB2777'; // Pink-600 Accent
const WHITE_ARGB = 'FFFFFFFF';
const BORDER_COLOR_ARGB = 'FFCBD5E1'; // Slate-300 Border
const ZEBRA_BG_ARGB = 'FFF8FAFC'; // Soft Slate-50 zebra stripe
const LABEL_BG_ARGB = 'FFF1F5F9'; // Soft Slate-100 label cell background
const PASS_GREEN_ARGB = 'FF047857'; // Emerald-700
const FAIL_ROSE_ARGB = 'FFE11D48'; // Rose-600

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: BORDER_COLOR_ARGB } },
  left: { style: 'thin', color: { argb: BORDER_COLOR_ARGB } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR_ARGB } },
  right: { style: 'thin', color: { argb: BORDER_COLOR_ARGB } },
};

const thaiMarksRegex = /[\u0E31\u0E34-\u0E3E\u0E47-\u0E4E]/g;

function formatThaiDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    const [y, m, d] = clean.split('-');
    if (!y || !m || !d) return dateStr;
    const yearInt = parseInt(y, 10);
    const thaiYear = yearInt > 2400 ? yearInt : yearInt + 543;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${thaiYear}`;
  } catch {
    return dateStr;
  }
}

function formatFindingThai(finding?: string | null): string {
  if (finding === 'no_issue') return 'ไม่มีปัญหาสำคัญ';
  if (finding === 'certain_issues') return 'มีประเด็นต้องค้นต่อ';
  if (finding === 'inadequate') return 'ข้อมูลไม่เพียงพอ';
  return finding || '-';
}

/**
 * Accurately auto-fits column widths according to content length,
 * skipping title/banner rows so that Column A is never excessively widened.
 */
function autoFitColumns(
  worksheet: ExcelJS.Worksheet,
  headerRowIndex: number = 1,
  options?: {
    minWidths?: Record<number, number>;
    maxWidths?: Record<number, number>;
  }
) {
  worksheet.columns.forEach((column, colIdx) => {
    const colNumber = colIdx + 1;
    let maxVisualLen = 8;

    if (column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        // Skip title/subtitle/banner rows above the table header to avoid blowing out column 1!
        if (rowNumber < headerRowIndex) return;

        const val = cell.value;
        if (val !== undefined && val !== null) {
          const isHeader = rowNumber === headerRowIndex;
          const str = String(val);
          const lines = str.split('\n');

          for (const line of lines) {
            // Strip Thai vowel & tone combining marks to measure true visual character width
            const visualLen = line.replace(thaiMarksRegex, '').length;
            // Add extra space for the Excel AutoFilter dropdown arrow (▼) on header row
            const effectiveLen = isHeader ? visualLen + 4.5 : visualLen;
            if (effectiveLen > maxVisualLen) {
              maxVisualLen = effectiveLen;
            }
          }
        }
      });
    }

    // Add +3 padding for breathing space so text never collides with cell borders
    const computedWidth = Math.ceil(maxVisualLen + 3);
    const minW = options?.minWidths?.[colNumber] ?? 10;
    const maxW = options?.maxWidths?.[colNumber] ?? 48;

    column.width = Math.min(Math.max(computedWidth, minW), maxW);
  });
}

function triggerDownload(buffer: ArrayBuffer | Uint8Array, filename: string) {
  const blob = new Blob([buffer as any], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Batch Summary Export (BatchSummaryModal)
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchExportPayload {
  batch: {
    batchId: string;
    batchName?: string;
    samplingDate: string;
    caseType: string;
    dateFrom: string;
    dateTo: string;
    totalAvailable?: number;
    createdBy?: string;
  };
  kpi: {
    totalItems: number;
    auditedCount: number;
    completenessPercent: number;
    avgPercentage: number;
    passRate: number;
    passedCount: number;
    failedCount: number;
    noIssueCount: number;
    certainIssuesCount: number;
    inadequateCount: number;
  };
  categoryPerformance: Array<{
    contentNo: string | number;
    contentName?: string;
    totalEvaluated: number;
    naCount?: number;
    missingCount?: number;
    totalFullScore: number;
    totalSumScore: number;
    complianceRate: number;
  }>;
  items: Array<{
    an?: string;
    vn?: string;
    hn: string;
    patientName?: string;
    diagnosisName?: string;
    auditStatus?: string;
    sumScore?: number | null;
    fullScore?: number | null;
    percentage?: number | null;
    isPassed?: number | null;
    overallFinding?: string | null;
    auditorName?: string | null;
    auditDate?: string | null;
  }>;
  serviceType: 'OPD' | 'IPD';
  caseTypeLabel: string;
}

export async function exportBatchSummaryToExcel(data: BatchExportPayload) {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as typeof import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MRA System (Medical Record Audit)';
  workbook.created = new Date();

  const { batch, kpi, categoryPerformance, items, serviceType, caseTypeLabel } = data;

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 1: สรุปผลการตรวจประเมิน (Overview & KPIs)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsSummary = workbook.addWorksheet('สรุปผลการตรวจประเมิน', {
    views: [{ showGridLines: true }],
  });

  // Title Row (Merged A1:B1)
  const titleRow = wsSummary.addRow([`รายงานสรุปผลการตรวจประเมินเวชระเบียน (${serviceType})`]);
  titleRow.height = 28;
  wsSummary.mergeCells('A1:B1');
  const cellA1 = wsSummary.getCell('A1');
  cellA1.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: BLUE_NAVY_ARGB } };
  cellA1.alignment = { vertical: 'middle', horizontal: 'left' };

  // Subtitle Row (Merged A2:B2)
  const subTitleRow = wsSummary.addRow([
    `ระบบประเมินคุณภาพการบันทึกเวชระเบียน สปสช. (MRA) | รหัสชุดสุ่ม: ${batch.batchId} | ประเภท: ${caseTypeLabel}`,
  ]);
  subTitleRow.height = 20;
  wsSummary.mergeCells('A2:B2');
  const cellA2 = wsSummary.getCell('A2');
  cellA2.font = { name: FONT_NAME, size: 10, bold: false, color: { argb: PINK_ACCENT_ARGB } };
  cellA2.alignment = { vertical: 'middle', horizontal: 'left' };

  // Spacer
  const spacerRow1 = wsSummary.addRow([]);
  spacerRow1.height = 10;

  // Table Header (Row 4)
  const summaryHeaderRowIndex = 4;
  const summaryHeaderRow = wsSummary.addRow(['หัวข้อการประเมิน / ข้อมูลทั่วไป', 'ค่า / รายละเอียด']);
  summaryHeaderRow.height = 26;
  summaryHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_NAVY_ARGB } };
    cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: WHITE_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  type MetricConfig = {
    label: string;
    val: string | number;
    type: 'string' | 'int' | 'percent';
  };

  const summaryMetrics: MetricConfig[] = [
    { label: 'รหัสชุดสุ่ม', val: batch.batchId, type: 'string' },
    { label: 'ชื่อชุดสุ่ม', val: batch.batchName || batch.batchId, type: 'string' },
    { label: 'ประเภทบริการ', val: serviceType === 'IPD' ? 'ผู้ป่วยใน (IPD)' : 'ผู้ป่วยนอก (OPD/ER)', type: 'string' },
    { label: 'ประเภทเคส', val: caseTypeLabel, type: 'string' },
    { label: 'ช่วงวันที่รับบริการ', val: `${batch.dateFrom} ถึง ${batch.dateTo}`, type: 'string' },
    { label: 'วันที่สุ่มตรวจ', val: formatThaiDate(batch.samplingDate), type: 'string' },
    { label: 'ผู้ดำเนินการสุ่ม', val: batch.createdBy || 'Auditor', type: 'string' },
    { label: 'จำนวนทั้งหมดในระบบ HIS (รายการ)', val: Number(batch.totalAvailable || items.length), type: 'int' },
    { label: 'ขนาดตัวอย่างที่สุ่ม (ชาร์ต)', val: Number(kpi.totalItems), type: 'int' },
    { label: 'ตรวจประเมินแล้ว (ชาร์ต)', val: Number(kpi.auditedCount), type: 'int' },
    { label: 'ความครอบคลุมการตรวจ', val: Number((kpi.completenessPercent / 100).toFixed(4)), type: 'percent' },
    { label: 'คะแนนเฉลี่ยร้อยละ', val: Number((kpi.avgPercentage / 100).toFixed(4)), type: 'percent' },
    { label: 'อัตราผ่านเกณฑ์ขั้นต่ำ สปสช.', val: Number((kpi.passRate / 100).toFixed(4)), type: 'percent' },
    { label: 'ผ่านเกณฑ์ (ชาร์ต)', val: Number(kpi.passedCount), type: 'int' },
    { label: 'ไม่ผ่านเกณฑ์ (ชาร์ต)', val: Number(kpi.failedCount), type: 'int' },
    { label: 'ข้อสรุปภาพรวม - ไม่มีปัญหาสำคัญ (ชาร์ต)', val: Number(kpi.noIssueCount), type: 'int' },
    { label: 'ข้อสรุปภาพรวม - มีประเด็นต้องค้นต่อ (ชาร์ต)', val: Number(kpi.certainIssuesCount), type: 'int' },
    { label: 'ข้อสรุปภาพรวม - ข้อมูลไม่เพียงพอ (ชาร์ต)', val: Number(kpi.inadequateCount), type: 'int' },
  ];

  summaryMetrics.forEach((m, idx) => {
    const row = wsSummary.addRow([m.label, m.val]);
    row.height = 22;
    const isEven = idx % 2 === 1;

    // Label cell
    const cellA = row.getCell(1);
    cellA.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: 'FF334155' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LABEL_BG_ARGB } };
    cellA.border = thinBorder;
    cellA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Value cell
    const cellB = row.getCell(2);
    cellB.font = { name: FONT_NAME, size: FONT_SIZE, color: { argb: 'FF0F172A' } };
    if (isEven) {
      cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG_ARGB } };
    }
    cellB.border = thinBorder;

    if (m.type === 'int') {
      cellB.numFmt = '#,##0';
      cellB.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    } else if (m.type === 'percent') {
      cellB.numFmt = '0.0%';
      cellB.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    } else {
      cellB.numFmt = '@';
      cellB.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }
  });

  autoFitColumns(wsSummary, summaryHeaderRowIndex, { minWidths: { 1: 38, 2: 32 } });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 2: สถิติความสมบูรณ์แยกรายหมวด (Category Compliance)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsCategory = workbook.addWorksheet('สถิติความสมบูรณ์แยกรายหมวด', {
    views: [{ showGridLines: true }],
  });

  const catTitleRow = wsCategory.addRow(['สถิติความสมบูรณ์แยกรายหมวด (Category Compliance)']);
  catTitleRow.height = 28;
  wsCategory.mergeCells('A1:H1');
  const catA1 = wsCategory.getCell('A1');
  catA1.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: BLUE_NAVY_ARGB } };
  catA1.alignment = { vertical: 'middle', horizontal: 'left' };

  const spacerRow2 = wsCategory.addRow([]);
  spacerRow2.height = 10;

  const catHeaders = [
    'หมวด',
    'ชื่อหมวดการตรวจประเมิน',
    'จำนวนที่ตรวจประเมิน (เคส)',
    'NA',
    'Missing',
    'คะแนนเต็ม',
    'คะแนนที่ได้',
    'ร้อยละความสมบูรณ์ (%)',
  ];

  const catHeaderRowIndex = 3;
  const catHeaderRow = wsCategory.addRow(catHeaders);
  catHeaderRow.height = 26;
  catHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_NAVY_ARGB } };
    cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: WHITE_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  wsCategory.autoFilter = {
    from: { row: catHeaderRowIndex, column: 1 },
    to: { row: catHeaderRowIndex, column: catHeaders.length },
  };

  categoryPerformance.forEach((cat, idx) => {
    const complianceDecimal = Number((cat.complianceRate / 100).toFixed(4));
    const rowValues = [
      String(cat.contentNo),
      String(cat.contentName || ''),
      Number(cat.totalEvaluated),
      Number(cat.naCount || 0),
      Number(cat.missingCount || 0),
      Number(cat.totalFullScore),
      Number(cat.totalSumScore),
      complianceDecimal,
    ];
    const row = wsCategory.addRow(rowValues);
    row.height = 22;
    const isEven = idx % 2 === 1;

    row.eachCell((cell, colNum) => {
      cell.font = { name: FONT_NAME, size: FONT_SIZE, color: { argb: 'FF1E293B' } };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG_ARGB } };
      }
      cell.border = thinBorder;

      if (colNum === 1) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 2) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      } else if (colNum >= 3 && colNum <= 5) {
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else if (colNum === 6 || colNum === 7) {
        cell.numFmt = '#,##0.0';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else if (colNum === 8) {
        cell.numFmt = '0.0%';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      }
    });
  });

  autoFitColumns(wsCategory, catHeaderRowIndex, { minWidths: { 1: 10, 2: 28, 8: 24 } });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 3: รายชื่อชาร์ตในชุดสุ่มตรวจ (Chart Audit Details)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsCharts = workbook.addWorksheet('รายชื่อชาร์ตในชุดสุ่มตรวจ', {
    views: [{ showGridLines: true }],
  });

  const chartTitleRow = wsCharts.addRow(['รายชื่อชาร์ตในชุดสุ่มตรวจ (Chart Audit Details)']);
  chartTitleRow.height = 28;
  wsCharts.mergeCells('A1:M1');
  const chartA1 = wsCharts.getCell('A1');
  chartA1.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: BLUE_NAVY_ARGB } };
  chartA1.alignment = { vertical: 'middle', horizontal: 'left' };

  const spacerRow3 = wsCharts.addRow([]);
  spacerRow3.height = 10;

  const chartHeaders = [
    'ลำดับ',
    serviceType === 'IPD' ? 'AN' : 'VN',
    'HN',
    'ชื่อ-สกุล ผู้ป่วย',
    'การวินิจฉัย (Diagnosis)',
    'สถานะการตรวจ',
    'คะแนนที่ได้ (Sum Score)',
    'คะแนนเต็ม (Full Score)',
    'ร้อยละ (%)',
    'ผลเกณฑ์ขั้นต่ำ',
    'การประเมินภาพรวม',
    'ผู้ตรวจประเมิน',
    'วันที่ตรวจ',
  ];

  const chartHeaderRowIndex = 3;
  const chartHeaderRow = wsCharts.addRow(chartHeaders);
  chartHeaderRow.height = 26;
  chartHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_NAVY_ARGB } };
    cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: WHITE_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  wsCharts.autoFilter = {
    from: { row: chartHeaderRowIndex, column: 1 },
    to: { row: chartHeaderRowIndex, column: chartHeaders.length },
  };

  items.forEach((it, idx) => {
    const isPassedText = it.isPassed === 1 ? 'ผ่าน' : it.isPassed === 0 ? 'ไม่ผ่าน' : '-';
    const percentVal =
      it.percentage !== undefined && it.percentage !== null
        ? Number((Number(it.percentage) / 100).toFixed(4))
        : null;

    const rowValues = [
      idx + 1,
      String(serviceType === 'IPD' ? it.an || '-' : it.vn || '-'),
      String(it.hn || '-'),
      String(it.patientName || '-'),
      String(it.diagnosisName || '-'),
      it.auditStatus === 'audited' ? 'ตรวจแล้ว' : 'รอตรวจ',
      it.sumScore !== undefined && it.sumScore !== null ? Number(it.sumScore) : null,
      it.fullScore !== undefined && it.fullScore !== null ? Number(it.fullScore) : null,
      percentVal,
      isPassedText,
      formatFindingThai(it.overallFinding),
      String(it.auditorName || '-'),
      formatThaiDate(it.auditDate || ''),
    ];

    const row = wsCharts.addRow(rowValues);
    const isEven = idx % 2 === 1;

    // Dynamically adjust row height if diagnosis has line breaks
    const diagStr = String(it.diagnosisName || '');
    const lineCount = diagStr.split('\n').length;
    row.height = lineCount > 1 ? lineCount * 18 : 22;

    row.eachCell((cell, colNum) => {
      cell.font = { name: FONT_NAME, size: FONT_SIZE, color: { argb: 'FF1E293B' } };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG_ARGB } };
      }
      cell.border = thinBorder;

      if (colNum === 1) {
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 2 || colNum === 3) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 4 || colNum === 5) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
      } else if (colNum === 6) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 7 || colNum === 8) {
        if (cell.value !== null) cell.numFmt = '#,##0.0';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else if (colNum === 9) {
        if (cell.value !== null) cell.numFmt = '0.0%';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else if (colNum === 10) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (it.isPassed === 1) {
          cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: PASS_GREEN_ARGB } };
        } else if (it.isPassed === 0) {
          cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: FAIL_ROSE_ARGB } };
        }
      } else if (colNum === 11 || colNum === 12) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      } else if (colNum === 13) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });

  autoFitColumns(wsCharts, chartHeaderRowIndex, { minWidths: { 1: 10, 2: 14, 3: 12, 4: 20, 5: 32 } });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, `MRA_${serviceType}_Summary_${batch.batchId}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Executive Report Export (reports/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutiveReportPayload {
  kpi: {
    totalAudited: number;
    avgPercentage: number;
    passedCount: number;
    failedCount: number;
    passRate: number;
    noIssueCount: number;
    certainIssuesCount: number;
    inadequateCount: number;
  };
  categoryPerformance: Array<{
    serviceType: string;
    contentNo: string | number;
    contentName?: string;
    totalEvaluations: number;
    naCount?: number;
    missingCount?: number;
    totalFullScore: number;
    totalSumScore: number;
    complianceRate: number;
  }>;
  monthlySummary: Array<{
    auditMonth: string;
    serviceType: string;
    caseType?: string;
    isPsychiatric?: number;
    totalAudited: number;
    avgPercentage: number;
    passRate: number;
    passedCount: number;
    failedCount: number;
  }>;
  sourceAudits: Array<{
    serviceType: string;
    auditId: string | number;
    visitNumber: string;
    hn: string;
    patientName?: string;
    caseType?: string;
    isPsychiatric?: number;
    diagnosis?: string;
    sumScore: number;
    fullScore: number;
    percentage: number;
    isPassed?: number;
    overallFinding?: string;
    auditorName?: string;
    auditDate?: string;
  }>;
  monthFilter: string;
  monthLabel: string;
  serviceFilterLabel: string;
}

export async function exportExecutiveReportToExcel(data: ExecutiveReportPayload) {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as typeof import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MRA System (Medical Record Audit)';
  workbook.created = new Date();

  const {
    kpi,
    categoryPerformance,
    monthlySummary,
    sourceAudits,
    monthFilter,
    monthLabel,
    serviceFilterLabel,
  } = data;

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 1: สรุปภาพรวมและตัวชี้วัด (Executive Summary)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsSummary = workbook.addWorksheet('สรุปภาพรวมและตัวชี้วัด', {
    views: [{ showGridLines: true }],
  });

  const titleRow = wsSummary.addRow(['รายงานและสถิติการประเมินคุณภาพเวชระเบียน (Executive Dashboard)']);
  titleRow.height = 28;
  wsSummary.mergeCells('A1:B1');
  const cellA1 = wsSummary.getCell('A1');
  cellA1.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: BLUE_NAVY_ARGB } };
  cellA1.alignment = { vertical: 'middle', horizontal: 'left' };

  const subTitle = wsSummary.addRow([
    `ระบบประเมินคุณภาพเวชระเบียน (MRA) | งวดข้อมูล: ${monthLabel} | บริการ: ${serviceFilterLabel}`,
  ]);
  subTitle.height = 20;
  wsSummary.mergeCells('A2:B2');
  const cellA2 = wsSummary.getCell('A2');
  cellA2.font = { name: FONT_NAME, size: 10, bold: false, color: { argb: PINK_ACCENT_ARGB } };
  cellA2.alignment = { vertical: 'middle', horizontal: 'left' };

  const spacerRow1 = wsSummary.addRow([]);
  spacerRow1.height = 10;

  const summaryHeaderRowIndex = 4;
  const summaryHeaderRow = wsSummary.addRow(['ตัวชี้วัดและสถิติหลัก (Key Performance Indicators)', 'ค่าสถิติ']);
  summaryHeaderRow.height = 26;
  summaryHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_NAVY_ARGB } };
    cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: WHITE_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  type ExecMetric = {
    label: string;
    val: string | number;
    type: 'string' | 'int' | 'percent';
  };

  const summaryMetrics: ExecMetric[] = [
    { label: 'งวดข้อมูลที่เลือก', val: monthLabel, type: 'string' },
    { label: 'ประเภทบริการ', val: serviceFilterLabel, type: 'string' },
    { label: 'จำนวนเวชระเบียนที่ตรวจประเมินแล้วทั้งหมด (ชาร์ต)', val: Number(kpi.totalAudited), type: 'int' },
    { label: 'คะแนนความสมบูรณ์เฉลี่ยรวมทุกชาร์ต', val: Number((kpi.avgPercentage / 100).toFixed(4)), type: 'percent' },
    { label: 'อัตราผ่านเกณฑ์ประเมินขั้นต่ำ สปสช.', val: Number((kpi.passRate / 100).toFixed(4)), type: 'percent' },
    { label: 'จำนวนที่ผ่านเกณฑ์ (ชาร์ต)', val: Number(kpi.passedCount), type: 'int' },
    { label: 'จำนวนที่ไม่ผ่านเกณฑ์ (ชาร์ต)', val: Number(kpi.failedCount), type: 'int' },
    { label: 'ข้อสรุปภาพรวม - เอกสารสมบูรณ์ไม่มีปัญหาสำคัญ (ชาร์ต)', val: Number(kpi.noIssueCount), type: 'int' },
    { label: 'ข้อสรุปภาพรวม - มีประเด็นข้อสงสัยที่ต้องสืบค้นต่อ (ชาร์ต)', val: Number(kpi.certainIssuesCount), type: 'int' },
    { label: 'ข้อสรุปภาพรวม - เอกสารไม่เพียงพอในการประเมิน (ชาร์ต)', val: Number(kpi.inadequateCount), type: 'int' },
    { label: 'วันที่ออกรายงาน', val: formatThaiDate(new Date().toISOString()), type: 'string' },
  ];

  summaryMetrics.forEach((m, idx) => {
    const row = wsSummary.addRow([m.label, m.val]);
    row.height = 22;
    const isEven = idx % 2 === 1;

    const cellA = row.getCell(1);
    cellA.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: 'FF334155' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LABEL_BG_ARGB } };
    cellA.border = thinBorder;
    cellA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const cellB = row.getCell(2);
    cellB.font = { name: FONT_NAME, size: FONT_SIZE, color: { argb: 'FF0F172A' } };
    if (isEven) {
      cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG_ARGB } };
    }
    cellB.border = thinBorder;

    if (m.type === 'int') {
      cellB.numFmt = '#,##0';
      cellB.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    } else if (m.type === 'percent') {
      cellB.numFmt = '0.0%';
      cellB.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    } else {
      cellB.numFmt = '@';
      cellB.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }
  });

  autoFitColumns(wsSummary, summaryHeaderRowIndex, { minWidths: { 1: 42, 2: 32 } });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 2: สถิติความสมบูรณ์แยกรายหมวด (Category Compliance)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsCat = workbook.addWorksheet('สถิติความสมบูรณ์แยกรายหมวด', {
    views: [{ showGridLines: true }],
  });
  const catTitle = wsCat.addRow(['สถิติความสมบูรณ์แยกรายหมวด (Category Compliance)']);
  catTitle.height = 28;
  wsCat.mergeCells('A1:I1');
  const catA1 = wsCat.getCell('A1');
  catA1.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: BLUE_NAVY_ARGB } };
  catA1.alignment = { vertical: 'middle', horizontal: 'left' };

  const spacerCat = wsCat.addRow([]);
  spacerCat.height = 10;

  const catHeaders = [
    'บริการ',
    'หมวด',
    'ชื่อหมวดการตรวจประเมิน',
    'จำนวนที่ตรวจประเมิน (เคส)',
    'NA',
    'Missing',
    'คะแนนเต็ม',
    'คะแนนที่ได้',
    'ร้อยละความสมบูรณ์ (%)',
  ];
  const catHeaderRowIndex = 3;
  const catHeaderRow = wsCat.addRow(catHeaders);
  catHeaderRow.height = 26;
  catHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_NAVY_ARGB } };
    cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: WHITE_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  wsCat.autoFilter = {
    from: { row: catHeaderRowIndex, column: 1 },
    to: { row: catHeaderRowIndex, column: catHeaders.length },
  };

  categoryPerformance.forEach((c, idx) => {
    const complianceDecimal = Number((c.complianceRate / 100).toFixed(4));
    const rowValues = [
      String(c.serviceType),
      String(c.contentNo),
      String(c.contentName || ''),
      Number(c.totalEvaluations),
      Number(c.naCount || 0),
      Number(c.missingCount || 0),
      Number(c.totalFullScore),
      Number(c.totalSumScore),
      complianceDecimal,
    ];
    const row = wsCat.addRow(rowValues);
    row.height = 22;
    const isEven = idx % 2 === 1;

    row.eachCell((cell, colNum) => {
      cell.font = { name: FONT_NAME, size: FONT_SIZE, color: { argb: 'FF1E293B' } };
      if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG_ARGB } };
      cell.border = thinBorder;

      if (colNum <= 2) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 3) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      } else if (colNum >= 4 && colNum <= 6) {
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else if (colNum === 7 || colNum === 8) {
        cell.numFmt = '#,##0.0';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else if (colNum === 9) {
        cell.numFmt = '0.0%';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      }
    });
  });
  autoFitColumns(wsCat, catHeaderRowIndex, { minWidths: { 1: 12, 2: 10, 3: 28, 9: 24 } });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 3: สถิติตามงวดเดือน (Monthly Trend Summary)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsMonth = workbook.addWorksheet('สถิติตามงวดเดือน', {
    views: [{ showGridLines: true }],
  });
  const monthTitle = wsMonth.addRow(['สถิติการประเมินแยกตามงวดเดือน (Monthly Trend Summary)']);
  monthTitle.height = 28;
  wsMonth.mergeCells('A1:G1');
  const monthA1 = wsMonth.getCell('A1');
  monthA1.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: BLUE_NAVY_ARGB } };
  monthA1.alignment = { vertical: 'middle', horizontal: 'left' };

  const spacerMonth = wsMonth.addRow([]);
  spacerMonth.height = 10;

  const monthHeaders = [
    'งวดเดือน',
    'บริการ',
    'จำนวนที่ตรวจประเมิน (เคส)',
    'คะแนนเฉลี่ย (%)',
    'อัตราผ่านเกณฑ์ (%)',
    'ผ่านเกณฑ์ (เคส)',
    'ไม่ผ่านเกณฑ์ (เคส)',
  ];
  const monthHeaderRowIndex = 3;
  const monthHeaderRow = wsMonth.addRow(monthHeaders);
  monthHeaderRow.height = 26;
  monthHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_NAVY_ARGB } };
    cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: WHITE_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  wsMonth.autoFilter = {
    from: { row: monthHeaderRowIndex, column: 1 },
    to: { row: monthHeaderRowIndex, column: monthHeaders.length },
  };

  monthlySummary.forEach((m, idx) => {
    const avgDecimal = Number((m.avgPercentage / 100).toFixed(4));
    const passRateDecimal = Number((m.passRate / 100).toFixed(4));

    const rowValues = [
      String(m.auditMonth),
      String(m.serviceType),
      Number(m.totalAudited),
      avgDecimal,
      passRateDecimal,
      Number(m.passedCount),
      Number(m.failedCount),
    ];
    const row = wsMonth.addRow(rowValues);
    row.height = 22;
    const isEven = idx % 2 === 1;

    row.eachCell((cell, colNum) => {
      cell.font = { name: FONT_NAME, size: FONT_SIZE, color: { argb: 'FF1E293B' } };
      if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG_ARGB } };
      cell.border = thinBorder;

      if (colNum <= 2) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 3) {
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else if (colNum === 4 || colNum === 5) {
        cell.numFmt = '0.0%';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else {
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      }
    });
  });
  autoFitColumns(wsMonth, monthHeaderRowIndex, { minWidths: { 1: 16, 2: 12, 3: 24, 4: 18, 5: 20 } });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sheet 4: รายละเอียดการตรวจประเมิน (Chart Audit Records)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsAudits = workbook.addWorksheet('รายละเอียดการตรวจประเมิน', {
    views: [{ showGridLines: true }],
  });
  const auditTitle = wsAudits.addRow(['รายละเอียดผลการตรวจประเมินเวชระเบียน (Chart Audit Records)']);
  auditTitle.height = 28;
  wsAudits.mergeCells('A1:N1');
  const auditA1 = wsAudits.getCell('A1');
  auditA1.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: BLUE_NAVY_ARGB } };
  auditA1.alignment = { vertical: 'middle', horizontal: 'left' };

  const spacerAudit = wsAudits.addRow([]);
  spacerAudit.height = 10;

  const auditHeaders = [
    'ลำดับ',
    'บริการ',
    'รหัสการตรวจ (Audit ID)',
    'VN / AN',
    'HN',
    'ชื่อ-สกุล ผู้ป่วย',
    'การวินิจฉัย (Diagnosis)',
    'คะแนนที่ได้',
    'คะแนนเต็ม',
    'ร้อยละ (%)',
    'ผลเกณฑ์ขั้นต่ำ',
    'การประเมินภาพรวม',
    'ผู้ตรวจประเมิน',
    'วันที่ตรวจ',
  ];
  const auditHeaderRowIndex = 3;
  const auditHeaderRow = wsAudits.addRow(auditHeaders);
  auditHeaderRow.height = 26;
  auditHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_NAVY_ARGB } };
    cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: WHITE_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  wsAudits.autoFilter = {
    from: { row: auditHeaderRowIndex, column: 1 },
    to: { row: auditHeaderRowIndex, column: auditHeaders.length },
  };

  sourceAudits.forEach((a, idx) => {
    const isPassedText = a.isPassed === 1 ? 'ผ่าน' : 'ไม่ผ่าน';
    const percentVal = Number((Number(a.percentage) / 100).toFixed(4));

    const rowValues = [
      idx + 1,
      String(a.serviceType),
      String(a.auditId),
      String(a.visitNumber),
      String(a.hn),
      String(a.patientName || '-'),
      String(a.diagnosis || '-'),
      Number(a.sumScore),
      Number(a.fullScore),
      percentVal,
      isPassedText,
      formatFindingThai(a.overallFinding),
      String(a.auditorName || '-'),
      formatThaiDate(a.auditDate),
    ];
    const row = wsAudits.addRow(rowValues);
    const isEven = idx % 2 === 1;

    // Adjust row height if diagnosis is multi-line
    const diagStr = String(a.diagnosis || '');
    const lineCount = diagStr.split('\n').length;
    row.height = lineCount > 1 ? lineCount * 18 : 22;

    row.eachCell((cell, colNum) => {
      cell.font = { name: FONT_NAME, size: FONT_SIZE, color: { argb: 'FF1E293B' } };
      if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG_ARGB } };
      cell.border = thinBorder;

      if (colNum === 1) {
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum >= 2 && colNum <= 5) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 6 || colNum === 7) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
      } else if (colNum === 8 || colNum === 9) {
        cell.numFmt = '#,##0.0';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else if (colNum === 10) {
        cell.numFmt = '0.0%';
        cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else if (colNum === 11) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (a.isPassed === 1) {
          cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: PASS_GREEN_ARGB } };
        } else {
          cell.font = { name: FONT_NAME, size: FONT_SIZE, bold: true, color: { argb: FAIL_ROSE_ARGB } };
        }
      } else if (colNum === 12 || colNum === 13) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      } else if (colNum === 14) {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });
  autoFitColumns(wsAudits, auditHeaderRowIndex, {
    minWidths: { 1: 10, 2: 12, 3: 14, 4: 14, 5: 12, 6: 20, 7: 32 },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    buffer,
    `MRA_Executive_Report_${monthFilter !== 'ALL' ? monthFilter : 'Overall'}_${new Date().toISOString().split('T')[0]}.xlsx`
  );
}
