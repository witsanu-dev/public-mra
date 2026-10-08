'use client';

import React, { useState, useEffect } from 'react';
import { useUnifiedAuditStore } from '@/store/useUnifiedAuditStore';
import { useAuthStore } from '@/store/useAuthStore';
import { RBAC } from '@/lib/rbac';
import { ScoreValue } from '@/lib/mra-table-types';
import { Maximize2, Minimize2, Table2, TableProperties } from 'lucide-react';

/* Score button color mapping */
const scoreStyle = (
  score: ScoreValue,
  locked: boolean | undefined,
  isReadOnly?: boolean
): string => {
  if (locked) return 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed';
  if (isReadOnly) {
    if (score === '1') return 'bg-emerald-600 border-emerald-600 text-white cursor-default select-none';
    if (score === '0') return 'bg-pink-600 border-pink-600 text-white cursor-default select-none';
    if (score === 'NA') return 'bg-slate-500 border-slate-500 text-white cursor-default select-none';
    return 'bg-slate-50 border-slate-200 text-slate-300 cursor-default select-none';
  }
  if (score === '1') return 'bg-emerald-600 border-emerald-600 text-white cursor-pointer';
  if (score === '0') return 'bg-pink-600 border-pink-600 text-white cursor-pointer';
  if (score === 'NA') return 'bg-slate-500 border-slate-500 text-white cursor-pointer';
  return 'bg-white border-slate-200 text-slate-400 hover:border-slate-400 hover:bg-slate-50 cursor-pointer';
};

export function OpdTableView() {
  const {
    rows,
    isPsychiatric,
    currentVn,
    hn,
    patientName,
    caseType,
    toggleRowNA,
    toggleRowMissing,
    setCriteriaScore,
    setAddScore,
    setDeductScore,
    calculateTotals,
  } = useUnifiedAuditStore();

  const { user } = useAuthStore();
  const isReadOnly = RBAC.isReadOnly(user?.role);

  const { sumScore, fullScore, percentage, isPassed } = calculateTotals();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Prevent background scroll when fullscreen is active
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Listen for Esc key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const getRowCalc = (row: typeof rows[0]) => {
    if (row.naSelected) return { rowSum: 0, rowFull: 0 };
    if (row.missingSelected) return { rowSum: 0, rowFull: 7 };

    let sum = 0;
    let full = 0;
    row.scores.forEach((s) => {
      if (s === '1') { sum += 1; full += 1; }
      else if (s === '0' || s === 'M') { full += 1; }
    });
    sum += row.addScore - row.deductScore;
    if (sum < 0) sum = 0;
    return { rowSum: sum, rowFull: full };
  };

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9998] bg-slate-100 p-2 sm:p-4 flex flex-col gap-2.5 overflow-hidden animate-in fade-in duration-150'
          : 'space-y-2.5'
      }
    >
      {/* ── Header Toolbar ── */}
      {isFullscreen ? (
        <div className="bg-white px-3 sm:px-4 py-2.5 rounded-sm border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left: Case & Patient Info */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Table2 size={16} className="text-pink-600" />
              <span className="font-bold text-xs sm:text-sm text-blue-950">
                ตารางตรวจประเมิน OPD & ER
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            {currentVn && (
              <span className="text-xs font-bold text-pink-900 bg-pink-50 px-2 py-0.5 rounded-sm border border-pink-200">
                VN: {currentVn}
              </span>
            )}
            {hn && (
              <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
                HN: {hn}
              </span>
            )}
            {patientName && (
              <span className="text-xs font-semibold text-slate-900">
                ผู้ป่วย: {patientName}
              </span>
            )}
            {isPsychiatric ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-purple-50 text-purple-700 border border-purple-200">
                จิตเวช
              </span>
            ) : caseType === 'chronic' ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-xs bg-amber-50 text-amber-800 border border-amber-200">
                โรคเรื้อรัง
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-xs bg-slate-100 text-slate-700 border border-slate-200">
                ทั่วไป/ฉุกเฉิน
              </span>
            )}
          </div>

          {/* Right: Live Score & Minimize Button */}
          <div className="flex items-center gap-2.5 ml-auto">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-sm border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">คะแนน</span>
              <span className="font-bold text-pink-700">{sumScore} / {fullScore}</span>
              <span className="text-slate-400">({percentage.toFixed(1)}%)</span>
              {isPassed ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-xs">
                  ผ่าน
                </span>
              ) : (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-xs">
                  ไม่ผ่าน
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-sm shadow-xs transition-colors cursor-pointer"
              title="ย่อตารางกลับสู่มุมมองปกติ (Esc)"
            >
              <Minimize2 size={14} />
              <span>ย่อตาราง</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
              <TableProperties size={15} className="text-pink-600" />
              <span>ตารางตรวจประเมินคุณภาพการบันทึกเวชระเบียน OPD & ER</span>
            </span>
            {isPsychiatric && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-purple-50 text-purple-700 border border-purple-200">
                เกณฑ์จิตเวช
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-950 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm shadow-xs transition-colors cursor-pointer ml-auto"
            title="ขยายตารางแบบเต็มหน้าจอ (Full Screen)"
          >
            <Maximize2 size={13} className="text-blue-900" />
            <span>ขยายตาราง</span>
          </button>
        </div>
      )}

      {/* Mobile scroll hint */}
      {!isFullscreen && (
        <p className="text-[11px] text-slate-500 font-medium sm:hidden flex items-center gap-1">
          ← เลื่อนซ้าย/ขวาเพื่อดูตารางทั้งหมด →
        </p>
      )}

      {/* ── Table Wrapper — responsive horizontal & vertical scroll ── */}
      <div
        className={
          isFullscreen
            ? 'flex-1 overflow-auto rounded-sm border border-slate-200 shadow-xs bg-white'
            : 'table-responsive rounded-sm border border-slate-200 shadow-xs bg-white overflow-x-auto max-h-[75vh]'
        }
      >
        <table className="min-w-max w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
          {/* ── Head ── */}
          <thead>
            <tr className="bg-blue-950 text-white font-semibold text-nowrap whitespace-nowrap sticky top-0 z-30">
              {/* Column 1: Sticky No. column */}
              <th className="p-3 text-center w-11 min-w-[44px] max-w-[44px] border-r border-blue-900 sticky left-0 top-0 z-40 bg-blue-950">
                No
              </th>
              {/* Column 2: Sticky Contents column */}
              <th className="p-3 border-r-2 border-blue-800 min-w-[210px] md:min-w-[240px] sticky left-[44px] top-0 z-40 bg-blue-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                Contents (หัวข้อการตรวจประเมิน)
              </th>
              <th className="p-2 text-center w-14 border-r border-blue-900">NA</th>
              <th className="p-2 text-center w-16 border-r border-blue-900">Missing</th>
              {/* Criteria 1-7 */}
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <th key={n} className="p-2 text-center w-12 border-r border-blue-900">
                  เกณฑ์ {n}
                </th>
              ))}
              <th className="p-2 text-center w-16 border-r border-blue-900 text-pink-300">+1</th>
              <th className="p-2 text-center w-16 border-r border-blue-900 text-amber-300">-1</th>
              <th className="p-2 text-center w-16 border-r border-blue-900">เต็ม</th>
              <th className="p-2 text-center w-16 border-r border-blue-900 bg-pink-600 text-white">
                ได้
              </th>
              <th className="p-3 min-w-[130px]">หมายเหตุ</th>
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => {
              const { rowSum, rowFull } = getRowCalc(row);
              const locked = row.naSelected || row.missingSelected;

              const rowBg = row.naSelected
                ? 'bg-slate-100/60 opacity-60'
                : row.isSubRow
                  ? 'bg-slate-50/40'
                  : '';

              const cellBg = row.naSelected
                ? 'bg-slate-100'
                : row.isSubRow
                  ? 'bg-slate-50'
                  : 'bg-white';

              return (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-50/80 transition-colors ${rowBg}`}
                >
                  {/* Column 1: No — sticky left-0 */}
                  <td
                    className={`p-2.5 text-center font-semibold text-slate-700 border-r border-slate-200 sticky left-0 z-20 w-11 min-w-[44px] max-w-[44px] ${cellBg}`}
                  >
                    {row.no}
                  </td>

                  {/* Column 2: Content name + optional date — sticky left-[44px] */}
                  <td
                    className={`p-2.5 text-left font-medium text-blue-950 border-r-2 border-slate-300 sticky left-[44px] z-20 min-w-[210px] md:min-w-[240px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${cellBg}`}
                  >
                    <div className="flex flex-col items-start text-left leading-tight">
                      {isPsychiatric && (row.id === 'c6' || row.no === 6) ? (
                        <>
                          <span className="font-semibold text-slate-800">Operative note*</span>
                          <span className="text-[11px] font-semibold text-purple-600 mt-0.5">
                            ECT / Psychosocial intervention
                          </span>
                        </>
                      ) : isPsychiatric && (row.id === 'c8' || row.no === 8) ? (
                        <>
                          <span className="font-semibold text-slate-800">Rehabilitation record*</span>
                          <span className="text-[11px] font-semibold text-purple-600 mt-0.5">
                            ผู้ป่วยจิตเวช
                          </span>
                        </>
                      ) : row.contentName.includes('\n') ? (
                        <>
                          <span className="font-semibold text-slate-800">
                            {row.contentName.split('\n')[0]}
                          </span>
                          <span className="text-[11px] font-semibold text-purple-600 mt-0.5">
                            {row.contentName.split('\n')[1]}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold text-slate-800">
                          {row.contentName}
                        </span>
                      )}
                      {row.isSubRow && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <label className="text-xs text-slate-500 font-normal shrink-0">วันที่:</label>
                          <input
                            type="date"
                            disabled={isReadOnly}
                            value={row.dateStr || ''}
                            onChange={(e) =>
                              useUnifiedAuditStore.getState().setRowDate(row.id, e.target.value)
                            }
                            className={`px-2 py-1 text-xs border border-slate-300 rounded-sm bg-white text-slate-800 transition-colors ${
                              isReadOnly ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* NA */}
                  <td className="p-2 text-center border-r border-slate-200">
                    {row.canNA ? (
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => toggleRowNA(row.id)}
                        className={`w-7 h-7 rounded-sm font-bold text-xs border transition-colors ${row.naSelected
                          ? 'bg-slate-600 border-slate-600 text-white'
                          : isReadOnly
                            ? 'bg-white border-slate-200 text-slate-300 cursor-default'
                            : 'bg-white border-slate-300 text-slate-400 hover:border-slate-500 cursor-pointer'
                          }`}
                        title="NA — ไม่มีการให้บริการ"
                      >
                        {row.naSelected ? '✓' : ''}
                      </button>
                    ) : (
                      <span className="text-slate-300 select-none">—</span>
                    )}
                  </td>

                  {/* Missing */}
                  <td className="p-2 text-center border-r border-slate-200">
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => toggleRowMissing(row.id)}
                      className={`w-7 h-7 rounded-sm font-bold text-xs border transition-colors ${row.missingSelected
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : isReadOnly
                          ? 'bg-white border-slate-200 text-slate-300 cursor-default'
                          : 'bg-white border-slate-300 text-slate-400 hover:border-amber-400 cursor-pointer'
                        }`}
                      title="Missing — เอกสารสูญหาย/ไม่ครบ"
                    >
                      {row.missingSelected ? 'M' : ''}
                    </button>
                  </td>

                  {/* Criteria 1-7 */}
                  {row.scores.map((score, ci) => (
                    <td key={ci} className="p-1.5 text-center border-r border-slate-200">
                      <button
                        type="button"
                        disabled={locked || isReadOnly}
                        onClick={() => {
                          const next: ScoreValue =
                            score === null ? '1' :
                              score === '1' ? '0' :
                                score === '0' ? 'NA' : null;
                          setCriteriaScore(row.id, ci, next);
                        }}
                        className={`w-7 h-7 rounded-sm text-xs font-semibold border transition-all ${scoreStyle(score, locked, isReadOnly)}`}
                        title={`เกณฑ์ ${ci + 1}: ${score ?? '-'}`}
                      >
                        {score ?? '—'}
                      </button>
                    </td>
                  ))}

                  {/* +1 Add score */}
                  <td className="p-2 text-center border-r border-slate-200">
                    {row.hasAddScore ? (
                      <button
                        type="button"
                        disabled={locked || isReadOnly}
                        onClick={() => setAddScore(row.id, 1)}
                        className={`w-7 h-7 rounded-sm text-xs font-bold border transition-colors ${row.addScore === 1
                          ? 'bg-pink-600 border-pink-600 text-white'
                          : isReadOnly
                            ? 'bg-white border-slate-200 text-slate-300 cursor-default'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-pink-300 cursor-pointer'
                          }`}
                        title="+1 คะแนนพิเศษ"
                      >
                        {row.addScore === 1 ? '+1' : '0'}
                      </button>
                    ) : (
                      <span className="text-slate-300 select-none">—</span>
                    )}
                  </td>

                  {/* -1 Deduct score */}
                  <td className="p-2 text-center border-r border-slate-200">
                    {row.hasAddScore || row.no !== 0 ? (
                      <button
                        type="button"
                        disabled={locked || isReadOnly}
                        onClick={() => setDeductScore(row.id, 1)}
                        className={`w-7 h-7 rounded-sm text-xs font-bold border transition-colors ${row.deductScore === 1
                          ? 'bg-amber-600 border-amber-600 text-white'
                          : isReadOnly
                            ? 'bg-white border-slate-200 text-slate-300 cursor-default'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-amber-300 cursor-pointer'
                          }`}
                        title="-1 หักคะแนน"
                      >
                        {row.deductScore === 1 ? '-1' : '0'}
                      </button>
                    ) : (
                      <span className="text-slate-300 select-none">—</span>
                    )}
                  </td>

                  {/* Full score */}
                  <td className="p-2.5 text-center font-semibold text-slate-700 border-r border-slate-200 bg-slate-50">
                    {rowFull}
                  </td>

                  {/* Sum score */}
                  <td className="p-2.5 text-center font-bold text-pink-700 border-r border-slate-200 bg-pink-50/50">
                    {rowSum}
                  </td>

                  {/* Remark */}
                  <td className="p-1.5">
                    <input
                      type="text"
                      disabled={isReadOnly}
                      readOnly={isReadOnly}
                      placeholder={
                        row.hasAddScore && row.addScore === 1
                          ? '+1 คะแนนพิเศษ'
                          : row.no === 8
                            ? isPsychiatric ? 'ผู้ป่วยจิตเวช' : 'Rehabilitation (*จิตเวช)'
                            : 'ระบุหมายเหตุ...'
                      }
                      value={row.remarkText ?? (row.hasAddScore && row.addScore === 1 ? '+1 คะแนนพิเศษ' : '')}
                      onChange={(e) =>
                        useUnifiedAuditStore.getState().setRowRemark(row.id, e.target.value)
                      }
                      className={`w-full px-2 py-1 text-[11px] rounded-sm transition-colors ${
                        isReadOnly
                          ? 'border border-transparent bg-transparent text-slate-600 cursor-default'
                          : row.hasAddScore && row.addScore === 1
                            ? 'border border-pink-300 bg-pink-50/40 text-pink-700 font-medium placeholder:text-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:bg-white'
                            : 'border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500'
                        }`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* ── Footer summary ── */}
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300 sticky bottom-0 z-20">
              <td
                colSpan={2}
                className="p-3 text-center border-r-2 border-slate-300 text-xs bg-slate-100 sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
              >
                สรุปผลการประเมิน
              </td>
              <td colSpan={11} className="p-3 text-right border-r border-slate-200 text-xs bg-slate-100">
                คะแนนเต็ม
              </td>
              <td className="p-3 text-center text-sm font-extrabold text-blue-950 border-r border-slate-200 bg-slate-100">
                {fullScore}
              </td>
              <td className="p-3 text-center text-sm font-extrabold text-pink-700 border-r border-slate-200 bg-pink-100/60">
                {sumScore}
              </td>
              <td className="p-3 text-xs text-slate-600 bg-slate-100">
                คะแนนที่ได้ ({percentage.toFixed(1)}%)
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
