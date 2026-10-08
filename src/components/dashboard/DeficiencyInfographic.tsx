'use client';

import React from 'react';
import { AlertTriangle, Lightbulb } from 'lucide-react';

interface DeficiencyItem {
  rank: number;
  serviceType: string;
  categoryName: string;
  complianceRate: number;
  gapToTarget: number;
  missingCount: number;
  recommendation: string;
  note?: string | null;
}

interface DeficiencyInfographicProps {
  deficiencies: DeficiencyItem[];
  targetBenchmark?: number;
}

// Helper to extract English main title and Thai subtitle without parentheses
function formatCategoryTitle(categoryName: string) {
  const match = categoryName.match(/\(([^)]*[\u0E00-\u0E7F]+[^)]*)\)/);
  if (match) {
    const mainText = categoryName.replace(/\s*\(([^)]*[\u0E00-\u0E7F]+[^)]*)\)/, '').trim();
    const thaiSub = match[1].trim();
    return { mainText, thaiSub };
  }
  return { mainText: categoryName, thaiSub: null };
}

// Helper to sanitize recommendation, eliminate square brackets [], and separate note
function parseRecommendation(rec: string, noteFromProp?: string | null) {
  let mainRec = rec || '';
  let parsedNote = noteFromProp || null;

  if (!parsedNote && mainRec.includes('[หมายเหตุ:')) {
    const match = mainRec.match(/\[หมายเหตุ:\s*([^\]]+)\]/);
    if (match) {
      parsedNote = match[1].trim();
      mainRec = mainRec.replace(/\[หมายเหตุ:\s*([^\]]+)\]/, '').trim();
    }
  } else if (!parsedNote && mainRec.includes('หมายเหตุ:')) {
    const parts = mainRec.split(/หมายเหตุ:\s*/);
    mainRec = parts[0].trim();
    parsedNote = parts[1].trim();
  }

  // Remove any remaining square brackets
  mainRec = mainRec.replace(/\[|\]/g, '').trim();
  if (parsedNote) {
    parsedNote = parsedNote.replace(/\[|\]/g, '').replace(/^หมายเหตุ:\s*/, '').trim();
  }

  return { mainRec, note: parsedNote };
}

export function DeficiencyInfographic({
  deficiencies,
  targetBenchmark = 80.0,
}: DeficiencyInfographicProps) {
  if (!deficiencies || deficiencies.length === 0) {
    return (
      <div className="bg-white rounded-sm border border-slate-200 p-6 text-center text-slate-400 text-xs">
        ไม่พบข้อบกพร่องวิกฤต ทุกหมวดผ่านเกณฑ์มาตรฐานอย่างสมบูรณ์
      </div>
    );
  }

  return (
    <div className="bg-white rounded-sm border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-950">
              5 อันดับจุดบกพร่องที่ควรพัฒนาเร่งด่วน
            </h3>
            <p className="text-[11px] text-slate-500">
              วิเคราะห์สาเหตุและข้อเสนอแนะเชิงคลินิก
            </p>
          </div>
        </div>
      </div>

      {/* Cards List */}
      <div className="py-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {deficiencies.map((item) => {
          const isCritical = item.complianceRate < 70.0;
          const isWarning = item.complianceRate >= 70.0 && item.complianceRate < targetBenchmark;
          const isPassed = item.complianceRate >= targetBenchmark;

          const { mainText, thaiSub } = formatCategoryTitle(item.categoryName);
          const { mainRec, note } = parseRecommendation(item.recommendation, item.note);

          // Service badge color mapping: OPD=pink, IPD=blue
          const isOpd = item.serviceType === 'OPD';
          const isIpd = item.serviceType === 'IPD';
          const serviceBadgeClass = isOpd
            ? 'bg-pink-50 text-pink-700 border-pink-200'
            : isIpd
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : item.serviceType === 'ER'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : item.serviceType === 'Psychiatric'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200';

          return (
            <div
              key={`${item.serviceType}-${item.rank}`}
              className={`border rounded-sm p-3.5 flex flex-col gap-2.5 transition-all ${isCritical
                ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                : isWarning
                  ? 'bg-amber-50/20 border-amber-200 hover:border-amber-300'
                  : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                }`}
            >
              {/* Card top: Rank and Service badge on the left, Status & Compliance Pill on the right */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-sm bg-blue-950 text-white text-xs font-extrabold flex items-center justify-center shrink-0 shadow-2xs">
                      {item.rank}
                    </span>
                    <span
                      className={`h-6 px-2 text-[10px] font-bold rounded-sm border shrink-0 tracking-wide flex items-center justify-center ${serviceBadgeClass}`}
                    >
                      {item.serviceType}
                    </span>
                  </div>

                  <div className="ml-auto flex items-center gap-1.5">
                    <span
                      className={`h-6 px-2 text-[10px] font-bold rounded-sm border shrink-0 tracking-wide flex items-center justify-center ${isCritical
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : isWarning
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                    >
                      {isCritical ? 'วิกฤต' : isWarning ? 'เฝ้าระวัง' : 'ผ่านเกณฑ์'}
                    </span>
                    <span
                      className={`h-6 px-2 text-xs font-bold rounded-sm border shrink-0 tracking-tight flex items-center justify-center ${isPassed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : isCritical
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                    >
                      {item.complianceRate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Category title row */}
                <div className="mb-2">
                  <h4 className="text-xs font-bold text-blue-950 leading-snug">
                    {mainText}
                  </h4>
                  {thaiSub && (
                    <p className="text-[11px] font-normal text-slate-600 mt-0.5 leading-tight">
                      {thaiSub}
                    </p>
                  )}
                </div>

                {/* Target gap & Missing indicator */}
                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60">
                  <span className="text-slate-500">
                    {item.gapToTarget > 0 ? (
                      <span className="text-rose-600 font-semibold">
                        หลุดเป้าหมาย -{item.gapToTarget.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">
                        บรรลุเป้าหมาย สปสช.
                      </span>
                    )}
                  </span>
                  {item.missingCount > 0 && (
                    <span className="text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-xs border border-amber-200 text-[10px]">
                      เอกสารขาด {item.missingCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Recommendation Box */}
              <div
                className={`rounded-sm p-2.5 text-[11px] text-slate-700 flex items-start gap-2 shadow-2xs border ${isCritical
                  ? 'bg-white border-rose-200'
                  : isWarning
                    ? 'bg-white border-amber-200'
                    : 'bg-white border-blue-100'
                  }`}
              >
                <Lightbulb
                  size={15}
                  className={`shrink-0 mt-0.5 ${isCritical
                    ? 'text-rose-600'
                    : isWarning
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                    }`}
                />
                <div className="flex-1 min-w-0 leading-relaxed">
                  <span className="font-bold text-blue-950 block text-[10px] uppercase tracking-wider mb-0.5">
                    ข้อเสนอแนะเชิงพัฒนา:
                  </span>
                  <div className="text-slate-800">{mainRec}</div>
                  {note && (
                    <div className="mt-1 text-slate-700">
                      หมายเหตุ: {note}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>อ้างอิงเกณฑ์การตรวจประเมินคุณภาพเวชระเบียน สปสช. (ฉบับมาตรฐาน)</span>
        <span className="text-blue-900 font-semibold">e-MRA</span>
      </div>
    </div>
  );
}
