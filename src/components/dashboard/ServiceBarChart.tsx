'use client';

import React from 'react';
import { Layers, CheckCircle2, XCircle, Stethoscope } from 'lucide-react';

interface ServiceComparisonItem {
  serviceKey: string;
  label: string;
  total: number;
  avgScore: number;
  passRate: number;
  passed: number;
  failed: number;
}

interface ServiceBarChartProps {
  data: ServiceComparisonItem[];
  targetBenchmark?: number;
}

export function ServiceBarChart({ data, targetBenchmark = 80.0 }: ServiceBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-sm border border-slate-200 p-6 text-center text-slate-400 text-xs">
        ไม่มีข้อมูลเปรียบเทียบประเภทบริการ
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="bg-white rounded-sm border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-pink-50 text-pink-700 flex items-center justify-center shrink-0">
            <Layers size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-950">
              เปรียบเทียบคุณภาพแยกตามประเภทบริการ
            </h3>
            <p className="text-[11px] text-slate-500">
              วิเคราะห์สัดส่วนการผ่านเกณฑ์และจำนวนชาร์ต
            </p>
          </div>
        </div>
      </div>

      {/* Bar Rows */}
      <div className="py-3 space-y-3.5">
        {data.map((item) => {
          const isPassed = item.passRate >= targetBenchmark;
          const passPercent = item.total > 0 ? (item.passed / item.total) * 100 : 0;
          const failPercent = item.total > 0 ? (item.failed / item.total) * 100 : 0;
          const barWidthPercent = (item.total / maxTotal) * 100;

          return (
            <div key={item.serviceKey} className="space-y-1.5">
              {/* Row Label & Metrics */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-slate-800 truncate">{item.label}</span>
                  <span className="text-[11px] text-slate-400 font-medium">({item.total} ชาร์ต)</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-slate-500 font-medium">
                    เฉลี่ย {item.avgScore.toFixed(1)}%
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-sm border ${isPassed
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}
                  >
                    ผ่าน {item.passRate.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Stacked Proportional Bar */}
              <div className="w-full bg-slate-100 h-5 rounded-xs overflow-hidden flex relative">
                {/* Passed Segment */}
                <div
                  style={{ width: `${passPercent}%` }}
                  className="bg-emerald-600 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all overflow-hidden"
                  title={`${item.label} ผ่าน: ${item.passed} ชาร์ต (${passPercent.toFixed(1)}%)`}
                >
                  {item.passed > 0 && item.passed}
                </div>
                {/* Failed Segment */}
                <div
                  style={{ width: `${failPercent}%` }}
                  className="bg-rose-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all overflow-hidden"
                  title={`${item.label} ไม่ผ่าน: ${item.failed} ชาร์ต (${failPercent.toFixed(1)}%)`}
                >
                  {item.failed > 0 && item.failed}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" />
            <span>ผ่านเกณฑ์ (เคส)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" />
            <span>ไม่ผ่านเกณฑ์ (เคส)</span>
          </span>
        </div>
        <span className="text-[10px] text-slate-400">ตัวเลขในแท่งกราฟคือจำนวนชาร์ตจริง</span>
      </div>
    </div>
  );
}
