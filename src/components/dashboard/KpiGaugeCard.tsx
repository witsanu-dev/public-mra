'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, TrendingUp, CheckCircle2, XCircle, Award, CheckCheck, Trophy } from 'lucide-react';

interface KpiGaugeCardProps {
  passRate: number;
  avgPercentage: number;
  totalAudited: number;
  passedCount: number;
  failedCount: number;
  targetBenchmark?: number;
  findingBreakdown: {
    noIssue: number;
    certainIssues: number;
    inadequate: number;
  };
}

export function KpiGaugeCard({
  passRate,
  avgPercentage,
  totalAudited,
  passedCount,
  failedCount,
  targetBenchmark = 80.0,
  findingBreakdown,
}: KpiGaugeCardProps) {
  const isPassed = passRate >= targetBenchmark;
  const gap = passRate - targetBenchmark;

  // Arc calculation for semi-circle gauge (180 degrees)
  const radius = 78;
  const circumference = Math.PI * radius;
  const progressPercent = Math.min(Math.max(passRate, 0), 100);
  const strokeDashoffset = circumference - (circumference * progressPercent) / 100;

  // Target Benchmark Notch coordinates (Default 80%)
  const targetAngleRad = ((180 - (targetBenchmark / 100) * 180) * Math.PI) / 180;
  const notchInnerX = 110 + 66 * Math.cos(targetAngleRad);
  const notchInnerY = 105 - 66 * Math.sin(targetAngleRad);
  const notchOuterX = 110 + 90 * Math.cos(targetAngleRad);
  const notchOuterY = 105 - 90 * Math.sin(targetAngleRad);
  const notchCenterDotX = 110 + radius * Math.cos(targetAngleRad);
  const notchCenterDotY = 105 - radius * Math.sin(targetAngleRad);

  return (
    <div className="bg-white rounded-sm border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${isPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            <Trophy size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-950">
              อัตราผ่านเกณฑ์คุณภาพเวชระเบียน
            </h3>
            <p className="text-[11px] text-slate-500">
              เกณฑ์มาตรฐานกำหนดเป้าหมายขั้นต่ำ ≥ {targetBenchmark.toFixed(1)}%
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-sm border ${isPassed
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
        >
          {isPassed ? <CheckCheck size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-rose-600" />}
          <span>{isPassed ? 'ผ่านเกณฑ์มาตรฐาน' : 'ต่ำกว่าเกณฑ์มาตรฐาน'}</span>
        </span>
      </div>

      {/* Main Gauge Graphic */}
      <div className="py-2 flex flex-col items-center justify-center">
        <div className="relative w-64 h-[126px] flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 220 125">
            <defs>
              <linearGradient id="gaugePassGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="gaugeFailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>
            </defs>

            {/* Background Track (Grey) */}
            <path
              d="M 32 105 A 78 78 0 0 1 188 105"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="16"
              strokeLinecap="round"
            />

            {/* Value Progress Arc (Clockwise from Left to Right) */}
            <path
              d="M 32 105 A 78 78 0 0 1 188 105"
              fill="none"
              stroke={isPassed ? 'url(#gaugePassGrad)' : 'url(#gaugeFailGrad)'}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />

            {/* Target 80% Benchmark Notch */}
            <line
              x1={notchInnerX}
              y1={notchInnerY}
              x2={notchOuterX}
              y2={notchOuterY}
              stroke="#f59e0b"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Target Indicator Dot */}
            <circle
              cx={notchCenterDotX}
              cy={notchCenterDotY}
              r="4"
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth="1.5"
            />

            {/* Scale End Labels */}
            <text x="24" y="120" textAnchor="middle" className="text-[9px] font-semibold fill-slate-400">
              0%
            </text>
            <text x="196" y="120" textAnchor="middle" className="text-[9px] font-semibold fill-slate-400">
              100%
            </text>

            {/* Center Digital Reading */}
            <text
              x="110"
              y="85"
              textAnchor="middle"
              className="text-3xl font-extrabold fill-slate-900 tracking-tight"
            >
              {passRate.toFixed(1)}%
            </text>
            <text
              x="110"
              y="102"
              textAnchor="middle"
              className="text-[11px] font-medium fill-slate-500"
            >
              เป้าหมาย ≥ {targetBenchmark.toFixed(0)}%
            </text>
          </svg>
        </div>

        {/* Delta badge */}
        <div className="mt-1 text-center">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${gap >= 0
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : 'text-rose-700 bg-rose-50 border border-rose-200'
              }`}
          >
            {gap >= 0 ? `+${gap.toFixed(2)}% สูงกว่ามาตรฐาน` : `${Math.abs(gap).toFixed(2)}% ต่ำกว่ามาตรฐาน`}
          </span>
        </div>
      </div>

      {/* Grid of Micro Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-center">
        <div className="bg-slate-50 p-2 rounded-sm border border-slate-200/60">
          <div className="text-[10px] text-slate-500 font-medium">คะแนนเฉลี่ยสะสม</div>
          <div className="text-sm font-bold text-blue-950">{avgPercentage.toFixed(1)}%</div>
        </div>
        <div className="bg-slate-50 p-2 rounded-sm border border-slate-200/60">
          <div className="text-[10px] text-slate-500 font-medium">ตรวจประเมินแล้ว</div>
          <div className="text-sm font-bold text-slate-800">{totalAudited} ชาร์ต</div>
        </div>
        <div className="bg-emerald-50/50 p-2 rounded-sm border border-emerald-200/60">
          <div className="text-[10px] text-emerald-700 font-medium flex items-center justify-center gap-1">
            <CheckCircle2 size={10} /> ผ่านเกณฑ์
          </div>
          <div className="text-sm font-bold text-emerald-700">{passedCount} เคส</div>
        </div>
        <div className="bg-rose-50/50 p-2 rounded-sm border border-rose-200/60">
          <div className="text-[10px] text-rose-700 font-medium flex items-center justify-center gap-1">
            <XCircle size={10} /> ไม่ผ่านเกณฑ์
          </div>
          <div className="text-sm font-bold text-rose-700">{failedCount} เคส</div>
        </div>
      </div>

      {/* Finding Quality Proportion */}
      <div className="mt-3 pt-2.5 border-t border-slate-100">
        <div className="flex items-center justify-between text-[11px] mb-1 text-slate-600 font-medium">
          <span>ความสมบูรณ์เวชระเบียน</span>
          <span>
            สมบูรณ์ {findingBreakdown.noIssue} | ต้องปรับปรุง  {findingBreakdown.certainIssues} | ไม่สมบูรณ์ {findingBreakdown.inadequate}
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-sm overflow-hidden flex">
          <div
            style={{ width: `${totalAudited > 0 ? (findingBreakdown.noIssue / totalAudited) * 100 : 0}%` }}
            className="bg-emerald-600 h-full transition-all"
            title={`สมบูรณ์: ${findingBreakdown.noIssue} เคส`}
          />
          <div
            style={{ width: `${totalAudited > 0 ? (findingBreakdown.certainIssues / totalAudited) * 100 : 0}%` }}
            className="bg-amber-500 h-full transition-all"
            title={`มีประเด็นต้องค้น: ${findingBreakdown.certainIssues} เคส`}
          />
          <div
            style={{ width: `${totalAudited > 0 ? (findingBreakdown.inadequate / totalAudited) * 100 : 0}%` }}
            className="bg-rose-500 h-full transition-all"
            title={`ข้อมูลไม่เพียงพอ: ${findingBreakdown.inadequate} เคส`}
          />
        </div>
      </div>
    </div>
  );
}
