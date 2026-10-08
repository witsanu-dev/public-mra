'use client';

import React, { useState } from 'react';
import { Target, CheckCircle2, AlertTriangle, AlertOctagon, Filter } from 'lucide-react';

interface CategoryItem {
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
}

interface CategoryPerformanceChartProps {
  categories: CategoryItem[];
  targetBenchmark?: number;
}

export function CategoryPerformanceChart({
  categories,
  targetBenchmark = 80.0,
}: CategoryPerformanceChartProps) {
  const [filterType, setFilterType] = useState<'ALL' | 'OPD' | 'IPD'>('ALL');

  const filteredCategories = categories.filter((c) => {
    if (filterType === 'ALL') return true;
    return c.serviceType === filterType;
  });

  return (
    <div className="bg-white rounded-sm border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Target size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-950">
              ผลการประเมินแยกตามหมวดเวชระเบียน
            </h3>
            <p className="text-[11px] text-slate-500">
              วิเคราะห์ความสอดคล้องตามเกณฑ์มาตรฐาน
            </p>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-sm border border-slate-200 text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-1 rounded-xs transition-colors ${filterType === 'ALL'
              ? 'bg-blue-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            ทั้งหมด ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('OPD')}
            className={`px-2.5 py-1 rounded-xs transition-colors ${filterType === 'OPD'
              ? 'bg-blue-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            OPD (8)
          </button>
          <button
            type="button"
            onClick={() => setFilterType('IPD')}
            className={`px-2.5 py-1 rounded-xs transition-colors ${filterType === 'IPD'
              ? 'bg-blue-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            IPD (14)
          </button>
        </div>
      </div>

      {/* Category List */}
      <div className="py-3 space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            ไม่มีข้อมูลหมวดการประเมินสำหรับเงื่อนไขนี้
          </div>
        ) : (
          filteredCategories.map((cat, idx) => {
            const isPassed = cat.complianceRate >= targetBenchmark;
            const isWarning = cat.complianceRate >= 70 && cat.complianceRate < 80;
            const isCritical = cat.complianceRate < 70;

            const barColor = isPassed
              ? 'bg-emerald-600'
              : isWarning
                ? 'bg-amber-500'
                : 'bg-rose-600';

            return (
              <div
                key={`${cat.serviceType}-${cat.contentNo}-${idx}`}
                className="p-2.5 rounded-sm border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all space-y-1.5"
              >
                {/* Header row */}
                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-xs shrink-0">
                      {cat.serviceType} หมวด {cat.contentNo}
                    </span>
                    <span className="font-bold text-slate-800 truncate" title={cat.contentName}>
                      {cat.contentName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {cat.missingCount > 0 && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-xs" title={`เอกสารสูญหาย/ไม่ครบ: ${cat.missingCount}`}>
                        Missing: {cat.missingCount}
                      </span>
                    )}
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-sm border ${isPassed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : isWarning
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}
                    >
                      {cat.complianceRate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress Meter with 80% target notch */}
                <div className="relative w-full bg-slate-100 h-3 rounded-xs overflow-hidden">
                  <div
                    style={{ width: `${Math.min(cat.complianceRate, 100)}%` }}
                    className={`${barColor} h-full transition-all duration-500`}
                  />
                  {/* Target 80% line */}
                  <div
                    style={{ left: `${targetBenchmark}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-800/60 z-10"
                    title={`เกณฑ์มาตรฐานเป้าหมาย ${targetBenchmark}%`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
            <span>ผ่านเกณฑ์ (≥ 80%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>เฝ้าระวัง (70 - 79.9%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
            <span>ต้องปรับปรุง (&lt; 70%)</span>
          </span>
        </div>
        <span className="text-[10px] text-slate-400">เส้นขีดแนวตั้งคือเกณฑ์เป้าหมาย 80%</span>
      </div>
    </div>
  );
}
