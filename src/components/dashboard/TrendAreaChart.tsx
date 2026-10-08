'use client';

import React, { useState } from 'react';
import { TrendingUp, Calendar, Info } from 'lucide-react';

interface MonthlyTrendItem {
  month: string;
  thaiMonth: string;
  total: number;
  avgScore: number;
  passRate: number;
  passed: number;
  failed: number;
}

interface TrendAreaChartProps {
  data: MonthlyTrendItem[];
  targetBenchmark?: number;
}

export function TrendAreaChart({ data, targetBenchmark = 80.0 }: TrendAreaChartProps) {
  const [metric, setMetric] = useState<'passRate' | 'avgScore'>('passRate');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-sm border border-slate-200 p-6 text-center text-slate-400 text-xs">
        ไม่มีข้อมูลแนวโน้มรายเดือนสำหรับเงื่อนไขที่เลือก
      </div>
    );
  }

  // Chart Dimensions
  const width = 600;
  const height = 240;
  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Y-Scale: 0 to 100%
  const getY = (val: number) => {
    const clamped = Math.min(Math.max(val, 0), 100);
    return paddingTop + chartHeight - (clamped / 100) * chartHeight;
  };

  // X-Scale: evenly distributed
  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  // Build SVG Path for Area & Line
  const points = data.map((d, i) => {
    const val = metric === 'passRate' ? d.passRate : d.avgScore;
    return { x: getX(i), y: getY(val), val, raw: d };
  });

  const linePath = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${getY(0)} L ${points[0].x} ${getY(0)} Z`
    : '';

  const targetY = getY(targetBenchmark);

  return (
    <div className="bg-white rounded-sm border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
      {/* Header & Metric Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-950">
              แนวโน้มคุณภาพเวชระเบียนรายเดือน
            </h3>
            <p className="text-[11px] text-slate-500">
              ติดตามทิศทางพัฒนาการคุณภาพเวชระเบียน
            </p>
          </div>
        </div>

        {/* Metric buttons */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-sm border border-slate-200 text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetric('passRate')}
            className={`px-2.5 py-1 rounded-xs transition-colors ${metric === 'passRate'
              ? 'bg-blue-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            อัตราผ่านเกณฑ์ (%)
          </button>
          <button
            type="button"
            onClick={() => setMetric('avgScore')}
            className={`px-2.5 py-1 rounded-xs transition-colors ${metric === 'avgScore'
              ? 'bg-blue-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            คะแนนเฉลี่ยสะสม (%)
          </button>
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <div className="relative w-full pt-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-56 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines Y */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray={tick === 0 ? 'none' : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-medium"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Target 80% Benchmark Reference Line */}
          <line
            x1={paddingLeft}
            y1={targetY}
            x2={width - paddingRight}
            y2={targetY}
            stroke="#e11d48"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text
            x={width - paddingRight + 4}
            y={targetY + 3.5}
            className="text-[9px] fill-rose-600 font-bold"
          >
            เกณฑ์ 80%
          </text>

          {/* Gradient Area */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Main Trend Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X Axis Labels & Data Nodes */}
          {points.map((pt, i) => (
            <g
              key={i}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              className="cursor-pointer"
            >
              {/* Vertical Guide Line on Hover */}
              {hoverIndex === i && (
                <line
                  x1={pt.x}
                  y1={paddingTop}
                  x2={pt.x}
                  y2={getY(0)}
                  stroke="#0284c7"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}

              {/* Data Node Point */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoverIndex === i ? 6 : 4}
                fill={pt.val >= targetBenchmark ? '#059669' : '#e11d48'}
                stroke="#ffffff"
                strokeWidth="2"
                className="transition-all"
              />

              {/* Data Value Text above point */}
              <text
                x={pt.x}
                y={pt.y - 8}
                textAnchor="middle"
                className={`text-[10px] font-bold ${pt.val >= targetBenchmark ? 'fill-emerald-700' : 'fill-rose-700'
                  }`}
              >
                {pt.val.toFixed(1)}%
              </text>

              {/* Month Label below X-axis */}
              <text
                x={pt.x}
                y={height - 10}
                textAnchor="middle"
                className="text-[10px] fill-slate-500 font-medium"
              >
                {pt.raw.thaiMonth}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover Tooltip Card */}
        {hoverIndex !== null && data[hoverIndex] && (
          <div
            className="absolute top-2 right-4 bg-slate-900/95 text-white p-2.5 rounded-sm shadow-md text-xs pointer-events-none z-10 space-y-1 animate-in fade-in duration-150"
          >
            <div className="font-bold border-b border-slate-700 pb-1 text-sky-400">
              เดือน {data[hoverIndex].thaiMonth}
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-300">อัตราผ่านเกณฑ์:</span>
              <span className="font-semibold text-emerald-400">{data[hoverIndex].passRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-300">คะแนนเฉลี่ย:</span>
              <span className="font-semibold">{data[hoverIndex].avgScore.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between gap-4 text-[11px] text-slate-400 border-t border-slate-800 pt-1">
              <span>ตรวจ {data[hoverIndex].total} ชาร์ต</span>
              <span>(ผ่าน {data[hoverIndex].passed} / ตก {data[hoverIndex].failed})</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
            <span>ผ่านเกณฑ์ (≥ {targetBenchmark}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
            <span>ต่ำกว่าเกณฑ์ (&lt; {targetBenchmark}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t border-dashed border-rose-500 inline-block" />
            <span>เส้นเป้าหมาย สปสช. ({targetBenchmark}%)</span>
          </span>
        </div>
        <span className="text-[10px] text-slate-400">ชี้เมาส์ที่จุดเพื่อดูรายละเอียด</span>
      </div>
    </div>
  );
}
