'use client';

import { apiUrl } from '@/lib/constants';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Hospital,
  BedDouble,
  Brain,
  Calendar,
  Filter,
  Layers,
  Sparkles,
  Flame,
  Stethoscope,
  LayoutDashboard,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUnifiedAuditStore } from '@/store/useUnifiedAuditStore';
import { useIpdAuditStore } from '@/store/useIpdAuditStore';
import { SearchableSelect, SearchableOption } from '@/components/ui/SearchableSelect';
import { exportExecutiveReportToExcel } from '@/lib/excelExport';
import { alertWarning } from '@/lib/mra-alert';

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function formatThaiMonthYear(monthStr?: string): string {
  if (!monthStr || monthStr === 'ALL') return 'สะสมทุกเดือน';
  try {
    const [yStr, mStr] = monthStr.split('-');
    if (!yStr || !mStr) return monthStr;
    const yearNum = parseInt(yStr, 10);
    const monthNum = parseInt(mStr, 10);
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) return monthStr;
    const thaiYear = yearNum > 2400 ? yearNum : yearNum + 543;
    const thaiMonth = THAI_MONTH_NAMES[monthNum - 1];
    return `${thaiMonth} ${thaiYear}`;
  } catch {
    return monthStr;
  }
}

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

function formatFindingThai(finding?: string): string {
  if (finding === 'no_issue') return 'ไม่มีปัญหาสำคัญ';
  if (finding === 'certain_issues') return 'มีประเด็นต้องค้นต่อ';
  if (finding === 'inadequate') return 'ข้อมูลไม่เพียงพอ';
  if (finding === 'order_not_standard') return 'จัดเรียงไม่ตามเกณฑ์';
  if (finding === 'missing_patient_identifiers') return 'เอกสารขาดชื่อ/HN/AN';
  return finding || '-';
}

function formatCaseTypeReportThai(caseType?: string, isPsychiatric?: number): string {
  if (isPsychiatric === 1 || caseType === 'psychiatric') return 'จิตเวช';
  if (caseType === 'er') return 'อุบัติเหตุ-ฉุกเฉิน';
  if (caseType === 'chronic') return 'โรคเรื้อรัง';
  if (caseType === 'general') return 'โรคทั่วไป';
  if (caseType === 'medical') return 'อายุรกรรม';
  if (caseType === 'surgical') return 'ศัลยกรรม';
  if (caseType === 'pediatric') return 'กุมารเวชกรรม';
  if (caseType === 'obgyn') return 'สูติ-นรีเวชกรรม';
  return caseType || 'ทั่วไป';
}

function formatServiceFilterThai(filter: string): string {
  switch (filter) {
    case 'OPD': return 'ผู้ป่วยนอก (OPD)';
    case 'ER': return 'อุบัติเหตุ-ฉุกเฉิน (ER)';
    case 'IPD': return 'ผู้ป่วยใน (IPD)';
    case 'PSYCHIATRIC': return 'จิตเวช (PSY)';
    case 'CHRONIC': return 'โรคเรื้อรัง (Chronic)';
    case 'ALL':
    default:
      return 'บริการทั้งหมด';
  }
}

interface ReportKPI {
  totalAudited: number;
  avgPercentage: number;
  passedCount: number;
  failedCount: number;
  passRate: number;
  inadequateCount: number;
  certainIssuesCount: number;
  noIssueCount: number;
}

interface MonthlySummaryItem {
  serviceType: string;
  caseType: string;
  isPsychiatric: number;
  auditMonth: string;
  totalAudited: number;
  avgPercentage: number;
  passedCount: number;
  failedCount: number;
  passRate: number;
  inadequateCount: number;
  certainIssuesCount: number;
  noIssueCount: number;
}

interface CategoryPerfItem {
  serviceType: string;
  contentNo: number;
  contentName: string;
  totalEvaluations: number;
  naCount: number;
  missingCount: number;
  totalFullScore: number;
  totalSumScore: number;
  complianceRate: number;
}

interface RecentAuditItem {
  serviceType: string;
  auditId: string;
  visitNumber: string;
  hn: string;
  patientName: string;
  caseType: string;
  isPsychiatric?: number;
  diagnosis: string;
  sumScore: number;
  fullScore: number;
  percentage: number;
  isPassed: number;
  overallFinding: string;
  auditorName: string;
  auditDate: string;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [serviceFilter, setServiceFilter] = useState<'ALL' | 'OPD' | 'ER' | 'IPD' | 'PSYCHIATRIC' | 'CHRONIC'>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [caseTypeFilter, setCaseTypeFilter] = useState<'ALL' | 'general' | 'chronic' | 'psychiatric'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [kpi, setKpi] = useState<ReportKPI>({
    totalAudited: 0,
    avgPercentage: 0,
    passedCount: 0,
    failedCount: 0,
    passRate: 0,
    inadequateCount: 0,
    certainIssuesCount: 0,
    noIssueCount: 0,
  });
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryItem[]>([]);
  const [categoryPerformance, setCategoryPerformance] = useState<CategoryPerfItem[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [recentAudits, setRecentAudits] = useState<RecentAuditItem[]>([]);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (serviceFilter !== 'ALL') params.append('serviceType', serviceFilter);
      if (monthFilter !== 'ALL') params.append('month', monthFilter);
      if (caseTypeFilter !== 'ALL') params.append('caseType', caseTypeFilter);

      const res = await fetch(apiUrl(`/api/mra/reports?${params.toString()}`));
      const json = await res.json();

      if (json.success && json.data) {
        setKpi(json.data.kpi);
        setMonthlySummary(json.data.monthlySummary || []);
        setCategoryPerformance(json.data.categoryPerformance || []);
        setAvailableMonths(json.data.availableMonths || []);
        setRecentAudits(json.data.recentAudits || []);
      } else {
        setError(json.error || 'ไม่สามารถโหลดข้อมูลรายงานได้');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [serviceFilter, monthFilter, caseTypeFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('unauthorized') === 'settings') {
        alertWarning('ไม่มีสิทธิ์เข้าถึง', 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถเข้าถึงหน้าตั้งค่าระบบได้');
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  const router = useRouter();
  const [openingAuditId, setOpeningAuditId] = useState<string | null>(null);

  const handleOpenAudit = async (a: RecentAuditItem) => {
    try {
      setOpeningAuditId(a.auditId);
      if (a.serviceType === 'IPD') {
        const isPsy = a.isPsychiatric === 1 || a.caseType === 'psychiatric';
        useIpdAuditStore.getState().loadSampledIpdVisit({
          an: a.visitNumber,
          hn: a.hn,
          patientName: a.patientName,
          diagnosis: a.diagnosis,
          caseType: isPsy ? 'psychiatric' : 'general',
        });
        await useIpdAuditStore.getState().loadExistingIpdAudit(a.visitNumber);
        router.push(`/ipd?an=${encodeURIComponent(a.visitNumber)}`);
      } else {
        const isItemChronic = a.caseType === 'chronic';
        const isItemPsy = a.isPsychiatric === 1 || a.caseType === 'psychiatric';
        useUnifiedAuditStore.getState().loadSampledVisit({
          vn: a.visitNumber,
          hn: a.hn,
          patientName: a.patientName,
          diagnosis: a.diagnosis,
          caseType: isItemChronic ? 'chronic' : 'general',
          isPsychiatric: Boolean(isItemPsy),
          vstdate: a.auditDate,
        });
        await useUnifiedAuditStore.getState().loadExistingAudit(a.visitNumber);
        router.push(`/?vn=${encodeURIComponent(a.visitNumber)}`);
      }
    } catch (err) {
      console.error('Error opening audit record:', err);
    } finally {
      setOpeningAuditId(null);
    }
  };

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if ((kpi.totalAudited === 0 && recentAudits.length === 0) || exporting) return;
    try {
      setExporting(true);
      const sourceAudits = filteredAudits.length > 0 ? filteredAudits : recentAudits;
      await exportExecutiveReportToExcel({
        kpi,
        categoryPerformance,
        monthlySummary,
        sourceAudits,
        monthFilter,
        monthLabel: formatThaiMonthYear(monthFilter),
        serviceFilterLabel: formatServiceFilterThai(serviceFilter),
      });
    } catch (err) {
      console.error('Export Data failed:', err);
      alert('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    } finally {
      setExporting(false);
    }
  };

  // Month options for SearchableSelect
  const monthOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [
      { value: 'ALL', label: 'สะสมทุกเดือน' },
    ];
    for (const m of availableMonths) {
      list.push({
        value: m,
        label: formatThaiMonthYear(m),
      });
    }
    return list;
  }, [availableMonths]);

  // Filtered recent audits
  const filteredAudits = recentAudits.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.hn.toLowerCase().includes(q) ||
      a.visitNumber.toLowerCase().includes(q) ||
      (a.patientName && a.patientName.toLowerCase().includes(q)) ||
      (a.diagnosis && a.diagnosis.toLowerCase().includes(q)) ||
      (a.auditorName && a.auditorName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="section-gap space-y-4">
      {/* ── 1. Top Header ── */}
      <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-sm bg-blue-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-blue-950">
              รายงานและสถิติการประเมินคุณภาพเวชระเบียน
            </h1>
            <p className="text-xs text-slate-500">
              Executive Reports
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchReports}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-sm transition-colors cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || (kpi.totalAudited === 0 && recentAudits.length === 0)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-sm transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            title="ส่งออกรายงานเป็น Excel แยกชีทพร้อมจัดรูปแบบตารางมาตรฐาน"
          >
            <FileSpreadsheet size={14} className="text-white" />
            <span>{exporting ? 'กำลังส่งออก...' : 'ส่งออกข้อมูล'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Filter Bar with Comprehensive Hospital Services ── */}
      <div className="bg-white p-3 rounded-sm border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Service Type Pills — Comprehensive for Hospital MRA */}
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-slate-500 font-semibold flex items-center gap-1 mr-1">
            <Filter size={13} />
            <span>ประเภทบริการ</span>
          </span>
          {(
            [
              { id: 'ALL', label: 'ทั้งหมด' },
              { id: 'OPD', label: 'OPD' },
              { id: 'ER', label: 'ER' },
              { id: 'IPD', label: 'IPD' },
              { id: 'PSYCHIATRIC', label: 'PSY' },
              { id: 'CHRONIC', label: 'Chronic' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceFilter(s.id)}
              className={`px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors cursor-pointer ${serviceFilter === s.id
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Month Selector using SearchableSelect */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-slate-500 font-semibold flex items-center gap-1 shrink-0">
            <Calendar size={13} />
            <span>งวดเดือน</span>
          </span>
          <div className="w-[180px] shrink-0">
            <SearchableSelect
              options={monthOptions}
              value={monthFilter}
              onChange={(val) => setMonthFilter(val || 'ALL')}
              placeholder="เลือกงวดเดือน"
              searchPlaceholder="ค้นหางวดเดือน..."
              triggerClassName="h-7 text-xs px-2.5 py-0.5 border-slate-300"
              matchTriggerWidth={true}
            />
          </div>
        </div>
      </div>

      {/* ── 3. High-Level KPI Cards Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Audited */}
        <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">จำนวนที่ประเมินแล้ว</span>
            <Layers size={17} className="text-blue-700" />
          </div>
          <div className="text-3xl font-black text-blue-950">
            {kpi.totalAudited.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-400">ชาร์ต</span>
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            บันทึกครบถ้วนตามแบบประเมิน สปสช.
          </p>
        </div>

        {/* Average Compliance Score */}
        <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">คะแนนเฉลี่ยร้อยละ</span>
            <TrendingUp size={17} className="text-pink-600" />
          </div>
          <div
            className={`text-3xl font-black ${kpi.avgPercentage >= 80
              ? 'text-emerald-700'
              : kpi.avgPercentage >= 60
                ? 'text-amber-700'
                : 'text-rose-700'
              }`}
          >
            {kpi.avgPercentage}%
          </div>
          <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
            <span>เกณฑ์ความสมบูรณ์</span>
            <span
              className={`font-bold ${kpi.avgPercentage >= 80
                ? 'text-emerald-700'
                : kpi.avgPercentage >= 60
                  ? 'text-amber-700'
                  : 'text-rose-700'
                }`}
            >
              {kpi.avgPercentage >= 80
                ? 'ระดับดีเยี่ยม'
                : kpi.avgPercentage >= 60
                  ? 'ยอมรับได้'
                  : 'ต่ำกว่าเกณฑ์'}
            </span>
          </div>
        </div>

        {/* Pass Rate */}
        <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">อัตราผ่านเกณฑ์ขั้นต่ำ</span>
            <ArrowUpDown size={17} className="text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-700">
            {kpi.passRate}%
          </div>
          <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
            <span>
              ผ่าน <strong className="text-emerald-700">{kpi.passedCount}</strong>
            </span>
            <span>
              ไม่ผ่าน <strong className="text-rose-600">{kpi.failedCount}</strong>
            </span>
          </div>
        </div>

        {/* Findings Distribution */}
        <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-slate-500 block mb-1">
            ข้อสรุปภาพรวม (Findings)
          </span>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between items-center bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-sm">
              <span>ไม่มีปัญหาสำคัญ</span>
              <span className="font-bold">{kpi.noIssueCount}</span>
            </div>
            <div className="flex justify-between items-center bg-amber-50 text-amber-800 px-2 py-0.5 rounded-sm">
              <span>มีประเด็นต้องค้นต่อ</span>
              <span className="font-bold">{kpi.certainIssuesCount}</span>
            </div>
            <div className="flex justify-between items-center bg-rose-50 text-rose-800 px-2 py-0.5 rounded-sm">
              <span>ข้อมูลไม่เพียงพอ</span>
              <span className="font-bold">{kpi.inadequateCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Defect Analysis & Category Performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Compliance Table */}
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50/80 border-b border-slate-200 py-3 px-4">
            <CardTitle className="text-xs font-bold text-blue-950 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BarChart3 size={15} className="text-pink-600" />
                <span>ความสมบูรณ์แยกรายหมวด (ชี้เป้าจุดบกพร่องที่พบบ่อย)</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="table-responsive overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr className="text-slate-700 font-semibold border-b border-slate-200">
                    <th className="p-2 w-12 text-center border-r border-slate-200">หมวด</th>
                    <th className="p-2 border-r border-slate-200">ชื่อหมวดการประเมิน</th>
                    <th className="p-2 text-center w-16 border-r border-slate-200">บริการ</th>
                    <th className="p-2 text-center w-16 border-r border-slate-200">Missing</th>
                    <th className="p-2 text-center w-28">ร้อยละความสมบูรณ์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {categoryPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        {loading ? 'กำลังโหลดข้อมูล...' : 'ยังไม่มีข้อมูลการประเมินตามเงื่อนไขที่เลือก'}
                      </td>
                    </tr>
                  ) : (
                    categoryPerformance.map((cat, idx) => (
                      <tr key={`${cat.serviceType}-${cat.contentNo}-${idx}`} className="hover:bg-slate-50">
                        <td className="p-2 text-center font-bold text-slate-600 border-r border-slate-200">
                          {cat.contentNo}
                        </td>
                        <td className="p-2 font-medium text-slate-900 border-r border-slate-200 truncate max-w-[200px]" title={cat.contentName}>
                          {cat.contentName}
                        </td>
                        <td className="p-1.5 text-center border-r border-slate-200 font-bold text-[10px] w-16">
                          <span
                            className={`w-full block text-center py-0.5 rounded-sm font-semibold border ${cat.serviceType === 'OPD'
                              ? 'text-pink-700 bg-pink-50 border-pink-200'
                              : 'text-blue-700 bg-blue-50 border-blue-200'
                              }`}
                          >
                            {cat.serviceType}
                          </span>
                        </td>
                        <td className="p-2 text-center font-bold text-rose-600 border-r border-slate-200">
                          {cat.missingCount || 0}
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${cat.complianceRate >= 80
                                  ? 'bg-emerald-600'
                                  : cat.complianceRate >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                  }`}
                                style={{ width: `${Math.min(cat.complianceRate, 100)}%` }}
                              ></div>
                            </div>
                            <span
                              className={`font-bold text-[11px] w-10 text-right ${cat.complianceRate >= 80
                                ? 'text-emerald-700'
                                : cat.complianceRate >= 60
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                                }`}
                            >
                              {cat.complianceRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend Table */}
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50/80 border-b border-slate-200 py-3 px-4">
            <CardTitle className="text-xs font-bold text-blue-950 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar size={15} className="text-blue-700" />
                <span>สถิติการประเมินแยกตามงวดเดือน (Monthly Trend)</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="table-responsive overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr className="text-slate-700 font-semibold border-b border-slate-200">
                    <th className="p-2 border-r border-slate-200">งวดเดือน</th>
                    <th className="p-2 text-center w-16 border-r border-slate-200">บริการ</th>
                    <th className="p-2 text-center w-16 border-r border-slate-200">ตรวจแล้ว</th>
                    <th className="p-2 text-center w-20 border-r border-slate-200">คะแนนเฉลี่ย</th>
                    <th className="p-2 text-center w-20 border-r border-slate-200">อัตราผ่าน</th>
                    <th className="p-2 text-center">ภาพรวม (ผ่าน/ไม่ผ่าน)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {monthlySummary.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        {loading ? 'กำลังโหลดข้อมูล...' : 'ยังไม่มีข้อมูลสรุปรายงวดเดือน'}
                      </td>
                    </tr>
                  ) : (
                    monthlySummary.map((m, idx) => (
                      <tr key={`${m.auditMonth}-${m.serviceType}-${m.caseType}-${idx}`} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-800 border-r border-slate-200">
                          {formatThaiMonthYear(m.auditMonth)}
                        </td>
                        <td className="p-1.5 text-center border-r border-slate-200 w-16">
                          <span
                            className={`w-full block text-center py-0.5 rounded-sm text-[10px] font-bold border ${m.caseType === 'er'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : m.caseType === 'chronic'
                                ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                                : m.isPsychiatric === 1 || m.caseType === 'psychiatric'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : m.serviceType === 'OPD'
                                    ? 'bg-pink-50 text-pink-700 border-pink-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                          >
                            {m.caseType === 'er'
                              ? 'ER'
                              : m.caseType === 'chronic'
                                ? 'Chronic'
                                : m.isPsychiatric === 1 || m.caseType === 'psychiatric'
                                  ? 'PSY'
                                  : m.serviceType}
                          </span>
                        </td>
                        <td className="p-2 text-center font-semibold text-slate-700 border-r border-slate-200">
                          {m.totalAudited}
                        </td>
                        <td className="p-2 text-center font-bold text-blue-900 border-r border-slate-200">
                          {m.avgPercentage}%
                        </td>
                        <td className="p-2 text-center font-bold text-emerald-700 border-r border-slate-200">
                          {m.passRate}%
                        </td>
                        <td className="p-2 text-center text-[11px]">
                          <span className="text-emerald-700 font-bold">{m.passedCount}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-rose-600 font-bold">{m.failedCount}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 5. Recent Audited Charts Table with Search ── */}
      <Card className="border-slate-200">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200 py-3 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <CardTitle className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>เวชระเบียนที่ตรวจประเมินล่าสุด ({filteredAudits.length} รายการ)</span>
              </CardTitle>
            </div>

            <div className="relative min-w-[220px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาข้อมูล..."
                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ล้าง
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-responsive overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="p-2.5 text-center w-16 min-w-[64px] border-r border-slate-200">บริการ</th>
                  <th className="p-2.5 border-r border-slate-200">VN / AN</th>
                  <th className="p-2.5 border-r border-slate-200">HN</th>
                  <th className="p-2.5 border-r border-slate-200">ชื่อ-สกุล ผู้ป่วย</th>
                  <th className="p-2.5 text-center w-24 min-w-[85px] border-r border-slate-200">ประเภทโรค</th>
                  <th className="p-2.5 border-r border-slate-200">การวินิจฉัย (Diagnosis)</th>
                  <th className="p-2.5 text-center w-24 border-r border-slate-200">คะแนน (ได้/เต็ม)</th>
                  <th className="p-2.5 text-center w-20 border-r border-slate-200">ร้อยละ</th>
                  <th className="p-2.5 text-center w-20 min-w-[70px] border-r border-slate-200">ผลประเมิน</th>
                  <th className="p-2.5 text-center w-32 min-w-[120px] border-r border-slate-200">ภาพรวม</th>
                  <th className="p-2.5 border-r border-slate-200">ผู้ตรวจประเมิน</th>
                  <th className="p-2.5 border-r border-slate-200">วันที่ตรวจ</th>
                  <th className="p-2.5 text-center w-24 min-w-[95px]">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAudits.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-400">
                      {loading ? 'กำลังโหลดข้อมูล...' : 'ยังไม่มีข้อมูลเวชระเบียนที่ได้รับการตรวจประเมิน'}
                    </td>
                  </tr>
                ) : (
                  filteredAudits.map((a) => (
                    <tr key={`${a.serviceType}-${a.auditId}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-1.5 text-center font-bold border-r border-slate-200 w-16">
                        <span
                          className={`w-full block text-center py-0.5 rounded-sm text-[10px] font-bold border ${a.caseType === 'er'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : a.caseType === 'chronic'
                              ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                              : a.isPsychiatric === 1 || a.caseType === 'psychiatric'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : a.serviceType === 'OPD'
                                  ? 'bg-pink-50 text-pink-700 border-pink-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                        >
                          {a.caseType === 'er'
                            ? 'ER'
                            : a.caseType === 'chronic'
                              ? 'Chronic'
                              : a.isPsychiatric === 1 || a.caseType === 'psychiatric'
                                ? 'PSY'
                                : a.serviceType}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold border-r border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleOpenAudit(a)}
                          disabled={openingAuditId === a.auditId}
                          className="font-bold text-blue-900 hover:text-pink-600 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors text-left disabled:opacity-50"
                          title="คลิกเพื่อเปิดดูและแก้ไขผลการตรวจประเมินของเคสนี้"
                        >
                          <span>{a.visitNumber}</span>
                          <ExternalLink size={11} className="opacity-60 shrink-0" />
                        </button>
                      </td>
                      <td className="p-2.5 text-slate-700 border-r border-slate-200">{a.hn}</td>
                      <td className="p-2.5 font-medium text-slate-900 border-r border-slate-200">
                        {a.patientName}
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-200 w-24">
                        <span
                          className={`w-full block text-center py-0.5 rounded-sm text-[10px] font-semibold border ${a.caseType === 'er'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : a.caseType === 'chronic'
                              ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                              : a.isPsychiatric === 1 || a.caseType === 'psychiatric'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                        >
                          {a.caseType === 'er'
                            ? 'อุบัติเหตุ-ฉุกเฉิน'
                            : a.caseType === 'chronic'
                              ? 'โรคเรื้อรัง'
                              : a.isPsychiatric === 1 || a.caseType === 'psychiatric'
                                ? 'จิตเวช'
                                : 'โรคทั่วไป'}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600 max-w-xs truncate border-r border-slate-200" title={a.diagnosis}>
                        {a.diagnosis || '-'}
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-800 border-r border-slate-200">
                        {a.sumScore} / {a.fullScore}
                      </td>
                      <td className="p-2.5 text-center font-bold border-r border-slate-200">
                        <span
                          className={
                            a.percentage >= 80
                              ? 'text-emerald-700'
                              : a.percentage >= 60
                                ? 'text-amber-700'
                                : 'text-rose-700'
                          }
                        >
                          {a.percentage}%
                        </span>
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-200 w-20">
                        <span
                          className={`w-full block text-center py-0.5 rounded-sm text-[10px] font-bold border ${a.isPassed === 1
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                        >
                          {a.isPassed === 1 ? 'ผ่าน' : 'ไม่ผ่าน'}
                        </span>
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-200 w-32">
                        <span
                          className={`w-full block text-center py-0.5 rounded-sm text-[10px] font-semibold border ${a.overallFinding === 'no_issue'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : a.overallFinding === 'certain_issues'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : a.overallFinding === 'inadequate'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                        >
                          {a.overallFinding === 'no_issue'
                            ? 'ไม่มีปัญหาสำคัญ'
                            : a.overallFinding === 'certain_issues'
                              ? 'มีประเด็นต้องค้นต่อ'
                              : a.overallFinding === 'inadequate'
                                ? 'ข้อมูลไม่เพียงพอ'
                                : '-'}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600 border-r border-slate-200">
                        {a.auditorName || '-'}
                      </td>
                      <td className="p-2.5 text-slate-600 border-r border-slate-200">{formatThaiDate(a.auditDate)}</td>
                      <td className="p-1.5 text-center text-nowrap whitespace-nowrap w-24">
                        <button
                          type="button"
                          onClick={() => handleOpenAudit(a)}
                          disabled={openingAuditId === a.auditId}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 hover:text-blue-950 border border-blue-200 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                          title="เปิดหน้าตรวจประเมินเพื่อดูและแก้ไขผลการตรวจ"
                        >
                          {openingAuditId === a.auditId ? (
                            <RefreshCw size={11} className="animate-spin text-blue-800" />
                          ) : (
                            <ExternalLink size={11} className="text-blue-700" />
                          )}
                          <span>ดู/แก้ไข</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
