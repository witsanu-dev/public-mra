'use client';

import { apiUrl } from '@/lib/constants';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useUnifiedAuditStore } from '@/store/useUnifiedAuditStore';
import { OpdTableView } from '@/components/mra/OpdTableView';
import { OpdCriteriaView } from '@/components/mra/OpdCriteriaView';
import { alertConfirm, alertSuccess, alertWarning, alertError } from '@/lib/mra-alert';
import { useAuthStore } from '@/store/useAuthStore';
import { RBAC } from '@/lib/rbac';
import { SelectHisVisitModal } from '@/components/mra/SelectHisVisitModal';
import {
  Table,
  ListFilter,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  Shuffle,
  ArrowRight,
  X,
  DatabaseArrowDown,
  RotateCcw,
  XCircle,
  Brain,
} from 'lucide-react';

export default function OpdAuditPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'table' | 'criteria'>('table');
  const [isSelectVisitModalOpen, setIsSelectVisitModalOpen] = useState(false);

  const {
    hcode, hname, currentVn, currentSampleItemId, currentBatchId, patientName, hn, pid,
    caseType, isPsychiatric, setIsPsychiatric,
    diagnosis, visitDate,
    chronicPeriodFrom, chronicPeriodTo, firstVisitDate,
    overallFinding, certainIssueRemarks,
    auditorName, auditDate,
    rows,
    isExistingAudit,
    setField, resetAll, calculateTotals, initHospitalFromHis, revokeAudit,
  } = useUnifiedAuditStore();

  const { user } = useAuthStore();

  // Auto-load this installation's hospital code & name from its own HIS
  useEffect(() => {
    initHospitalFromHis();
  }, [initHospitalFromHis]);

  // Auto-fill auditorName from active session
  useEffect(() => {
    if (user?.fullName && (!auditorName || auditorName === 'นพ. ตรวจสอบ เวชระเบียน')) {
      setField('auditorName', user.fullName);
    }
  }, [user, auditorName, setField]);

  // Support direct linking from reports, sampling, or external URL via ?vn= or ?auditId= or ?batchId=
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlVn = params.get('vn');
      const urlAuditId = params.get('auditId');
      const urlBatchId = params.get('batchId');
      if (urlBatchId) {
        useUnifiedAuditStore.getState().setField('currentBatchId', urlBatchId);
      }
      if (urlVn && urlVn !== currentVn) {
        useUnifiedAuditStore.getState().loadExistingAudit(urlVn);
      } else if (urlAuditId && !currentVn) {
        useUnifiedAuditStore.getState().loadExistingAudit(urlAuditId);
      }
    }
  }, [currentVn]);

  const effectiveBatchId = currentBatchId || (currentSampleItemId ? currentSampleItemId.replace(/-[0-9]+$/, '') : null);

  const { sumScore, fullScore, percentage, isPassedMinScore, isPassed } = calculateTotals();

  const handleReset = async () => {
    const confirmed = await alertConfirm({
      title: 'รีเซ็ตผลการตรวจประเมิน?',
      text: 'ข้อมูลการประเมินทั้งหมดในชาร์ตนี้จะถูกล้าง และไม่สามารถกู้คืนได้',
      confirmText: 'รีเซ็ต',
      cancelText: 'ยกเลิก',
      icon: 'warning',
      danger: true,
    });
    if (confirmed) {
      resetAll();
      alertSuccess('ล้างข้อมูลสำเร็จ', 'ผลการตรวจประเมินถูกรีเซ็ตเรียบร้อยแล้ว');
    }
  };

  const handleRevokeThisAudit = async () => {
    if (!RBAC.canRevokeAudit(user?.role)) {
      alertWarning('ไม่มีสิทธิ์ดำเนินการ', 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถยกเลิกผลการตรวจประเมินได้');
      return;
    }

    const confirmed = await alertConfirm({
      title: 'ยกเลิกผลการตรวจประเมินเคสนี้?',
      text: `ต้องการยกเลิกผลการตรวจประเมินของ ${patientName || hn} (VN: ${currentVn}) ใช่หรือไม่? ข้อมูลคะแนนจะถูกลบออกจากฐานข้อมูล และสถานะของเคสนี้จะกลับเป็น "รอตรวจ"`,
      confirmText: 'ยกเลิกการตรวจ',
      cancelText: 'ย้อนกลับ',
      icon: 'warning',
      danger: true,
    });
    if (!confirmed) return;

    const ok = await revokeAudit();
    if (ok) {
      alertSuccess('ยกเลิกสำเร็จ', 'ยกเลิกผลการตรวจประเมินเรียบร้อยแล้ว สถานะกลับเป็นรอตรวจ');
    } else {
      alertError({ title: 'ยกเลิกไม่สำเร็จ', text: 'เกิดข้อผิดพลาดในการยกเลิกผลการตรวจ' });
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!RBAC.canSaveAudit(user?.role)) {
      alertWarning('ไม่มีสิทธิ์ดำเนินการ', 'สิทธิ์ Officer สามารถดูข้อมูลได้เท่านั้น ไม่สามารถบันทึกหรือแก้ไขผลการตรวจได้');
      return;
    }

    if (!auditorName.trim()) {
      alertWarning('กรุณาระบุชื่อผู้ตรวจประเมิน', 'ช่อง "Audit by" ต้องกรอกก่อนบันทึกผลการประเมิน');
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch(apiUrl('/api/mra/audit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: currentSampleItemId,
          vn: currentVn || hn,
          hn,
          pid,
          patientName,
          hcode,
          hname,
          caseType: isPsychiatric ? 'psychiatric' : caseType,
          isPsychiatric,
          diagnosis,
          visitDate,
          chronicPeriodFrom,
          chronicPeriodTo,
          firstVisitDate,
          sumScore,
          fullScore,
          percentage,
          isPassed: isPassed ? 1 : 0,
          overallFinding,
          certainIssueRemarks,
          auditorName,
          auditDate,
          rows: rows.map((r) => {
            let rSum = 0;
            let rFull = 0;
            if (r.missingSelected) {
              rFull = 7;
            } else if (!r.naSelected) {
              r.scores.forEach((s) => {
                if (s === '1') { rSum += 1; rFull += 1; }
                else if (s === '0' || s === 'M') { rFull += 1; }
              });
              rSum += r.addScore - r.deductScore;
              if (rSum < 0) rSum = 0;
            }
            return {
              no: r.no,
              name: r.contentName,
              naSelected: r.naSelected,
              missingSelected: r.missingSelected,
              scores: r.scores,
              addScore: r.addScore,
              deductScore: r.deductScore,
              rowSum: rSum,
              rowFull: rFull,
              remarkText: r.remarkText,
            };
          }),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      if (effectiveBatchId) {
        const goBack = await alertConfirm({
          title: 'บันทึกผลการประเมินสำเร็จ!',
          text: `บันทึกผลลงฐาน db_mra เรียบร้อย (รหัส: ${json.data.auditId}) • คะแนน ${sumScore}/${fullScore} (${percentage.toFixed(2)}%)\n\nต้องการกลับไปหน้ารายการสุ่ม (${effectiveBatchId}) เพื่อประเมินเคสอื่นต่อหรือไม่?`,
          confirmText: 'กลับไปหน้ารายการสุ่ม',
          cancelText: 'ดูผลประเมินเคสนี้ต่อ',
          icon: 'question',
        });
        if (goBack) {
          router.push(`/sampling?batchId=${encodeURIComponent(effectiveBatchId)}`);
          return;
        }
      } else {
        alertSuccess(
          'บันทึกผลการประเมินสำเร็จ!',
          `บันทึกผลลงฐาน db_mra เรียบร้อย (รหัส: ${json.data.auditId}) • คะแนนที่ได้ ${sumScore}/${fullScore} (${percentage.toFixed(2)}%)`
        );
      }
    } catch (err) {
      console.error('Error saving MRA audit:', err);
      alertError({
        title: 'บันทึกไม่สำเร็จ',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐาน db_mra',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Tab button class helper ── */
  const tabCls = (tab: 'table' | 'criteria') =>
    [
      'flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-semibold transition-all',
      'min-h-[var(--touch-min)]',
      activeTab === tab
        ? 'bg-pink-600 text-white shadow-xs'
        : 'text-slate-600 hover:text-blue-950',
    ].join(' ');

  return (
    <div className="section-gap">

      {/* ── 1. Page Header & Quick Actions ── */}
      <div className="bg-white p-4 md:p-5 rounded-sm border border-slate-200 shadow-xs space-y-4">
        {/* Title */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-sm bg-pink-50 text-pink-700 border border-pink-200">
              มาตรฐาน สปสช.
            </span>
            <span className="text-xs text-slate-700 font-semibold hidden sm:inline uppercase">
              Medical Record Audit Form <span className="text-slate-300 font-normal mx-1">|</span> <span className="text-pink-600 font-bold">OPD & ER</span>
            </span>
            {isPsychiatric && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-sm bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                <Brain size={13} className="text-purple-600" />
                <span>จิตเวช</span>
              </span>
            )}
          </div>
          <h1 className="text-lg md:text-xl font-bold text-blue-950 leading-snug">
            {isPsychiatric
              ? 'แบบตรวจประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยจิตเวช กรณีผู้ป่วยนอก/ฉุกเฉิน (OPD/ER)'
              : 'แบบตรวจประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยนอก/ฉุกเฉิน (OPD/ER)'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
            {isPsychiatric
              ? 'โครงสร้างการประเมิน 8 หมวด ตามคู่มือการประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยจิตเวช (ECT, Psychosocial intervention & Rehabilitation)'
              : 'โครงสร้างการประเมินมาตรฐาน 8 หมวด ตามคู่มือการประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยนอก'}
          </p>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="inline-flex rounded-sm border border-slate-200 bg-slate-100 p-1 gap-0.5">
            <button type="button" onClick={() => setActiveTab('table')} className={tabCls('table')}>
              <Table size={14} />
              <span>ตาราง</span>
            </button>
            <button type="button" onClick={() => setActiveTab('criteria')} className={tabCls('criteria')}>
              <ListFilter size={14} />
              <span>รายละเอียด</span>
            </button>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              type="button"
              onClick={() => setIsSelectVisitModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[var(--touch-min)] text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-sm shadow-xs transition-colors"
            >
              <DatabaseArrowDown size={14} />
              <span>ดึงข้อมูลจาก HIS</span>
            </button>
            <Link
              href="/sampling"
              className="flex items-center gap-1.5 px-3 py-2 min-h-[var(--touch-min)] text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 rounded-sm shadow-xs transition-colors"
            >
              <Shuffle size={13} />
              <span>สุ่มตรวจจาก HIS</span>
            </Link>
            {isExistingAudit && (
              <button
                type="button"
                onClick={handleRevokeThisAudit}
                disabled={!RBAC.canRevokeAudit(user?.role)}
                className="flex items-center gap-1.5 px-3 py-2 min-h-[var(--touch-min)] text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-sm hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-50 transition-colors"
                title="ยกเลิกผลการตรวจประเมินเคสนี้ และเปลี่ยนสถานะกลับเป็นรอตรวจ"
              >
                <XCircle size={13} />
                <span>ยกเลิกการตรวจ</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              disabled={RBAC.isReadOnly(user?.role)}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[var(--touch-min)] text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">ล้างข้อมูล</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Banner: Currently Active Visit from HIS ── */}
      {currentVn && (
        <div className="bg-pink-50/80 border border-pink-200 rounded-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-600 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-pink-950">กำลังตรวจประเมินเวชระเบียนจาก HIS:</span>
            <span className="text-xs text-pink-900 font-medium bg-white px-2 py-0.5 rounded-sm border border-pink-200">
              VN: {currentVn}
            </span>
            <span className="text-xs text-pink-900 font-medium bg-white px-2 py-0.5 rounded-sm border border-pink-200">
              HN: {hn}
            </span>
            {patientName && (
              <span className="text-xs text-pink-900 font-semibold">
                ผู้ป่วย: {patientName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 text-rose-700 hover:text-rose-900 bg-white hover:bg-rose-50 rounded-sm border border-rose-300 transition-colors shadow-xs cursor-pointer flex items-center justify-center"
              title="ล้างข้อมูลเคสปัจจุบัน"
              aria-label="ล้างข้อมูลเคสปัจจุบัน"
            >
              <X size={14} className="shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setIsSelectVisitModalOpen(true)}
              className="text-xs font-medium text-pink-800 bg-white hover:bg-pink-100 px-2.5 py-1.5 rounded-sm border border-pink-300 transition-colors shadow-xs cursor-pointer"
            >
              เลือกเคสอื่นจาก HIS
            </button>
            <Link
              href={effectiveBatchId ? `/sampling?batchId=${encodeURIComponent(effectiveBatchId)}` : '/sampling'}
              className="text-xs font-semibold text-pink-700 hover:text-pink-900 bg-white hover:bg-pink-100/60 px-2.5 py-1.5 rounded-sm border border-pink-200 transition-colors flex items-center gap-1 shadow-xs"
              title={effectiveBatchId ? `กลับไปหน้ารายการสุ่มของชุด ${effectiveBatchId}` : 'กลับไปหน้าระบบสุ่มตรวจ'}
            >
              <span>กลับไปหน้ารายการสุ่ม</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* ── 2. Patient & Case Info ── */}
      <Card>
        <CardHeader className="py-2.5 px-4 md:px-5 bg-slate-50/70 border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-blue-950">ข้อมูลสถานบริการและผู้ป่วย</span>
              {patientName && (
                <span className="text-xs text-blue-900 font-semibold bg-white px-2 py-0.5 rounded-sm border border-slate-200">
                  {patientName}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsSelectVisitModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-900 bg-white hover:bg-blue-50 border border-blue-300 rounded-sm transition-colors shadow-xs"
            >
              <DatabaseArrowDown size={13} />
              <span>ดึงข้อมูลจาก HIS</span>
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Row 1: Hospital & Patient identifiers */}
          <div className="grid-form-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                รหัสสถานบริการ
              </label>
              <Input placeholder="เช่น 10702" value={hcode} onChange={(e) => setField('hcode', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                ชื่อสถานบริการ
              </label>
              <Input placeholder="เช่น รพ.ศูนย์การแพทย์..." value={hname} onChange={(e) => setField('hname', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                เลขประจำตัวผู้ป่วย (HN)
              </label>
              <Input placeholder="HN ผู้ป่วย" value={hn} onChange={(e) => setField('hn', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                เลขบัตรประชาชน (PID)
              </label>
              <Input placeholder="13 หลัก" value={pid} onChange={(e) => setField('pid', e.target.value)} />
            </div>
          </div>

          {/* Row 2: Case type & dynamic fields */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio" name="caseType"
                    checked={caseType === 'general'}
                    onChange={() => setField('caseType', 'general')}
                    className="text-pink-600 focus:ring-pink-500 w-4 h-4"
                  />
                  <span className="font-semibold text-blue-950">General case (โรคทั่วไป/ฉุกเฉิน)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio" name="caseType"
                    checked={caseType === 'chronic'}
                    onChange={() => setField('caseType', 'chronic')}
                    className="text-pink-600 focus:ring-pink-500 w-4 h-4"
                  />
                  <span className="font-semibold text-blue-950">Chronic case (โรคเรื้อรัง)</span>
                </label>
              </div>

              {/* Toggle จิตเวช (หน้า 96 ตามคู่มือ สปสช.) */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-sm">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(isPsychiatric)}
                    onChange={(e) => setIsPsychiatric(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded-sm border-slate-300 focus:ring-purple-500 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5 font-bold text-xs text-purple-950">
                    <Brain size={14} className="text-purple-600" />
                    <span>เกณฑ์จิตเวช</span>
                  </span>
                </label>
                {isPsychiatric && (
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-sm border border-purple-200 shadow-2xs">
                    ECT & Psychosocial active
                  </span>
                )}
              </div>
            </div>

            {caseType === 'general' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Diagnosis (การวินิจฉัยโรค)
                  </label>
                  <Input
                    placeholder="ระบุการวินิจฉัยโรค"
                    value={diagnosis}
                    onChange={(e) => setField('diagnosis', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Visit Date (ว/ด/ป ที่รับบริการ)
                  </label>
                  <Input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setField('visitDate', e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                {/* 1. Diagnosis */}
                <div className="lg:col-span-4">
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Diagnosis (โรคเรื้อรัง)
                  </label>
                  <Input
                    placeholder="ระบุการวินิจฉัยโรคเรื้อรัง"
                    value={diagnosis}
                    onChange={(e) => setField('diagnosis', e.target.value)}
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
                        onChange={(e) => setField('chronicPeriodFrom', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <span className="text-xs text-slate-500 font-medium shrink-0">ถึง</span>
                    <div className="relative flex-1">
                      <Input
                        type="date"
                        title="วันที่สิ้นสุดช่วงเวลาตรวจ (ถึง)"
                        value={chronicPeriodTo}
                        onChange={(e) => setField('chronicPeriodTo', e.target.value)}
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
                    onChange={(e) => setField('firstVisitDate', e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Main Assessment Area ── */}
      <div className="w-full">
        {activeTab === 'table' ? <OpdTableView /> : <OpdCriteriaView />}
      </div>

      {/* ── 4. Summary, Overall Finding & Signature ── */}
      <div className="grid-summary">

        {/* Card 1: Score summary */}
        <Card>
          <CardHeader className="bg-pink-50/60 border-b border-pink-100">
            <CardTitle className="text-sm font-bold text-pink-950 flex items-center justify-between gap-2 flex-wrap">
              <span>สรุปผลคะแนนที่ได้</span>
              <span className="text-[11px] font-semibold text-pink-700 bg-white px-2 py-0.5 rounded-sm border border-pink-200 shrink-0">
                {caseType === 'general' ? 'ทั่วไป ≥ 14' : 'เรื้อรัง ≥ 18'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Big % */}
            <div className="text-center py-5 bg-slate-50 border border-slate-200 rounded-sm">
              <div className="text-4xl font-extrabold text-pink-600 tracking-tight tabular-nums">
                {percentage.toFixed(2)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">คิดเป็นร้อยละ</div>
            </div>
            {/* Score boxes */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="border border-slate-200 rounded-sm p-3 bg-white">
                <span className="text-2xl font-bold text-blue-950 block tabular-nums">{sumScore}</span>
                <span className="text-[11px] text-slate-500">คะแนนที่ได้</span>
              </div>
              <div className="border border-slate-200 rounded-sm p-3 bg-white">
                <span className="text-2xl font-bold text-slate-600 block tabular-nums">{fullScore}</span>
                <span className="text-[11px] text-slate-500">คะแนนเต็ม</span>
              </div>
            </div>
            {/* Status */}
            <div className="text-xs bg-slate-50 border border-slate-200 rounded-sm p-3 space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-600">เกณฑ์ขั้นต่ำ</span>
                <strong className="text-blue-950">{caseType === 'general' ? '≥ 14 คะแนน' : '≥ 18 คะแนน'}</strong>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">ผลการประเมิน</span>
                <span className={`inline-flex items-center gap-1 font-semibold ${isPassedMinScore ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isPassedMinScore
                    ? <><CheckCircle2 size={13} /><span>ผ่านเกณฑ์</span></>
                    : <><AlertCircle size={13} /><span>ต่ำกว่าเกณฑ์</span></>
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Overall finding */}
        <Card>
          <CardHeader className="bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-blue-950">
              ประเมินคุณภาพในภาพรวม (Overall finding)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">สรุปภาพรวมตามที่ตรวจพบในเวชระเบียน</p>

            {[
              {
                value: 'inadequate' as const,
                label: 'Documentation inadequate for meaningful review',
                sub: 'ข้อมูลไม่เพียงพอสำหรับการทบทวน',
              },
              {
                value: 'no_issue' as const,
                label: 'No significant medical record issue identified',
                sub: 'ไม่มีปัญหาสำคัญจากการทบทวน',
              },
              {
                value: 'certain_issues' as const,
                label: 'Certain issues in question — specify',
                sub: 'มีปัญหาจากการทบทวนที่ต้องค้นต่อ',
              },
            ].map(({ value, label, sub }) => (
              <label
                key={value}
                className="flex items-start gap-3 p-2.5 rounded-sm border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="overallFinding"
                  checked={overallFinding === value}
                  onChange={() => setField('overallFinding', value)}
                  className="mt-0.5 text-pink-600 focus:ring-pink-500 shrink-0"
                />
                <div className="text-xs">
                  <strong className="text-slate-800 block">{label}</strong>
                  <span className="text-slate-500">{sub}</span>
                </div>
              </label>
            ))}

            {overallFinding === 'certain_issues' && (
              <div className="pl-7">
                <Input
                  placeholder="ระบุรายละเอียดปัญหาที่ต้องค้นต่อ..."
                  value={certainIssueRemarks}
                  onChange={(e) => setField('certainIssueRemarks', e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Auditor signature */}
        <Card>
          <CardHeader className="bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-blue-950">
              การลงนามผู้ตรวจประเมิน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Audit by (ผู้ตรวจประเมิน)
              </label>
              <Input
                value={auditorName}
                onChange={(e) => setField('auditorName', e.target.value)}
                placeholder="ชื่อ-สกุล ผู้ตรวจประเมิน"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Audit Date (วันที่ตรวจประเมิน)
              </label>
              <Input
                type="date"
                value={auditDate}
                onChange={(e) => setField('auditDate', e.target.value)}
              />
            </div>
            {/* Action buttons: แสดงแยกกันเต็มความกว้างการ์ด (Full Card Column) อย่างมีมาตรฐาน ไม่ชิดกัน */}
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || RBAC.isReadOnly(user?.role)}
                className="w-full bg-blue-900 hover:bg-blue-950 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 px-4 rounded-sm flex items-center justify-center gap-2 transition-colors shadow-xs min-h-[var(--touch-min)]"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>กำลังบันทึกข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>{isExistingAudit ? 'บันทึกการแก้ไข' : 'บันทึกการประเมิน'}</span>
                  </>
                )}
              </button>

              {isExistingAudit && (
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleRevokeThisAudit}
                    disabled={!RBAC.canRevokeAudit(user?.role)}
                    className="w-full bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-50 border border-rose-300 text-rose-700 hover:text-rose-800 text-xs font-semibold py-2.5 px-4 rounded-sm flex items-center justify-center gap-1.5 transition-colors shadow-xs min-h-[var(--touch-min)]"
                    title="ยกเลิกผลการตรวจประเมินเคสนี้"
                  >
                    <XCircle size={15} />
                    <span>ยกเลิกการตรวจ</span>
                  </button>
                </div>
              )}

              {effectiveBatchId && (
                <div className="pt-2 border-t border-slate-200">
                  <Link
                    href={`/sampling?batchId=${encodeURIComponent(effectiveBatchId)}`}
                    className="w-full bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-700 hover:text-pink-800 text-xs font-semibold py-2.5 px-4 rounded-sm flex items-center justify-center gap-1.5 transition-colors shadow-xs min-h-[var(--touch-min)]"
                    title={`กลับไปหน้ารายการสุ่มของชุด ${effectiveBatchId}`}
                  >
                    <span>กลับไปหน้ารายการสุ่ม</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
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

      {/* ── Modal: เลือกเคสตรวจเวชระเบียนจาก HIS ── */}
      <SelectHisVisitModal
        isOpen={isSelectVisitModalOpen}
        onClose={() => setIsSelectVisitModalOpen(false)}
      />

    </div>
  );
}
