'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useIpdAuditStore } from '@/store/useIpdAuditStore';
import { useAuthStore } from '@/store/useAuthStore';
import { RBAC } from '@/lib/rbac';
import { ScoreValue, allIpdCriteriaList } from '@/lib/mra-ipd-types';
import { Maximize2, Minimize2, TableProperties, BedDouble, Table, Table2 } from 'lucide-react';

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

export function IpdTableView() {
  const {
    rows,
    caseType,
    currentAn,
    hn,
    patientName,
    toggleRowNA,
    toggleRowMissing,
    toggleRowNo,
    setCriteriaScore,
    setDeductScore,
    setRowRemark,
    calculateTotals,
  } = useIpdAuditStore();

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

  // Default check NA for Labour record (ipd_c10) upon entering psychiatric mode
  const prevCaseTypeRef = useRef<string | null>(null);
  useEffect(() => {
    if (caseType === 'psychiatric' && prevCaseTypeRef.current !== 'psychiatric') {
      useIpdAuditStore.setState((state) => ({
        rows: state.rows.map((r) =>
          r.id === 'ipd_c10'
            ? {
              ...r,
              naSelected: true,
              missingSelected: false,
              noSelected: false,
              scores: Array(r.maxCriteria).fill(null),
            }
            : r
        ),
      }));
    }
    prevCaseTypeRef.current = caseType;
  }, [caseType]);

  const getRowCalc = (row: typeof rows[0]) => {
    if (row.naSelected) return { rowSum: 0, rowFull: 0 };
    if (row.missingSelected || row.noSelected) return { rowSum: 0, rowFull: row.maxCriteria };

    let sum = 0;
    let full = 0;
    row.scores.forEach((s) => {
      if (s === '1') {
        sum += 1;
        full += 1;
      } else if (s === '0' || s === 'M') {
        full += 1;
      }
    });
    if (row.hasDeductScore && row.deductScore > 0) {
      sum -= row.deductScore;
    }
    if (sum < 0) sum = 0;
    return { rowSum: sum, rowFull: full };
  };

  // Helper to find criteria info
  const getCriteriaInfo = (rowId: string, criteriaIndex: number) => {
    return allIpdCriteriaList.find(
      (c) => c.rowId === rowId && c.criteriaIndex === criteriaIndex
    );
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
              <Table2 size={16} className="text-blue-900" />
              <span className="font-bold text-xs sm:text-sm text-blue-950">
                ตารางตรวจประเมิน IPD
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            {currentAn && (
              <span className="text-xs font-bold text-blue-950 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200">
                AN: {currentAn}
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
            {caseType === 'psychiatric' ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-purple-50 text-purple-700 border border-purple-200">
                จิตเวช IPD
              </span>
            ) : caseType === 'general' ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-xs bg-slate-100 text-slate-700 border border-slate-200">
                สามัญทั่วไป
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-xs bg-amber-50 text-amber-800 border border-amber-200">
                เฉพาะทาง ({caseType})
              </span>
            )}
          </div>

          {/* Right: Live Score & Minimize Button */}
          <div className="flex items-center gap-2.5 ml-auto">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-sm border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">คะแนนรวม</span>
              <span className="font-bold text-blue-900">{sumScore} / {fullScore}</span>
              <span className="text-slate-400">({percentage.toFixed(1)}%)</span>
              {isPassed ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-xs">
                  ผ่านเกณฑ์
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
              <Table2 size={15} className="text-blue-900" />
              <span>ตารางตรวจประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยใน (IPD)</span>
            </span>
            {caseType === 'psychiatric' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-purple-50 text-purple-700 border border-purple-200">
                เกณฑ์จิตเวช IPD
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
          ← เลื่อนซ้าย/ขวาเพื่อดูตารางประเมิน IPD ทั้งหมด →
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
              <th className="p-3 border-r-2 border-blue-800 min-w-[240px] md:min-w-[270px] sticky left-[44px] top-0 z-40 bg-blue-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-semibold text-white">Contents</span>
                  <span className="text-[11px] font-normal text-blue-200 mt-0.5">
                    หมวดการตรวจประเมินผู้ป่วยใน IPD
                  </span>
                </div>
              </th>
              <th className="p-2 text-center w-12 border-r border-blue-900" title="Not Applicable (ไม่มีการให้บริการในหมวดนี้)">
                NA
              </th>
              <th className="p-2 text-center w-14 border-r border-blue-900" title="Missing (เอกสารสูญหายหรือไม่พบการบันทึก)">
                Missing
              </th>
              <th className="p-2 text-center w-12 border-r border-blue-900 text-rose-300" title="No (มีเอกสารแต่ไม่มีการบันทึกตามคู่มือ สปสช.)">
                No
              </th>
              {/* Criteria 1-9 ตามคู่มือ สปสช. หน้า 68 */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <th key={n} className="p-2 text-center w-12 border-r border-blue-900">
                  เกณฑ์ {n}
                </th>
              ))}
              <th className="p-2 text-center w-14 border-r border-blue-900 text-amber-300" title="หักคะแนน (-1) เฉพาะหมวด Nurses' note">
                หัก
              </th>
              <th className="p-2 text-center w-14 border-r border-blue-900">เต็ม</th>
              <th className="p-2 text-center w-14 border-r border-blue-900 bg-blue-700 text-white">
                ได้
              </th>
              <th className="p-3 min-w-[150px]">หมายเหตุ</th>
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => {
              const { rowSum, rowFull } = getRowCalc(row);
              const locked = row.naSelected || row.missingSelected || row.noSelected;

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

                  {/* Column 2: Content name — sticky left-[44px] */}
                  <td
                    className={`p-2.5 text-left font-medium text-blue-950 border-r-2 border-slate-300 sticky left-[44px] z-20 min-w-[240px] md:min-w-[270px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${cellBg}`}
                  >
                    <div className="flex flex-col items-start text-left leading-tight">
                      {(() => {
                        const match = row.contentName.match(/^([^(]+?)\s*\(([^)]+)\)$/);
                        if (match) {
                          return (
                            <>
                              <span className="font-semibold text-slate-800">{match[1].trim()}</span>
                              <span className="text-[11px] font-normal text-slate-600 mt-0.5">
                                {match[2].trim()}
                              </span>
                            </>
                          );
                        }
                        if (row.contentName.includes('\n')) {
                          const parts = row.contentName.split('\n');
                          return (
                            <>
                              <span className="font-semibold text-slate-800">{parts[0].trim()}</span>
                              <span className="text-[11px] font-normal text-slate-600 mt-0.5">
                                {parts[1].replace(/^\(/, '').replace(/\)$/, '').trim()}
                              </span>
                            </>
                          );
                        }
                        return (
                          <span className="font-semibold text-slate-800">
                            {row.contentName}
                          </span>
                        );
                      })()}
                      {caseType === 'psychiatric' && row.id === 'ipd_c10' && (
                        <span className="text-[10px] font-normal text-purple-600 mt-0.5">
                          เกณฑ์จิตเวชไม่มีการประเมินหมวดนี้ (NA)
                        </span>
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
                        title="NA — ไม่มีการให้บริการในหมวดนี้"
                      >
                        {row.naSelected ? '✓' : ''}
                      </button>
                    ) : (
                      <span className="text-slate-300 select-none font-bold">—</span>
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
                      title="Missing — เอกสารสูญหาย / ไม่พบในเวชระเบียน"
                    >
                      {row.missingSelected ? 'M' : ''}
                    </button>
                  </td>

                  {/* No (ไม่มีการบันทึกตามคู่มือ สปสช.) */}
                  <td className="p-2 text-center border-r border-slate-200">
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => toggleRowNo(row.id)}
                      className={`w-7 h-7 rounded-sm font-bold text-xs border transition-colors ${row.noSelected
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : isReadOnly
                          ? 'bg-white border-slate-200 text-slate-300 cursor-default'
                          : 'bg-white border-slate-300 text-slate-400 hover:border-rose-400 hover:text-rose-600 cursor-pointer'
                        }`}
                      title="No — มีเอกสารในแฟ้ม แต่ไม่มีการบันทึกรายละเอียด (ให้ 0 ทุกเกณฑ์ตามคู่มือ สปสช. หน้า 52)"
                    >
                      {row.noSelected ? 'No' : ''}
                    </button>
                  </td>

                  {/* Criteria 1-9 */}
                  {Array.from({ length: 9 }).map((_, ci) => {
                    if (ci < row.maxCriteria) {
                      const score = row.scores[ci];
                      const crit = getCriteriaInfo(row.id, ci);
                      return (
                        <td key={ci} className="p-1.5 text-center border-r border-slate-200">
                          <button
                            type="button"
                            disabled={locked || isReadOnly}
                            onClick={() => {
                              const canNA = crit?.canBeNA ?? false;
                              const next: ScoreValue =
                                score === null
                                  ? '1'
                                  : score === '1'
                                    ? '0'
                                    : score === '0'
                                      ? canNA ? 'NA' : null
                                      : null;
                              setCriteriaScore(row.id, ci, next);
                            }}
                            className={`w-7 h-7 rounded-sm text-xs font-semibold border transition-all ${scoreStyle(
                              score,
                              locked,
                              isReadOnly
                            )}`}
                            title={
                              crit
                                ? `เกณฑ์ที่ ${ci + 1}: ${crit.title}\nคำอธิบาย: ${crit.description} (${score ?? '-'})`
                                : `เกณฑ์ ${ci + 1}`
                            }
                          >
                            {score ?? '—'}
                          </button>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={ci}
                        className="p-1.5 text-center border-r border-slate-200 bg-slate-50/70 text-slate-300 select-none text-[11px]"
                      >
                        —
                      </td>
                    );
                  })}

                  {/* -1 Deduct score (เฉพาะหมวด 12: Nurses' note) */}
                  <td className="p-2 text-center border-r border-slate-200">
                    {row.hasDeductScore ? (
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
                        title="หัก 1 คะแนน ในกรณีบันทึกไม่ต่อเนื่องทุกวันทุกเวร (คู่มือ สปสช. หน้า 53)"
                      >
                        {row.deductScore === 1 ? '-1' : '0'}
                      </button>
                    ) : (
                      <span className="text-slate-300 select-none font-bold">—</span>
                    )}
                  </td>

                  {/* Full score */}
                  <td className="p-2.5 text-center font-semibold text-slate-700 border-r border-slate-200 bg-slate-50">
                    {rowFull}
                  </td>

                  {/* Sum score */}
                  <td className="p-2.5 text-center font-bold text-blue-900 border-r border-slate-200 bg-blue-50/50">
                    {rowSum}
                  </td>

                  {/* Remark */}
                  <td className="p-1.5">
                    <input
                      type="text"
                      disabled={isReadOnly}
                      readOnly={isReadOnly}
                      placeholder={
                        row.deductScore === 1
                          ? 'หัก 1 คะแนน (บันทึกไม่ต่อเนื่อง)'
                          : caseType === 'psychiatric' && row.id === 'ipd_c10'
                            ? 'ไม่มีในเกณฑ์จิตเวช - NA'
                            : 'ระบุหมายเหตุ...'
                      }
                      value={row.remarkText ?? ''}
                      onChange={(e) => setRowRemark(row.id, e.target.value)}
                      className={`w-full px-2 py-1 text-[11px] rounded-sm transition-colors ${
                        isReadOnly
                          ? 'border border-transparent bg-transparent text-slate-600 cursor-default'
                          : 'border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-900'
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
              <td colSpan={13} className="p-3 text-right border-r border-slate-200 text-xs bg-slate-100">
                คะแนนเต็ม
              </td>
              <td className="p-3 text-center text-sm font-extrabold text-blue-950 border-r border-slate-200 bg-slate-100">
                {fullScore}
              </td>
              <td className="p-3 text-center text-sm font-extrabold text-blue-900 border-r border-slate-200 bg-blue-100/60">
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
