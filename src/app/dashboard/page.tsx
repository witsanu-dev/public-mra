'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Award,
  PieChart,
} from 'lucide-react';
import { SearchableSelect, SearchableOption } from '@/components/ui/SearchableSelect';
import { KpiGaugeCard } from '@/components/dashboard/KpiGaugeCard';
import { TrendAreaChart } from '@/components/dashboard/TrendAreaChart';
import { ServiceBarChart } from '@/components/dashboard/ServiceBarChart';
import { CategoryPerformanceChart } from '@/components/dashboard/CategoryPerformanceChart';
import { DeficiencyInfographic } from '@/components/dashboard/DeficiencyInfographic';

interface DashboardData {
  kpi: {
    totalAudited: number;
    passedCount: number;
    failedCount: number;
    passRate: number;
    avgPercentage: number;
    targetBenchmark: number;
    isTargetMet: boolean;
    findingBreakdown: {
      noIssue: number;
      certainIssues: number;
      inadequate: number;
    };
  };
  monthlyTrends: Array<{
    month: string;
    thaiMonth: string;
    total: number;
    avgScore: number;
    passRate: number;
    passed: number;
    failed: number;
  }>;
  serviceComparison: Array<{
    serviceKey: string;
    label: string;
    total: number;
    avgScore: number;
    passRate: number;
    passed: number;
    failed: number;
  }>;
  categories: Array<{
    serviceType: string;
    contentNo: number;
    contentName: string;
    totalEvaluations: number;
    naCount: number;
    missingCount: number;
    totalFullScore: number;
    totalSumScore: number;
    complianceRate: number;
    status: 'good' | 'warning' | 'critical';
  }>;
  topDeficiencies: Array<{
    rank: number;
    serviceType: string;
    categoryName: string;
    complianceRate: number;
    gapToTarget: number;
    missingCount: number;
    recommendation: string;
    note?: string | null;
  }>;
  availableMonths: string[];
}

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

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedService, setSelectedService] = useState<string>('ALL');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedMonth !== 'ALL') params.set('month', selectedMonth);
      if (selectedService !== 'ALL') params.set('serviceType', selectedService);

      const res = await fetch(`/api/mra/dashboard?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('ไม่สามารถเชื่อมต่อข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth, selectedService]);

  // Options for Month Filter
  const monthOptions: SearchableOption[] = useMemo(() => {
    const opts: SearchableOption[] = [
      { value: 'ALL', label: 'สะสมทุกเดือน (ทั้งหมด)' },
    ];
    if (data?.availableMonths) {
      data.availableMonths.forEach((m) => {
        opts.push({
          value: m,
          label: formatThaiMonthYear(m),
        });
      });
    }
    return opts;
  }, [data?.availableMonths]);

  // Options for Service Filter
  const serviceOptions: SearchableOption[] = [
    { value: 'ALL', label: 'บริการทั้งหมด (ALL)' },
    { value: 'OPD', label: 'ผู้ป่วยนอก (OPD)' },
    { value: 'IPD', label: 'ผู้ป่วยใน (IPD)' },
    { value: 'ER', label: 'อุบัติเหตุ-ฉุกเฉิน (ER)' },
    { value: 'CHRONIC', label: 'คลินิกโรคเรื้อรัง (NCDs)' },
    { value: 'PSYCHIATRIC', label: 'จิตเวช (Psychiatric)' },
  ];

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="section-gap pb-12">
      {/* ── 1. Page Header (Screen only) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-sm border border-slate-200 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-sm bg-blue-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <PieChart size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-blue-950">
                แดชบอร์ดบริหารและการวิเคราะห์คุณภาพเวชระเบียน
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              Executive Dashboards
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-sm transition-colors cursor-pointer min-h-[var(--touch-min)] disabled:opacity-50"
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>

          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-sm transition-colors shadow-xs min-h-[var(--touch-min)]"
          >
            <LayoutDashboard size={14} />
            <span>รายงานและสถิติ</span>
          </Link>
        </div>
      </div>

      {/* ── 2. Interactive Global Filter Bar (Screen only) ── */}
      <div className="bg-white p-3.5 rounded-sm border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-3 print:hidden">
        {/* Month Filter */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Calendar size={13} className="text-blue-900" />
            <span>ช่วงเวลาการตรวจประเมิน</span>
          </label>
          <SearchableSelect
            options={monthOptions}
            value={selectedMonth}
            onChange={(val) => setSelectedMonth(val)}
            placeholder="เลือกเดือน..."
            searchPlaceholder="พิมพ์ค้นหาเดือน..."
          />
        </div>

        {/* Service Type Filter */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Layers size={13} className="text-pink-600" />
            <span>ประเภทบริการ</span>
          </label>
          <SearchableSelect
            options={serviceOptions}
            value={selectedService}
            onChange={(val) => setSelectedService(val)}
            placeholder="เลือกประเภทบริการ..."
            searchPlaceholder="พิมพ์ค้นหาบริการ..."
          />
        </div>
      </div>

      {/* ── Print Header (Only visible on print) ── */}
      <div className="hidden print:block mb-6 border-b-2 border-blue-900 pb-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-blue-950">
              รายงานสรุปผลการตรวจสอบเวชระเบียน (MRA Executive Briefing Report)
            </h1>
            <p className="text-xs text-slate-600">
              ช่วงเวลา: {formatThaiMonthYear(selectedMonth)} | บริการ: {serviceOptions.find((s) => s.value === selectedService)?.label || 'ทั้งหมด'}
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <div>เกณฑ์เป้าหมาย สปสช. ≥ 80.00%</div>
            <div suppressHydrationWarning>พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH')}</div>
          </div>
        </div>
      </div>

      {/* ── Error State ── */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-sm text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main Dashboard Content ── */}
      {loading && !data ? (
        <div className="bg-white rounded-sm border border-slate-200 p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2 shadow-xs">
          <RefreshCw size={24} className="animate-spin text-blue-900" />
          <span>กำลังประมวลผลดัชนีชี้วัดและกราฟสถิติ...</span>
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Row 1: KPI Gauge Card & Service Stacked Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <KpiGaugeCard
              passRate={data.kpi.passRate}
              avgPercentage={data.kpi.avgPercentage}
              totalAudited={data.kpi.totalAudited}
              passedCount={data.kpi.passedCount}
              failedCount={data.kpi.failedCount}
              targetBenchmark={data.kpi.targetBenchmark}
              findingBreakdown={data.kpi.findingBreakdown}
            />

            <ServiceBarChart
              data={data.serviceComparison}
              targetBenchmark={data.kpi.targetBenchmark}
            />
          </div>

          {/* Row 2: Monthly Quality Trajectory Trend Area Chart */}
          <div>
            <TrendAreaChart
              data={data.monthlyTrends}
              targetBenchmark={data.kpi.targetBenchmark}
            />
          </div>

          {/* Row 3: Category Compliance Breakdown (Horizontal Bar Meters) */}
          <div>
            <CategoryPerformanceChart
              categories={data.categories}
              targetBenchmark={data.kpi.targetBenchmark}
            />
          </div>

          {/* Row 4: Top 5 Quality Gaps & Clinical Recommendations */}
          <div>
            <DeficiencyInfographic
              deficiencies={data.topDeficiencies}
              targetBenchmark={data.kpi.targetBenchmark}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
