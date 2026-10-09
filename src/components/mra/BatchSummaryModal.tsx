'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Layers,
  Trophy,
  ArrowUpDown,
  ExternalLink,
  RefreshCw,
  Search,
} from 'lucide-react';
import { apiUrl } from '@/lib/constants';
import { exportBatchSummaryToExcel } from '@/lib/excelExport';
import { useUnifiedAuditStore } from '@/store/useUnifiedAuditStore';
import { useIpdAuditStore } from '@/store/useIpdAuditStore';

interface BatchSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  serviceType: 'OPD' | 'IPD';
}

interface BatchMetadata {
  batchId: string;
  batchName?: string;
  samplingDate: string;
  caseType: string;
  dateFrom: string;
  dateTo: string;
  sampleSize: number;
  totalAvailable: number;
  departmentCode?: string;
  wardName?: string;
  status: string;
  note?: string;
  createdBy: string;
}

interface BatchKPI {
  totalItems: number;
  auditedCount: number;
  pendingCount: number;
  completenessPercent: number;
  avgSumScore: number;
  avgFullScore: number;
  avgPercentage: number;
  passedCount: number;
  failedCount: number;
  passRate: number;
  inadequateCount: number;
  certainIssuesCount: number;
  noIssueCount: number;
}

interface CategoryPerf {
  contentNo: number;
  contentName: string;
  totalEvaluated: number;
  naCount: number;
  missingCount: number;
  totalFullScore: number;
  totalSumScore: number;
  complianceRate: number;
}

interface ItemAuditInfo {
  itemId: string;
  vn?: string;
  an?: string;
  hn: string;
  patientName: string;
  diagnosisName?: string;
  department?: string;
  wardName?: string;
  auditStatus: 'pending' | 'audited';
  sumScore?: number;
  fullScore?: number;
  percentage?: number;
  isPassed?: number;
  overallFinding?: 'inadequate' | 'certain_issues' | 'no_issue';
  auditorName?: string;
  auditDate?: string;
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

function formatCaseTypeThai(caseType?: string, serviceType?: string): string {
  if (!caseType) return '-';
  const c = caseType.toLowerCase();
  if (c === 'general') return 'ผู้ป่วยนอกทั่วไป (OPD)';
  if (c === 'chronic') return 'คลินิกโรคเรื้อรัง (NCD)';
  if (c === 'er') return 'อุบัติเหตุ-ฉุกเฉิน (ER)';
  if (c === 'psychiatric') return 'ผู้ป่วยจิตเวช (PSY)';
  if (c === 'medical') return 'อายุรกรรม';
  if (c === 'surgical') return 'ศัลยกรรม';
  if (c === 'pediatric') return 'กุมารเวชกรรม (เด็ก ≤ 15 ปี)';
  if (c === 'obgyn') return 'สูติ-นรีเวชกรรม';
  if (c === 'all') return serviceType === 'IPD' ? 'ผู้ป่วยในทั้งหมด' : 'ผู้ป่วยนอกทั้งหมด';
  return caseType;
}

export function BatchSummaryModal({
  isOpen,
  onClose,
  batchId,
  serviceType,
}: BatchSummaryModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    batch: BatchMetadata;
    kpi: BatchKPI;
    categoryPerformance: CategoryPerf[];
    items: ItemAuditInfo[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'kpi' | 'categories' | 'items'>('kpi');
  const [showAssessmentBox, setShowAssessmentBox] = useState(true);
  const router = useRouter();
  const [openingVisitNumber, setOpeningVisitNumber] = useState<string | null>(null);

  const handleOpenAudit = async (it: ItemAuditInfo) => {
    const visitKey = serviceType === 'IPD' ? it.an : it.vn;
    if (!visitKey) return;

    try {
      setOpeningVisitNumber(visitKey);
      onClose();

      if (serviceType === 'IPD') {
        const isPsy = data?.batch?.caseType === 'psychiatric';
        useIpdAuditStore.getState().loadSampledIpdVisit({
          an: it.an || '',
          hn: it.hn,
          patientName: it.patientName,
          diagnosis: it.diagnosisName,
          wardName: it.wardName,
          caseType: isPsy ? 'psychiatric' : 'general',
          itemId: it.itemId,
          batchId: batchId,
        });
        if (it.auditStatus === 'audited' && it.an) {
          await useIpdAuditStore.getState().loadExistingIpdAudit(it.an);
        }
        router.push(`/ipd?an=${encodeURIComponent(it.an || '')}&batchId=${encodeURIComponent(batchId)}`);
      } else {
        const isItemChronic = data?.batch?.caseType === 'chronic';
        const isItemPsy = data?.batch?.caseType === 'psychiatric';
        useUnifiedAuditStore.getState().loadSampledVisit({
          vn: it.vn || '',
          hn: it.hn,
          patientName: it.patientName,
          diagnosis: it.diagnosisName,
          caseType: isItemChronic ? 'chronic' : 'general',
          isPsychiatric: Boolean(isItemPsy),
          vstdate: it.auditDate || data?.batch?.samplingDate,
          itemId: it.itemId,
          batchId: batchId,
        });
        if (it.auditStatus === 'audited' && it.vn) {
          await useUnifiedAuditStore.getState().loadExistingAudit(it.vn);
        }
        router.push(`/?vn=${encodeURIComponent(it.vn || '')}&batchId=${encodeURIComponent(batchId)}`);
      }
    } catch (err) {
      console.error('Error opening audit from summary modal:', err);
    } finally {
      setOpeningVisitNumber(null);
    }
  };

  // Tab 3: Item List Search & Status Filtering
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemStatusFilter, setItemStatusFilter] = useState<'all' | 'audited' | 'pending'>('all');

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((it) => {
      if (itemStatusFilter !== 'all' && it.auditStatus !== itemStatusFilter) {
        return false;
      }
      if (!itemSearchQuery.trim()) return true;
      const q = itemSearchQuery.toLowerCase().trim();
      const visitNo = (serviceType === 'IPD' ? it.an : it.vn) || '';
      return (
        visitNo.toLowerCase().includes(q) ||
        (it.hn && it.hn.toLowerCase().includes(q)) ||
        (it.patientName && it.patientName.toLowerCase().includes(q)) ||
        (it.diagnosisName && it.diagnosisName.toLowerCase().includes(q)) ||
        (it.auditorName && it.auditorName.toLowerCase().includes(q))
      );
    });
  }, [data?.items, itemSearchQuery, itemStatusFilter, serviceType]);

  useEffect(() => {
    if (!isOpen || !batchId) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    const endpoint =
      serviceType === 'IPD'
        ? apiUrl(`/api/mra/ipd-batches/summary?batchId=${encodeURIComponent(batchId)}`)
        : apiUrl(`/api/mra/batches/summary?batchId=${encodeURIComponent(batchId)}`);

    fetch(endpoint)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          let msg = `เซิร์ฟเวอร์ส่งรหัสสถานะ ${res.status}`;
          try {
            const j = JSON.parse(text);
            if (j.error) msg = j.error;
          } catch {
            // text is HTML or non-JSON
          }
          throw new Error(msg);
        }
        return res.json();
      })
      .then((json) => {
        if (!mounted) return;
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error || 'ไม่สามารถโหลดข้อมูลสรุปชุดสุ่มได้');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, batchId, serviceType]);

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (!data || exporting) return;
    try {
      setExporting(true);
      await exportBatchSummaryToExcel({
        batch: data.batch,
        kpi: data.kpi,
        categoryPerformance: data.categoryPerformance,
        items: data.items,
        serviceType,
        caseTypeLabel: formatCaseTypeThai(data.batch.caseType, serviceType),
      });
    } catch (err) {
      console.error('Export Data failed:', err);
      alert('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-sm border border-slate-300 shadow-xl w-full max-w-5xl max-h-[96dvh] sm:max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* ── Header ── */}
        <div className="bg-blue-950 text-white px-3.5 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2.5 shrink-0 border-b border-blue-900">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-sm bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Trophy size={18} className="sm:hidden" />
              <Trophy size={22} className="hidden sm:block" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-xs sm:text-base font-bold text-white leading-tight">
                  สรุปผลคะแนนชุดสุ่มตรวจเวชระเบียน ({serviceType})
                </h2>
                <span className="text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-sm bg-blue-900/90 text-blue-100 border border-blue-700/80 shadow-2xs shrink-0">
                  {batchId}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-300 line-clamp-1 sm:line-clamp-none mt-0.5">
                รายงานสถิติการประเมินคุณภาพและอัตราผ่านตามเกณฑ์ สปสช.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || !data || exporting}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-sm transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              title="ส่งออกรายงานเป็น Excel แยก 3 ชีท พร้อมจัดรูปแบบตารางมาตรฐาน"
            >
              <FileSpreadsheet size={14} className="text-white" />
              <span className="hidden sm:inline">{exporting ? 'กำลังส่งออก...' : 'ส่งออกข้อมูล'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-sm flex items-center justify-center text-slate-300 hover:text-white hover:bg-blue-900 transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Sub Navigation Tabs (Responsive scrollable) ── */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-5 pt-2 flex items-center gap-1 shrink-0 overflow-x-auto text-nowrap whitespace-nowrap scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('kpi')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${activeTab === 'kpi'
              ? 'border-pink-600 text-pink-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
          >
            ภาพรวมและตัวชี้วัด
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${activeTab === 'categories'
              ? 'border-pink-600 text-pink-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
          >
            ความสมบูรณ์รายหมวด ({data?.categoryPerformance?.length || 0} หมวด)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${activeTab === 'items'
              ? 'border-pink-600 text-pink-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
          >
            จำนวนเวชระเบียน ({data?.items?.length || 0} รายการ)
          </button>
        </div>

        {/* ── Body Content ── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-5 bg-slate-50/60">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="inline-block w-8 h-8 border-3 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-500 font-medium">กำลังประมวลผลข้อมูลสรุปคะแนนชุดสุ่ม...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-sm bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle size={15} />
                <span>เกิดข้อผิดพลาด</span>
              </div>
              <div>{error}</div>
            </div>
          ) : data ? (
            <>
              {/* Batch Meta Bar (Responsive grid/flex) */}
              <div className="bg-white p-3 sm:p-3.5 rounded-sm border border-slate-200 shadow-2xs text-xs">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center justify-between gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">ชื่อชุดสุ่ม</span>
                    <strong className="text-blue-950 font-bold text-xs sm:text-sm truncate block" title={data.batch.batchName || data.batch.batchId}>
                      {data.batch.batchName || data.batch.batchId}
                    </strong>
                  </div>
                  <div className="sm:border-l sm:border-slate-200 sm:pl-4">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">ช่วงวันที่รับบริการ</span>
                    <span className="text-slate-700 font-medium text-[11px] sm:text-xs">
                      {formatThaiDate(data.batch.dateFrom)} - {formatThaiDate(data.batch.dateTo)}
                    </span>
                  </div>
                  <div className="sm:border-l sm:border-slate-200 sm:pl-4">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">ประเภทเคส</span>
                    <span className="text-blue-950 font-bold text-[11px] sm:text-xs">
                      {formatCaseTypeThai(data.batch.caseType, serviceType)}
                    </span>
                  </div>
                  <div className="sm:border-l sm:border-slate-200 sm:pl-4">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">สร้างโดย</span>
                    <span className="text-slate-700 text-[11px] sm:text-xs">{data.batch.createdBy || 'Auditor'}</span>
                  </div>
                  <div className="sm:border-l sm:border-slate-200 sm:pl-4">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">วันที่สุ่มตรวจ</span>
                    <span className="text-slate-700 text-[11px] sm:text-xs">{formatThaiDate(data.batch.samplingDate)}</span>
                  </div>
                  {data.kpi.completenessPercent === 100 && (
                    <div className="col-span-2 sm:col-span-auto sm:border-l sm:border-slate-200 sm:pl-4 flex items-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px] shadow-2xs">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span>ตรวจครบ 100% แล้ว</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── TAB 1: KPI Dashboard ── */}
              {activeTab === 'kpi' && (
                <div className="space-y-3 sm:space-y-4">
                  {/* Top KPI Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
                    {/* Card 1: ความก้าวหน้าการตรวจ */}
                    <div className="bg-white p-3 sm:p-4 rounded-sm border border-slate-200 shadow-2xs space-y-1 sm:space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-xs font-semibold">ความก้าวหน้าการตรวจ</span>
                        <Layers size={16} className="text-blue-600" />
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-blue-950">
                        {data.kpi.auditedCount}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          / {data.kpi.totalItems} ชาร์ต
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${data.kpi.completenessPercent}%` }}
                        ></div>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium flex justify-between">
                        <span>ความครอบคลุม</span>
                        <strong className="text-blue-700 font-bold">{data.kpi.completenessPercent}%</strong>
                      </div>
                    </div>

                    {/* Card 2: คะแนนเฉลี่ยร้อยละ */}
                    <div className="bg-white p-3 sm:p-4 rounded-sm border border-slate-200 shadow-2xs space-y-1 sm:space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-xs font-semibold">คะแนนเฉลี่ยร้อยละ</span>
                        <TrendingUp size={16} className="text-pink-600" />
                      </div>
                      <div
                        className={`text-xl sm:text-2xl font-black ${data.kpi.avgPercentage >= 80
                          ? 'text-emerald-700'
                          : data.kpi.avgPercentage >= 60
                            ? 'text-amber-700'
                            : 'text-rose-700'
                          }`}
                      >
                        {data.kpi.avgPercentage}%
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between pt-0.5 sm:pt-1">
                        <span>คะแนนเฉลี่ย</span>
                        <strong className="text-slate-800">
                          {data.kpi.avgSumScore} / {data.kpi.avgFullScore}
                        </strong>
                      </div>
                      <div className="text-[10px] text-slate-400">คำนวณจากเคสที่ตรวจแล้วทั้งหมด</div>
                    </div>

                    {/* Card 3: อัตราผ่านเกณฑ์ขั้นต่ำ */}
                    <div className="bg-white p-3 sm:p-4 rounded-sm border border-slate-200 shadow-2xs space-y-1 sm:space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-xs font-semibold">อัตราผ่านเกณฑ์ขั้นต่ำ</span>
                        <ArrowUpDown size={16} className="text-emerald-600" />
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-700">
                        {data.kpi.passRate}%
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between pt-0.5 sm:pt-1">
                        <span>ผ่านเกณฑ์</span>
                        <strong className="text-emerald-700">
                          {data.kpi.passedCount} ชาร์ต
                        </strong>
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between">
                        <span>ไม่ผ่านเกณฑ์</span>
                        <strong className="text-rose-600">
                          {data.kpi.failedCount} ชาร์ต
                        </strong>
                      </div>
                    </div>

                    {/* Card 4: การประเมินภาพรวม (Overall Findings) */}
                    <div className="bg-white p-3 sm:p-4 rounded-sm border border-slate-200 shadow-2xs space-y-1">
                      <span className="text-xs font-semibold text-slate-500 block mb-0.5 sm:mb-1">
                        ข้อสรุปภาพรวม (Findings)
                      </span>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between items-center bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-sm">
                          <span>ไม่มีปัญหาสำคัญ</span>
                          <span className="font-bold">{data.kpi.noIssueCount}</span>
                        </div>
                        <div className="flex justify-between items-center bg-amber-50 text-amber-800 px-2 py-0.5 rounded-sm">
                          <span>มีประเด็นต้องค้นต่อ</span>
                          <span className="font-bold">{data.kpi.certainIssuesCount}</span>
                        </div>
                        <div className="flex justify-between items-center bg-rose-50 text-rose-800 px-2 py-0.5 rounded-sm">
                          <span>ข้อมูลไม่เพียงพอ</span>
                          <span className="font-bold">{data.kpi.inadequateCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Assessment Statement (Modern Structured Card) */}
                  {showAssessmentBox && (
                    <div className="bg-white border border-slate-200 rounded-sm p-3.5 sm:p-4 shadow-2xs space-y-3 relative">
                      {/* Header bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-sm bg-blue-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Sparkles size={14} />
                          </div>
                          <h4 className="font-bold text-xs text-blue-950">ข้อสรุปการประเมิน</h4>
                          {data.kpi.avgPercentage >= 80 ? (
                            <span className="px-2 py-0.5 rounded-sm text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span>ระดับมาตรฐานดีเยี่ยม</span>
                            </span>
                          ) : data.kpi.avgPercentage >= 60 ? (
                            <span className="px-2 py-0.5 rounded-sm text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <AlertCircle size={12} className="text-amber-600" />
                              <span>ระดับยอมรับได้</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-sm text-[10px] sm:text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                              <AlertCircle size={12} className="text-rose-600" />
                              <span>ต่ำกว่าเกณฑ์มาตรฐาน</span>
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAssessmentBox(false)}
                          className="w-6 h-6 rounded-sm flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                          title="ปิดข้อสรุปนี้"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* 3 Metric Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 text-xs">
                        <div className="bg-slate-50/80 p-2.5 rounded-sm border border-slate-200/80 space-y-1">
                          <span className="text-[11px] font-medium text-slate-500 block">ความครอบคลุมการตรวจ</span>
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs sm:text-sm font-bold text-slate-900">
                              {data.kpi.auditedCount} / {data.kpi.totalItems} <span className="text-[11px] font-normal text-slate-500">ชาร์ต</span>
                            </span>
                            <span className="text-[11px] sm:text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm">
                              {data.kpi.completenessPercent}%
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-50/80 p-2.5 rounded-sm border border-slate-200/80 space-y-1">
                          <span className="text-[11px] font-medium text-slate-500 block">คะแนนความสมบูรณ์เฉลี่ย</span>
                          <div className="flex items-baseline justify-between">
                            <span className={`text-xs sm:text-sm font-black ${data.kpi.avgPercentage >= 80 ? 'text-emerald-700' : data.kpi.avgPercentage >= 60 ? 'text-amber-700' : 'text-rose-700'
                              }`}>
                              {data.kpi.avgPercentage}%
                            </span>
                            <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                              {data.kpi.avgSumScore} / {data.kpi.avgFullScore} คะแนน
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-50/80 p-2.5 rounded-sm border border-slate-200/80 space-y-1">
                          <span className="text-[11px] font-medium text-slate-500 block">อัตราผ่านเกณฑ์ สปสช.</span>
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs sm:text-sm font-black text-emerald-700">
                              {data.kpi.passRate}%
                            </span>
                            <span className="text-[10px] sm:text-[11px] text-slate-600 font-medium">
                              ผ่าน <strong className="text-emerald-700">{data.kpi.passedCount}</strong> / ตก <strong className="text-rose-600">{data.kpi.failedCount}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Qualitative Analysis / Action Recommendation Callout */}
                      <div className={`p-2.5 sm:p-3 rounded-sm border flex items-start gap-2.5 text-xs ${data.kpi.avgPercentage >= 80
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        : data.kpi.avgPercentage >= 60
                          ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                          : 'bg-rose-50/50 border-rose-200 text-rose-950'
                        }`}>
                        <div className="shrink-0 mt-0.5">
                          {data.kpi.avgPercentage >= 80 ? (
                            <CheckCircle2 size={16} className="text-emerald-600" />
                          ) : (
                            <AlertCircle size={16} className={data.kpi.avgPercentage >= 60 ? 'text-amber-600' : 'text-rose-600'} />
                          )}
                        </div>
                        <div className="space-y-0.5 leading-relaxed min-w-0">
                          <div className="font-bold text-xs">
                            {data.kpi.avgPercentage >= 80
                              ? 'คุณภาพการบันทึกเวชระเบียนอยู่ในเกณฑ์มาตรฐานดีเยี่ยม'
                              : data.kpi.avgPercentage >= 60
                                ? 'คุณภาพการบันทึกเวชระเบียนอยู่ในเกณฑ์ยอมรับได้'
                                : 'คุณภาพการบันทึกเวชระเบียนต่ำกว่าเกณฑ์มาตรฐาน สปสช.'}
                          </div>
                          <div className="text-slate-700 text-[11px]">
                            {data.kpi.avgPercentage >= 80 ? (
                              <span>
                                การบันทึกเวชระเบียนในชุดนี้มีความถูกต้อง ครบถ้วน และสอดคล้องตามเกณฑ์คู่มือ สปสช. สามารถนำข้อมูลนี้ไปใช้เป็นแนวปฏิบัติที่ดี (Best Practice) ประจำโรงพยาบาลได้
                              </span>
                            ) : data.kpi.avgPercentage >= 60 ? (
                              <span>
                                ภาพรวมอยู่ในเกณฑ์ยอมรับได้ แต่ยังมีข้อบกพร่องในบางหมวด แนะนำให้ตรวจสอบรายละเอียดในแท็บ <strong>&quot;ความสมบูรณ์รายหมวด&quot;</strong> เพื่อชี้เป้าจุดบกพร่องและประสานงานทีมผู้บันทึกเวชระเบียนเพื่อพัฒนาคุณภาพอย่างต่อเนื่อง
                              </span>
                            ) : (
                              <span>
                                พบข้อบกพร่องสำคัญในการบันทึกเวชระเบียน แนะนำให้นำผลการประเมินชุดนี้เข้าสู่การพิจารณาของคณะกรรมการเวชระเบียน (MRA Committee) และประสานทีมแพทย์หรือพยาบาลเพื่อทบทวนเชิงลึกอย่างเร่งด่วน
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: Categories Breakdown ── */}
              {activeTab === 'categories' && (
                <div className="bg-white rounded-sm border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-blue-950">
                        สถิติความสมบูรณ์แยกตามหมวดเวชระเบียน (Category Compliance)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        เรียงลำดับหมวดที่มีข้อบกพร่อง/คะแนนต่ำสุดขึ้นก่อน เพื่อชี้เป้าจุดที่ต้องปรับปรุง
                      </p>
                    </div>
                  </div>
                  <div className="table-responsive overflow-x-auto max-h-[520px] overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                      <thead className="sticky top-0 bg-slate-100 z-10 shadow-2xs">
                        <tr className="text-slate-700 font-semibold border-b border-slate-200">
                          <th className="p-2.5 w-12 text-center border-r border-slate-200">หมวด</th>
                          <th className="p-2.5 border-r border-slate-200">ชื่อหมวดการตรวจประเมิน</th>
                          <th className="p-2.5 text-center w-20 border-r border-slate-200">ตรวจแล้ว</th>
                          <th className="p-2.5 text-center w-16 border-r border-slate-200">NA</th>
                          <th className="p-2.5 text-center w-16 border-r border-slate-200">Missing</th>
                          <th className="p-2.5 text-center w-24 border-r border-slate-200">คะแนนเต็ม</th>
                          <th className="p-2.5 text-center w-24 border-r border-slate-200">คะแนนที่ได้</th>
                          <th className="p-2.5 text-center w-36">ร้อยละความสมบูรณ์</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {data.categoryPerformance.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-6 text-center text-slate-400">
                              ยังไม่มีข้อมูลการตรวจประเมินในชุดนี้
                            </td>
                          </tr>
                        ) : (
                          data.categoryPerformance.map((cat, idx) => (
                            <tr key={`${cat.contentNo}-${cat.contentName || idx}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                              <td className="p-2.5 text-center font-bold text-slate-600 border-r border-slate-200">
                                {cat.contentNo}
                              </td>
                              <td className="p-2.5 font-medium text-blue-950 border-r border-slate-200">
                                {cat.contentName}
                              </td>
                              <td className="p-2.5 text-center text-slate-700 border-r border-slate-200">
                                {cat.totalEvaluated}
                              </td>
                              <td className="p-2.5 text-center text-slate-500 border-r border-slate-200">
                                {cat.naCount || 0}
                              </td>
                              <td className="p-2.5 text-center font-bold text-rose-600 border-r border-slate-200">
                                {cat.missingCount || 0}
                              </td>
                              <td className="p-2.5 text-center text-slate-600 border-r border-slate-200">
                                {cat.totalFullScore}
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-900 border-r border-slate-200">
                                {cat.totalSumScore}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-2 rounded-full ${cat.complianceRate >= 80
                                        ? 'bg-emerald-600'
                                        : cat.complianceRate >= 60
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                        }`}
                                      style={{ width: `${Math.min(cat.complianceRate, 100)}%` }}
                                    ></div>
                                  </div>
                                  <span
                                    className={`font-bold w-12 text-right ${cat.complianceRate >= 80
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
                </div>
              )}

              {/* ── TAB 3: Item List ── */}
              {activeTab === 'items' && (
                <div className="bg-white rounded-sm border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-blue-950">
                        รายการเวชระเบียนทั้งหมดในชุดสุ่ม ({filteredItems.length}/{data.items.length} รายการ)
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status Filter Pills */}
                      <div className="inline-flex rounded-sm bg-slate-200/80 p-0.5 text-[11px] gap-1">
                        <button
                          type="button"
                          onClick={() => setItemStatusFilter('all')}
                          className={`px-2.5 py-1 font-medium rounded-xs transition-all cursor-pointer ${
                            itemStatusFilter === 'all'
                              ? 'bg-white text-blue-950 font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ทั้งหมด ({data.items.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemStatusFilter('audited')}
                          className={`px-2.5 py-1 font-medium rounded-xs transition-all cursor-pointer ${
                            itemStatusFilter === 'audited'
                              ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ตรวจแล้ว ({data.kpi.auditedCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemStatusFilter('pending')}
                          className={`px-2.5 py-1 font-medium rounded-xs transition-all cursor-pointer ${
                            itemStatusFilter === 'pending'
                              ? 'bg-amber-600 text-white font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          รอตรวจ ({data.kpi.pendingCount})
                        </button>
                      </div>

                      {/* Quick Search Input */}
                      <div className="relative">
                        <input
                          type="text"
                          value={itemSearchQuery}
                          onChange={(e) => setItemSearchQuery(e.target.value)}
                          placeholder="ค้นหา VN, AN, HN, ชื่อผู้ป่วย..."
                          className="w-44 sm:w-56 pl-7 pr-6 py-1 bg-white border border-slate-300 rounded-sm text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-all"
                        />
                        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        {itemSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setItemSearchQuery('')}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                            title="ล้างข้อความค้นหา"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="table-responsive overflow-x-auto max-h-[520px] overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                      <thead className="sticky top-0 bg-slate-100 z-10 shadow-2xs">
                        <tr className="text-slate-700 font-semibold border-b border-slate-200">
                          <th className="p-2.5 text-center w-10 border-r border-slate-200">ลำดับ</th>
                          <th className="p-2.5 border-r border-slate-200">
                            {serviceType === 'IPD' ? 'AN' : 'VN'}
                          </th>
                          <th className="p-2.5 border-r border-slate-200">HN</th>
                          <th className="p-2.5 border-r border-slate-200">ชื่อ-สกุล ผู้ป่วย</th>
                          <th className="p-2.5 border-r border-slate-200">การวินิจฉัย (Diagnosis)</th>
                          <th className="p-2.5 text-center w-28 min-w-[95px] border-r border-slate-200">สถานะ</th>
                          <th className="p-2.5 text-center w-24 border-r border-slate-200">คะแนน (รวม/เต็ม)</th>
                          <th className="p-2.5 text-center w-20 border-r border-slate-200">ร้อยละ</th>
                          <th className="p-2.5 text-center w-24 border-r border-slate-200">ผลประเมิน</th>
                          <th className="p-2.5 text-center w-32 min-w-[120px] border-r border-slate-200">ภาพรวม</th>
                          <th className="p-2.5 border-r border-slate-200">ผู้ตรวจประเมิน</th>
                          <th className="p-2.5 text-center w-24 min-w-[95px]">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredItems.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="p-8 text-center text-slate-400">
                              ไม่พบรายการเวชระเบียนที่ตรงกับเงื่อนไขการค้นหา
                            </td>
                          </tr>
                        ) : (
                          filteredItems.map((it, idx) => {
                            const visitNumber = serviceType === 'IPD' ? it.an : it.vn;
                            const isOpeningThis = openingVisitNumber === visitNumber;

                          return (
                            <tr key={`${it.itemId || 'item'}-${idx}`} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 text-center text-slate-400 border-r border-slate-200">
                                {idx + 1}
                              </td>
                              <td className="p-2.5 font-bold border-r border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAudit(it)}
                                  disabled={isOpeningThis}
                                  className="font-bold text-blue-900 hover:text-pink-600 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors text-left disabled:opacity-50"
                                  title="คลิกเพื่อเปิดดูและแก้ไขผลการตรวจประเมินของเคสนี้"
                                >
                                  <span>{visitNumber}</span>
                                  <ExternalLink size={11} className="opacity-60 shrink-0" />
                                </button>
                              </td>
                              <td className="p-2.5 text-slate-700 border-r border-slate-200">{it.hn}</td>
                              <td className="p-2.5 font-medium text-slate-900 border-r border-slate-200">
                                {it.patientName}
                              </td>
                              <td className="p-2.5 text-slate-600 max-w-xs truncate border-r border-slate-200" title={it.diagnosisName}>
                                {it.diagnosisName || '-'}
                              </td>
                              <td className="p-2 text-center border-r border-slate-200 w-28 min-w-[95px]">
                                {it.auditStatus === 'audited' ? (
                                  <span className="w-full inline-flex items-center justify-center gap-1.5 text-center px-2.5 py-1 rounded-sm bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 text-[11px] leading-normal text-nowrap whitespace-nowrap shadow-3xs">
                                    <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                                    <span>ตรวจแล้ว</span>
                                  </span>
                                ) : (
                                  <span className="w-full inline-flex items-center justify-center gap-1.5 text-center px-2.5 py-1 rounded-sm bg-slate-100 text-slate-600 font-medium border border-slate-200 text-[11px] leading-normal text-nowrap whitespace-nowrap">
                                    <Clock size={11} className="text-slate-400 shrink-0" />
                                    <span>รอตรวจ</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-800 border-r border-slate-200">
                                {it.auditStatus === 'audited'
                                  ? `${it.sumScore} / ${it.fullScore}`
                                  : '-'}
                              </td>
                              <td className="p-2.5 text-center font-bold border-r border-slate-200">
                                {it.auditStatus === 'audited' ? (
                                  <span
                                    className={
                                      (it.percentage || 0) >= 80
                                        ? 'text-emerald-700 font-bold'
                                        : (it.percentage || 0) >= 60
                                          ? 'text-amber-700 font-bold'
                                          : 'text-rose-700 font-bold'
                                    }
                                  >
                                    {it.percentage}%
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="p-2 text-center border-r border-slate-200 w-24">
                                {it.auditStatus === 'audited' ? (
                                  <span
                                    className={`w-full inline-flex items-center justify-center px-2 py-1 rounded-sm text-[10px] font-bold border leading-normal text-nowrap whitespace-nowrap ${
                                      it.isPassed === 1
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : 'bg-rose-50 text-rose-800 border-rose-300'
                                    }`}
                                  >
                                    {it.isPassed === 1 ? 'ผ่าน' : 'ไม่ผ่าน'}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="p-2 text-center border-r border-slate-200 w-32 min-w-[120px]">
                                {it.auditStatus === 'audited' ? (
                                  <span
                                    className={`w-full inline-flex items-center justify-center px-2 py-1 rounded-sm text-[10px] font-semibold border leading-normal text-nowrap whitespace-nowrap ${
                                      it.overallFinding === 'no_issue'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : it.overallFinding === 'certain_issues'
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : it.overallFinding === 'inadequate'
                                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                                            : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}
                                  >
                                    {it.overallFinding === 'no_issue'
                                      ? 'ไม่มีปัญหาสำคัญ'
                                      : it.overallFinding === 'certain_issues'
                                        ? 'มีประเด็นต้องค้นต่อ'
                                        : it.overallFinding === 'inadequate'
                                          ? 'ข้อมูลไม่เพียงพอ'
                                          : it.overallFinding === 'order_not_standard'
                                            ? 'จัดเรียงไม่ตามเกณฑ์'
                                            : it.overallFinding === 'missing_patient_identifiers'
                                              ? 'ขาดชื่อ/HN/AN'
                                              : '-'}
                                  </span>
                                ) : (
                                  <span className="w-full inline-flex items-center justify-center px-2 py-1 rounded-sm text-[10px] text-slate-400 bg-slate-50 border border-slate-200 leading-normal">
                                    -
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-600 border-r border-slate-200">{it.auditorName || '-'}</td>
                              <td className="p-1.5 text-center text-nowrap whitespace-nowrap w-24">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAudit(it)}
                                  disabled={isOpeningThis}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 hover:text-blue-950 border border-blue-200 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                                  title="เปิดหน้าตรวจประเมินเพื่อดูและแก้ไขผลการตรวจ"
                                >
                                  {isOpeningThis ? (
                                    <RefreshCw size={11} className="animate-spin text-blue-800" />
                                  ) : (
                                    <ExternalLink size={11} className="text-blue-700" />
                                  )}
                                  <span>{it.auditStatus === 'audited' ? 'ดู/แก้ไข' : 'ประเมิน'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        }))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* ── Footer ── */}
        <div className="p-3 sm:p-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 shrink-0">
          <div className="text-[11px] text-slate-500 text-center sm:text-left">
            อ้างอิง: คู่มือการตรวจประเมินคุณภาพการบันทึกเวชระเบียน สปสช.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-sm transition-colors cursor-pointer text-center"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
