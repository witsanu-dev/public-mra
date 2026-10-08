'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { initialAuditTableRows, AuditTableRow, ScoreValue } from '@/lib/mra-table-types';
import { alertConfirm, alertSuccess } from '@/lib/mra-alert';
import { Save, Printer, RefreshCw, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export default function OpdTableAuditPage() {
  const { user } = useAuthStore();
  const [hcode, setHcode] = useState('');
  const [hname, setHname] = useState('');
  const [hn, setHn] = useState('');
  const [pid, setPid] = useState('');
  const [caseType, setCaseType] = useState<'general' | 'chronic'>('general');
  const [diagnosis, setDiagnosis] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [chronicPeriodFrom, setChronicPeriodFrom] = useState('');
  const [chronicPeriodTo, setChronicPeriodTo] = useState('');
  const [firstVisitDate, setFirstVisitDate] = useState('');

  const [overallFinding, setOverallFinding] = useState<'inadequate' | 'no_issue' | 'certain_issues' | null>('no_issue');
  const [certainIssueRemarks, setCertainIssueRemarks] = useState('');
  const [auditorName, setAuditorName] = useState('');
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);

  // Auto-fill auditorName from active session
  useEffect(() => {
    if (user?.fullName && (!auditorName || auditorName === 'นพ. ตรวจสอบ เวชระเบียน')) {
      setAuditorName(user.fullName);
    }
  }, [user, auditorName]);

  const [rows, setRows] = useState<AuditTableRow[]>(initialAuditTableRows);

  // Toggle NA for entire content row
  const toggleRowNA = (rowId: string) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        const nextVal = !r.naSelected;
        return {
          ...r,
          naSelected: nextVal,
          missingSelected: nextVal ? false : r.missingSelected,
          scores: nextVal ? [null, null, null, null, null, null, null] : r.scores,
        };
      })
    );
  };

  // Toggle Missing for entire content row
  const toggleRowMissing = (rowId: string) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        const nextVal = !r.missingSelected;
        return {
          ...r,
          missingSelected: nextVal,
          naSelected: nextVal ? false : r.naSelected,
          scores: nextVal ? ['0', '0', '0', '0', '0', '0', '0'] : r.scores,
        };
      })
    );
  };

  // Change individual criteria score
  const setCriteriaScore = (rowId: string, index: number, val: ScoreValue) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        const newScores = [...r.scores] as AuditTableRow['scores'];
        newScores[index] = r.scores[index] === val ? null : val;
        return {
          ...r,
          scores: newScores,
          naSelected: false,
          missingSelected: false,
        };
      })
    );
  };

  // Set Add score (+1)
  const setAddScore = (rowId: string, val: number) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id === rowId) {
          const nextAdd = r.addScore === val ? 0 : val;
          let nextRemark = r.remarkText;
          if (nextAdd === 1 && (!r.remarkText || r.remarkText.trim() === '')) {
            nextRemark = '+1 คะแนนพิเศษ';
          } else if (nextAdd === 0 && r.remarkText === '+1 คะแนนพิเศษ') {
            nextRemark = '';
          }
          return { ...r, addScore: nextAdd, remarkText: nextRemark };
        }
        return r;
      })
    );
  };

  // Set Deduct score (-1)
  const setDeductScore = (rowId: string, val: number) => {
    setRows(prev =>
      prev.map(r => (r.id === rowId ? { ...r, deductScore: r.deductScore === val ? 0 : val } : r))
    );
  };

  // Set Row Date (Follow up date)
  const setRowDate = (rowId: string, dateStr: string) => {
    setRows(prev =>
      prev.map(r => (r.id === rowId ? { ...r, dateStr } : r))
    );
  };

  // Calculate row scores
  const getRowCalculations = (row: AuditTableRow) => {
    if (row.naSelected) {
      return { rowSum: 0, rowFull: 0 };
    }
    if (row.missingSelected) {
      return { rowSum: 0, rowFull: 7 };
    }

    let sum = 0;
    let full = 0;

    row.scores.forEach(s => {
      if (s === '1') {
        sum += 1;
        full += 1;
      } else if (s === '0' || s === 'M') {
        full += 1;
      }
      // 'NA' does not count towards full score
    });

    sum += row.addScore;
    sum -= row.deductScore;
    if (sum < 0) sum = 0;

    return { rowSum: sum, rowFull: full };
  };

  // Total Scores
  let totalSumScore = 0;
  let totalFullScore = 0;

  rows.forEach(r => {
    const { rowSum, rowFull } = getRowCalculations(r);
    totalSumScore += rowSum;
    totalFullScore += rowFull;
  });

  const percentage = totalFullScore > 0 ? (totalSumScore / totalFullScore) * 100 : 0;
  const minRequiredScore = caseType === 'general' ? 14 : 18;

  const handleReset = async () => {
    const ok = await alertConfirm({
      title: 'รีเซ็ตข้อมูลในแบบฟอร์ม?',
      text: 'ผลการตรวจประเมินทั้งหมดจะถูกล้าง และไม่สามารถกู้คืนได้',
      confirmText: 'รีเซ็ต',
      cancelText: 'ยกเลิก',
      icon: 'warning',
      danger: true,
    });
    if (ok) {
      setRows(initialAuditTableRows);
      alertSuccess('ล้างข้อมูลสำเร็จ', 'ผลการตรวจประเมินถูกรีเซ็ตเรียบร้อยแล้ว');
    }
  };

  const handleSave = () => {
    alertSuccess(
      'บันทึกผลการประเมินสำเร็จ',
      `คะแนนรวม ${totalSumScore}/${totalFullScore} คะแนน (${percentage.toFixed(2)}%)`
    );
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-sm border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-sm bg-pink-50 text-pink-700 border border-pink-200 inline-block mb-1">
            มาตรฐาน สปสช. หน้า 39
          </span>
          <h1 className="text-xl font-bold text-blue-950">
            แบบตรวจประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยนอก/ฉุกเฉิน (OPD/ER)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Medical Record Audit Form (OPD/ER) — รูปแบบตารางลงบันทึกการประเมิน
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} />
            <span>ล้างข้อมูล</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-sm hover:bg-blue-100 transition-colors"
          >
            <Printer size={14} />
            <span>พิมพ์แบบฟอร์ม</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-900 hover:bg-blue-950 rounded-sm transition-colors shadow-xs"
          >
            <Save size={14} />
            <span>บันทึกการประเมิน</span>
          </button>
        </div>
      </div>

      {/* Part 1: Hospital & Patient Info Header (Header of Form Page 39) */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">รหัสสถานบริการ</label>
              <Input
                placeholder="เช่น 10702"
                value={hcode}
                onChange={e => setHcode(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">ชื่อสถานบริการ</label>
              <Input
                placeholder="เช่น รพ.ศูนย์การแพทย์..."
                value={hname}
                onChange={e => setHname(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">เลขประจำตัวผู้ป่วย (HN)</label>
              <Input
                placeholder="HN ผู้ป่วย"
                value={hn}
                onChange={e => setHn(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">เลขบัตรประชาชน (PID)</label>
              <Input
                placeholder="13 หลัก"
                value={pid}
                onChange={e => setPid(e.target.value)}
              />
            </div>
          </div>

          {/* Case Type Selector & Case Specific fields */}
          <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="caseTypeOption"
                  checked={caseType === 'general'}
                  onChange={() => setCaseType('general')}
                  className="text-pink-600 focus:ring-pink-500 w-4 h-4"
                />
                <span className="font-semibold text-blue-950">General case</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="caseTypeOption"
                  checked={caseType === 'chronic'}
                  onChange={() => setCaseType('chronic')}
                  className="text-pink-600 focus:ring-pink-500 w-4 h-4"
                />
                <span className="font-semibold text-blue-950">Chronic case</span>
              </label>
            </div>

            {/* Dynamic fields based on case */}
            {caseType === 'general' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-xl">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Diagnosis (การวินิจฉัยโรค)
                  </label>
                  <Input
                    placeholder="ระบุการวินิจฉัยโรค"
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Visit Date (ว/ด/ป ที่รับบริการ)
                  </label>
                  <Input
                    type="date"
                    value={visitDate}
                    onChange={e => setVisitDate(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end flex-1">
                {/* 1. Diagnosis */}
                <div className="lg:col-span-4">
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Diagnosis (โรคเรื้อรัง)
                  </label>
                  <Input
                    placeholder="ระบุการวินิจฉัยโรคเรื้อรัง"
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                  />
                </div>

                {/* 2. ช่วงเวลาตรวจประเมิน: จาก - ถึง */}
                <div className="lg:col-span-5">
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    ช่วงเวลาตรวจประเมิน (จาก – ถึง)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="date"
                        title="วันที่เริ่มต้นช่วงเวลาตรวจ (จาก)"
                        value={chronicPeriodFrom}
                        onChange={e => setChronicPeriodFrom(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <span className="text-xs text-slate-500 font-medium shrink-0">ถึง</span>
                    <div className="relative flex-1">
                      <Input
                        type="date"
                        title="วันที่สิ้นสุดช่วงเวลาตรวจ (ถึง)"
                        value={chronicPeriodTo}
                        onChange={e => setChronicPeriodTo(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. 1st Visit Date */}
                <div className="lg:col-span-3">
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    1st Visit Date (วันรับบริการครั้งแรก)
                  </label>
                  <Input
                    type="date"
                    title="วันที่รับบริการครั้งแรก"
                    value={firstVisitDate}
                    onChange={e => setFirstVisitDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Part 2: Evaluation Table (The Exact Table from Page 39) */}
      <div className="overflow-x-auto bg-white border border-slate-200 rounded-sm shadow-xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-blue-950 text-white border-b border-blue-900 font-semibold">
              <th className="p-3 text-center w-12 border-r border-blue-900">No</th>
              <th className="p-3 border-r border-blue-900 min-w-[200px]">Contents</th>
              <th className="p-2 text-center w-14 border-r border-blue-900">NA</th>
              <th className="p-2 text-center w-16 border-r border-blue-900">Missing</th>
              <th className="p-2 text-center w-12 border-r border-blue-900">เกณฑ์ 1</th>
              <th className="p-2 text-center w-12 border-r border-blue-900">เกณฑ์ 2</th>
              <th className="p-2 text-center w-12 border-r border-blue-900">เกณฑ์ 3</th>
              <th className="p-2 text-center w-12 border-r border-blue-900">เกณฑ์ 4</th>
              <th className="p-2 text-center w-12 border-r border-blue-900">เกณฑ์ 5</th>
              <th className="p-2 text-center w-12 border-r border-blue-900">เกณฑ์ 6</th>
              <th className="p-2 text-center w-12 border-r border-blue-900">เกณฑ์ 7</th>
              <th className="p-2 text-center w-16 border-r border-blue-900 text-pink-300">เพิ่ม (+1)</th>
              <th className="p-2 text-center w-16 border-r border-blue-900 text-amber-300">หัก (-1)</th>
              <th className="p-2 text-center w-16 border-r border-blue-900">คะแนนเต็ม</th>
              <th className="p-2 text-center w-16 border-r border-blue-900 bg-pink-700 text-white font-bold">
                คะแนนที่ได้
              </th>
              <th className="p-3 min-w-[120px]">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map(row => {
              const { rowSum, rowFull } = getRowCalculations(row);
              const isLocked = row.naSelected || row.missingSelected;

              return (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-50/80 transition-colors ${row.isSubRow ? 'bg-slate-50/40' : ''
                    } ${row.naSelected ? 'bg-slate-100/60 opacity-60' : ''}`}
                >
                  {/* No */}
                  <td className="p-2.5 text-center font-semibold text-slate-700 border-r border-slate-200">
                    {row.no}
                  </td>

                  {/* Content Name */}
                  <td className="p-2.5 text-left font-medium text-blue-950 border-r border-slate-200">
                    <div className="flex flex-col gap-1 items-start text-left">
                      {row.contentName.includes('\n') ? (
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
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <label className="text-xs text-slate-500 font-normal shrink-0">วันที่:</label>
                          <input
                            type="date"
                            value={row.dateStr || ''}
                            onChange={(e) => setRowDate(row.id, e.target.value)}
                            className="px-2 py-1 text-xs border border-slate-300 rounded-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 transition-colors cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* NA Column */}
                  <td className="p-2 text-center border-r border-slate-200">
                    {row.canNA ? (
                      <button
                        type="button"
                        onClick={() => toggleRowNA(row.id)}
                        className={`w-7 h-7 rounded-sm font-bold text-xs border transition-colors ${row.naSelected
                          ? 'bg-slate-600 border-slate-600 text-white'
                          : 'bg-white border-slate-300 text-slate-400 hover:border-slate-500'
                          }`}
                        title="กากบาทช่อง NA"
                      >
                        {row.naSelected ? '✓' : ''}
                      </button>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>

                  {/* Missing Column */}
                  <td className="p-2 text-center border-r border-slate-200">
                    <button
                      type="button"
                      onClick={() => toggleRowMissing(row.id)}
                      className={`w-7 h-7 rounded-sm font-bold text-xs border transition-colors ${row.missingSelected
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-white border-slate-300 text-slate-400 hover:border-amber-400'
                        }`}
                      title="กากบาทช่อง Missing (เอกสารสูญหาย/ไม่ครบ)"
                    >
                      {row.missingSelected ? 'M' : ''}
                    </button>
                  </td>

                  {/* Criteria 1 to 7 Buttons */}
                  {row.scores.map((score, cIndex) => {
                    const isPassed = score === '1';
                    const isFailed = score === '0';
                    const isNA = score === 'NA';

                    return (
                      <td
                        key={cIndex}
                        className="p-1.5 text-center border-r border-slate-200"
                      >
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            // Cycle score: null -> 1 -> 0 -> NA -> null
                            const nextScore: ScoreValue =
                              score === null
                                ? '1'
                                : score === '1'
                                  ? '0'
                                  : score === '0'
                                    ? 'NA'
                                    : null;
                            setCriteriaScore(row.id, cIndex, nextScore);
                          }}
                          className={`w-7 h-7 rounded-sm text-xs font-semibold border transition-all ${isLocked
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            : isPassed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : isFailed
                                ? 'bg-pink-600 border-pink-600 text-white'
                                : isNA
                                  ? 'bg-slate-500 border-slate-500 text-white'
                                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          title={`เกณฑ์ ${cIndex + 1}: คลิกเพื่อเปลี่ยนสถานะ (1 / 0 / NA)`}
                        >
                          {score ?? '-'}
                        </button>
                      </td>
                    );
                  })}

                  {/* Add Score */}
                  <td className="p-2 text-center border-r border-slate-200">
                    {row.hasAddScore ? (
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => setAddScore(row.id, 1)}
                        className={`w-7 h-7 rounded-sm text-xs font-bold border transition-colors ${row.addScore === 1
                          ? 'bg-pink-600 border-pink-600 text-white'
                          : 'bg-white border-slate-200 text-slate-400 hover:border-pink-300'
                          }`}
                        title="+1 คะแนน (เช่น PI ครบ 5W2H หรือระบุยานอกบัญชีฯ)"
                      >
                        {row.addScore === 1 ? '+1' : '0'}
                      </button>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>

                  {/* Deduct Score */}
                  <td className="p-2 text-center border-r border-slate-200">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setDeductScore(row.id, 1)}
                      className={`w-7 h-7 rounded-sm text-xs font-bold border transition-colors ${row.deductScore === 1
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-amber-300'
                        }`}
                      title="-1 หักคะแนน"
                    >
                      {row.deductScore === 1 ? '-1' : '0'}
                    </button>
                  </td>

                  {/* Full Score */}
                  <td className="p-2.5 text-center font-semibold text-slate-700 border-r border-slate-200 bg-slate-50">
                    {rowFull}
                  </td>

                  {/* Sum Score */}
                  <td className="p-2.5 text-center font-bold text-pink-700 border-r border-slate-200 bg-pink-50/50">
                    {rowSum}
                  </td>

                  {/* Note */}
                  <td className="p-1.5">
                    <input
                      type="text"
                      placeholder={
                        row.hasAddScore && row.addScore === 1
                          ? '+1 คะแนนพิเศษ'
                          : row.no === 8
                            ? 'Rehabilitation (*จิตเวช)'
                            : 'ระบุหมายเหตุ...'
                      }
                      value={row.remarkText ?? (row.hasAddScore && row.addScore === 1 ? '+1 คะแนนพิเศษ' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, remarkText: val } : r));
                      }}
                      className={`w-full px-2 py-1 text-[11px] rounded-sm transition-colors ${row.hasAddScore && row.addScore === 1
                        ? 'border border-pink-300 bg-pink-50/40 text-pink-700 font-medium placeholder:text-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:bg-white'
                        : 'border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500'
                        }`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Table Footer: Summary */}
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
              <td colSpan={13} className="p-3 text-right border-r border-slate-200">
                คะแนนเต็มรวม
              </td>
              <td className="p-3 text-center text-sm font-extrabold text-blue-950 border-r border-slate-200">
                {totalFullScore}
              </td>
              <td className="p-3 text-center text-sm font-extrabold text-pink-700 border-r border-slate-200 bg-pink-100/60">
                {totalSumScore}
              </td>
              <td className="p-3 text-xs text-slate-600">
                คะแนนที่ได้
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Part 3: Overall Finding & Signature Section (Page 39 Footer) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left: Overall Finding Options */}
        <Card className="md:col-span-2">
          <CardHeader className="bg-slate-50 pb-3">
            <CardTitle className="text-sm font-bold text-blue-950">
              ประเมินคุณภาพการบันทึกเวชระเบียนในภาพรวม (Overall finding) — เลือกเพียง 1 ข้อ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="overallFindingRadio"
                checked={overallFinding === 'inadequate'}
                onChange={() => setOverallFinding('inadequate')}
                className="mt-0.5 text-pink-600 focus:ring-pink-500"
              />
              <span>
                <strong>Documentation inadequate for meaningful review</strong> (ข้อมูลไม่เพียงพอสำหรับการทบทวน)
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="overallFindingRadio"
                checked={overallFinding === 'no_issue'}
                onChange={() => setOverallFinding('no_issue')}
                className="mt-0.5 text-pink-600 focus:ring-pink-500"
              />
              <span>
                <strong>No significant medical record issue identified</strong> (ไม่มีปัญหาสลักสำคัญจากการทบทวน)
              </span>
            </label>

            <div className="space-y-2">
              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="overallFindingRadio"
                  checked={overallFinding === 'certain_issues'}
                  onChange={() => setOverallFinding('certain_issues')}
                  className="mt-0.5 text-pink-600 focus:ring-pink-500"
                />
                <span>
                  <strong>Certain issues in question specify</strong> (มีปัญหาจากการทบทวนที่ต้องค้นต่อ)
                </span>
              </label>

              {overallFinding === 'certain_issues' && (
                <div className="pl-6">
                  <Input
                    placeholder="ระบุรายละเอียดของปัญหาที่ต้องค้นต่อ..."
                    value={certainIssueRemarks}
                    onChange={e => setCertainIssueRemarks(e.target.value)}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Summary Score Box & Auditor Sign */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="bg-pink-50/50 pb-3">
            <CardTitle className="text-sm font-bold text-pink-900">
              ผลสรุปคะแนนร้อยละ
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            <div className="text-center p-4 bg-slate-50 border border-slate-200 rounded-sm">
              <div className="text-4xl font-extrabold text-pink-600">
                {percentage.toFixed(2)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                คิดเป็นร้อยละ (Sum ÷ Full × 100)
              </div>
            </div>

            <div className="text-[11px] text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>เกณฑ์คะแนนเต็มขั้นต่ำ:</span>
                <strong>≥ {minRequiredScore} คะแนน</strong>
              </div>
              <div className="flex justify-between">
                <span>สถานะเกณฑ์:</span>
                <strong className={totalFullScore >= minRequiredScore ? 'text-emerald-700' : 'text-amber-700'}>
                  {totalFullScore >= minRequiredScore ? 'ผ่านเกณฑ์ขั้นต่ำ' : 'ต่ำกว่าเกณฑ์'}
                </strong>
              </div>
            </div>

            {/* Auditor Signature Inputs */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Audit by (ผู้ตรวจประเมิน)
                </label>
                <Input
                  value={auditorName}
                  onChange={e => setAuditorName(e.target.value)}
                  placeholder="ชื่อ-สกุล ผู้ตรวจประเมิน"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Audit Date (วันที่ตรวจประเมิน)
                </label>
                <Input
                  type="date"
                  value={auditDate}
                  onChange={e => setAuditDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── คำชี้แจงการบันทึกคะแนนในตาราง (ตามคู่มือหน้า 39) ── */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-sm text-xs text-slate-700 space-y-2 mt-2">
        <div className="flex items-center gap-1.5 font-bold text-blue-950 pb-1.5 border-b border-slate-200">
          <Info size={16} className="text-blue-900 shrink-0" />
          <span>คำชี้แจงการบันทึกคะแนนในตาราง</span>
        </div>
        <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-700">
          <p>
            <strong className="text-blue-950">การบันทึกช่อง NA:</strong> กรณีไม่จำเป็นต้องมีเอกสารใน Content ได้แก่ Follow up, Operative note, Informed consent, Rehabilitation record เนื่องจากไม่มีการให้บริการ ให้กากบาท ในช่อง NA
          </p>
          <p>
            <strong className="text-blue-950">การบันทึกช่อง Missing:</strong> กรณีไม่มีเอกสารให้ตรวจสอบ เวชระเบียนไม่ครบ หรือหายไป ให้กากบาทในช่อง Missing
          </p>
          <div>
            <strong className="text-blue-950">การบันทึกคะแนน:</strong>
            <span className="text-slate-600 ml-1">
              (1) กรณีที่ผ่านเกณฑ์ในแต่ละข้อ ให้ 1 คะแนน &nbsp;|&nbsp; (2) กรณีที่ไม่ผ่านเกณฑ์ในแต่ละข้อ ให้ 0 คะแนน &nbsp;|&nbsp; (3) กรณีไม่จำเป็นต้องมีบันทึก/ไม่มีข้อมูลในเกณฑ์ข้อใดข้อหนึ่งระบุให้มี NA ได้ ให้ NA
            </span>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600">หมายเหตุ:</span> Rehabilitation record * ใช้ในกรณีประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยจิตเวช (ผู้ป่วยนอก/ฉุกเฉิน)
        </div>
      </div>
    </div>
  );
}
