'use client';

import { apiUrl } from '@/lib/constants';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useIpdAuditStore } from '@/store/useIpdAuditStore';
import { IpdTableView } from '@/components/mra/IpdTableView';
import { IpdCriteriaView } from '@/components/mra/IpdCriteriaView';
import { SelectHisIpdVisitModal } from '@/components/mra/SelectHisIpdVisitModal';
import { alertConfirm, alertSuccess, alertWarning, alertError } from '@/lib/mra-alert';
import { useAuthStore } from '@/store/useAuthStore';
import { RBAC } from '@/lib/rbac';
import {
  Table,
  ListFilter,
  Save,
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowLeft,
  ArrowRight,
  X,
  DatabaseArrowDown,
  Building2,
  Shuffle,
  RotateCcw,
  XCircle,
  Brain,
} from 'lucide-react';

export default function IpdAssessmentPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'table' | 'criteria'>('table');
  const [isSelectVisitModalOpen, setIsSelectVisitModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    hcode,
    hname,
    currentAn,
    currentSampleItemId,
    currentBatchId,
    patientName,
    hn,
    pid,
    sex,
    age,
    wardCode,
    wardName,
    admitDate,
    admitTime,
    dischargeDate,
    dischargeTime,
    lengthOfStay,
    dischargeStatus,
    dischargeType,
    diagnosis,
    caseType,
    overallFinding,
    certainIssueRemarks,
    auditorName,
    auditDate,
    rows,
    isExistingAudit,
    setField,
    resetAll,
    calculateTotals,
    initHospitalFromHis,
    revokeAudit,
  } = useIpdAuditStore();

  const { user } = useAuthStore();

  useEffect(() => {
    initHospitalFromHis();
  }, [initHospitalFromHis]);

  // Auto-fill auditorName from active session
  useEffect(() => {
    if (user?.fullName && (!auditorName || auditorName === 'นพ. ตรวจสอบ เวชระเบียน')) {
      setField('auditorName', user.fullName);
    }
  }, [user, auditorName, setField]);

  // Support direct linking from reports, sampling, or external URL via ?an= or ?auditId= or ?batchId=
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlAn = params.get('an');
      const urlAuditId = params.get('auditId');
      const urlBatchId = params.get('batchId');
      if (urlBatchId) {
        useIpdAuditStore.getState().setField('currentBatchId', urlBatchId);
      }
      if (urlAn && urlAn !== currentAn) {
        useIpdAuditStore.getState().loadExistingIpdAudit(urlAn);
      } else if (urlAuditId && !currentAn) {
        useIpdAuditStore.getState().loadExistingIpdAudit(urlAuditId);
      }
    }
  }, [currentAn]);

  const effectiveBatchId = currentBatchId || (currentSampleItemId ? currentSampleItemId.replace(/-[0-9]+$/, '') : null);

  const { sumScore, fullScore, percentage, minRequiredScore, isPassedMinScore } =
    calculateTotals();

  const handleReset = async () => {
    const confirmed = await alertConfirm({
      title: 'รีเซ็ตผลการตรวจประเมิน IPD?',
      text: 'ข้อมูลการประเมินทั้งหมดในชาร์ตผู้ป่วยในนี้จะถูกล้าง และไม่สามารถกู้คืนได้',
      confirmText: 'รีเซ็ต',
      cancelText: 'ยกเลิก',
      icon: 'warning',
      danger: true,
    });
    if (confirmed) {
      resetAll();
      alertSuccess('ล้างข้อมูลสำเร็จ', 'ผลการตรวจประเมิน IPD ถูกรีเซ็ตเรียบร้อยแล้ว');
    }
  };

  const handleRevokeThisAudit = async () => {
    if (!RBAC.canRevokeAudit(user?.role)) {
      alertWarning('ไม่มีสิทธิ์ดำเนินการ', 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถยกเลิกผลการตรวจประเมินได้');
      return;
    }

    const confirmed = await alertConfirm({
      title: 'ยกเลิกผลการตรวจประเมินเคสนี้?',
      text: `ต้องการยกเลิกผลการตรวจประเมินของ ${patientName || hn} (AN: ${currentAn}) ใช่หรือไม่? ข้อมูลคะแนนจะถูกลบออกจากฐานข้อมูล และสถานะของเคสนี้จะกลับเป็น "รอตรวจ"`,
      confirmText: 'ยกเลิกการตรวจ',
      cancelText: 'ย้อนกลับ',
      icon: 'warning',
      danger: true,
    });
    if (!confirmed) return;

    const ok = await revokeAudit();
    if (ok) {
      alertSuccess('ยกเลิกสำเร็จ', 'ยกเลิกผลการตรวจประเมิน IPD เรียบร้อยแล้ว สถานะกลับเป็นรอตรวจ');
    } else {
      alertError({ title: 'ยกเลิกไม่สำเร็จ', text: 'เกิดข้อผิดพลาดในการยกเลิกผลการตรวจ' });
    }
  };

  const handleSave = async () => {
    if (!RBAC.canSaveAudit(user?.role)) {
      alertWarning('ไม่มีสิทธิ์ดำเนินการ', 'สิทธิ์ Officer สามารถดูข้อมูลได้เท่านั้น ไม่สามารถบันทึกหรือแก้ไขผลการตรวจได้');
      return;
    }

    if (!auditorName.trim()) {
      alertWarning('กรุณาระบุชื่อผู้ตรวจประเมิน', 'ช่อง "Audit by" ต้องกรอกก่อนบันทึกผลการประเมิน');
      return;
    }

    if (!currentAn && !hn) {
      alertWarning('กรุณาเลือกเคสผู้ป่วยใน', 'ต้องมีหมายเลข AN และ HN ของผู้ป่วยก่อนบันทึก');
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch(apiUrl('/api/mra/ipd-audit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: currentSampleItemId,
          an: currentAn || `AN-${hn}`,
          hn,
          pid,
          patientName,
          hcode,
          hname,
          caseType,
          isPsychiatric: caseType === 'psychiatric',
          wardCode,
          wardName,
          admitDate,
          dischargeDate,
          lengthOfStay,
          dischargeStatus,
          dischargeType,
          diagnosis,
          sumScore,
          fullScore,
          percentage,
          isPassed: isPassedMinScore ? 1 : 0,
          overallFinding,
          certainIssueRemarks,
          auditorName,
          auditDate,
          rows: rows.map((r) => {
            let rSum = 0;
            let rFull = 0;
            if (r.missingSelected || r.noSelected) {
              rFull = r.maxCriteria;
            } else if (!r.naSelected) {
              r.scores.forEach((s) => {
                if (s === '1') {
                  rSum += 1;
                  rFull += 1;
                } else if (s === '0' || s === 'M') {
                  rFull += 1;
                }
              });
              if (r.hasDeductScore && r.deductScore > 0) {
                rSum -= r.deductScore;
              }
              if (rSum < 0) rSum = 0;
            }
            return {
              no: r.no,
              name: r.contentName,
              naSelected: r.naSelected,
              missingSelected: r.missingSelected,
              noSelected: r.noSelected,
              scores: r.scores,
              addScore: 0,
              deductScore: r.deductScore || 0,
              rowSum: rSum,
              rowFull: rFull,
              remarkText: r.remarkText || '',
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
          title: 'บันทึกผลการประเมิน IPD สำเร็จ!',
          text: `บันทึกผลลงฐานข้อมูล db_mra เรียบร้อย (รหัส: ${json.data.auditId}) • คะแนน ${sumScore}/${fullScore} (${percentage.toFixed(2)}%)\n\nต้องการกลับไปหน้ารายการสุ่ม (${effectiveBatchId}) เพื่อประเมินเคสอื่นต่อหรือไม่?`,
          confirmText: 'กลับไปหน้ารายการสุ่ม',
          cancelText: 'ดูผลประเมินเคสนี้ต่อ',
          icon: 'question',
        });
        if (goBack) {
          router.push(`/ipd/sampling?batchId=${encodeURIComponent(effectiveBatchId)}`);
          return;
        }
      } else {
        alertSuccess(
          'บันทึกผลการประเมิน IPD สำเร็จ!',
          `บันทึกผลลงฐานข้อมูล db_mra เรียบร้อย (รหัส: ${json.data.auditId}) • คะแนนที่ได้ ${sumScore}/${fullScore} (${percentage.toFixed(2)}%)`
        );
      }
    } catch (err) {
      console.error('Error saving IPD audit:', err);
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
        ? 'bg-blue-900 text-white shadow-xs'
        : 'text-slate-600 hover:text-blue-950',
    ].join(' ');

  return (
    <div className="section-gap">
      {/* ── 1. Page Header & Quick Actions ── */}
      <div className="bg-white p-4 md:p-5 rounded-sm border border-slate-200 shadow-xs space-y-4">
        {/* Title */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-sm bg-blue-50 text-blue-700 border border-blue-200">
              มาตรฐาน สปสช.
            </span>
            <span className="text-xs text-slate-700 font-semibold hidden sm:inline uppercase">
              Medical Record Audit Form <span className="text-slate-300 font-normal mx-1">|</span> <span className="text-blue-600 font-bold">IPD</span>
            </span>
            {caseType === 'psychiatric' && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-sm bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                <Brain size={13} className="text-purple-600" />
                <span>จิตเวช</span>
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-blue-950 leading-snug">
                {caseType === 'psychiatric'
                  ? 'แบบตรวจประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยจิตเวช กรณีผู้ป่วยใน (IPD)'
                  : 'แบบตรวจประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยใน (IPD)'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                {caseType === 'psychiatric'
                  ? 'โครงสร้างการประเมินมาตรฐาน 11 หมวด ตามคู่มือการประเมินคุณภาพการบันทึกเวชระเบียนจิตเวช (ผู้ป่วยใน)'
                  : 'โครงสร้างการประเมินมาตรฐาน 12 หมวด ตามคู่มือการประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยใน'}
              </p>
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="inline-flex rounded-sm border border-slate-200 bg-slate-100 p-1 gap-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={tabCls('table')}
            >
              <Table size={14} />
              <span>ตาราง</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('criteria')}
              className={tabCls('criteria')}
            >
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
              href="/ipd/sampling"
              className="flex items-center gap-1.5 px-3 py-2 min-h-[var(--touch-min)] text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 rounded-sm shadow-xs transition-colors"
              title="เปิดหน้าระบบสุ่มตรวจเวชระเบียนผู้ป่วยใน"
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

      {/* ── Banner: Active Inpatient Admission from HIS ── */}
      {currentAn && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-900 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-blue-950">กำลังตรวจประเมินเวชระเบียนผู้ป่วยใน:</span>
            <span className="text-xs text-blue-900 font-medium bg-white px-2 py-0.5 rounded-sm border border-blue-200">
              AN: {currentAn}
            </span>
            <span className="text-xs text-blue-900 font-medium bg-white px-2 py-0.5 rounded-sm border border-blue-200">
              HN: {hn}
            </span>
            {patientName && (
              <span className="text-xs text-blue-950 font-semibold">ผู้ป่วย: {patientName}</span>
            )}
            {wardName && (
              <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm">
                หอผู้ป่วย: {wardName}
              </span>
            )}
            {lengthOfStay > 0 && (
              <span className="text-xs text-blue-800 bg-blue-100/60 px-2 py-0.5 rounded-sm font-medium">
                วันนอน: {lengthOfStay} วัน
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
              className="text-xs font-medium text-blue-900 bg-white hover:bg-blue-100/60 px-2.5 py-1.5 rounded-sm border border-blue-300 transition-colors shadow-xs cursor-pointer"
            >
              เลือกเคสอื่นจาก HIS
            </button>
            <Link
              href={effectiveBatchId ? `/ipd/sampling?batchId=${encodeURIComponent(effectiveBatchId)}` : '/ipd/sampling'}
              className="text-xs font-semibold text-blue-800 hover:text-blue-950 bg-white hover:bg-blue-100/60 px-2.5 py-1.5 rounded-sm border border-blue-200 transition-colors flex items-center gap-1 shadow-xs"
              title={effectiveBatchId ? `กลับไปหน้ารายการสุ่มของชุด ${effectiveBatchId}` : 'กลับไปหน้าระบบสุ่มตรวจผู้ป่วยใน'}
            >
              <span>กลับไปหน้ารายการสุ่ม</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* ── 2. Patient & Inpatient Admission Info ── */}
      <Card>
        <CardHeader className="py-2.5 px-4 md:px-5 bg-slate-50/70 border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-blue-950">
                ข้อมูลสถานบริการและข้อมูลการรับตัวผู้ป่วยใน (Inpatient Info)
              </span>
              {patientName && (
                <span className="text-xs text-blue-900 font-semibold bg-white px-2 py-0.5 rounded-sm border border-slate-200">
                  {patientName}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsSelectVisitModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-white hover:bg-blue-50 border border-blue-300 rounded-sm transition-colors shadow-xs flex items-center gap-1.5"
            >
              <DatabaseArrowDown size={14} />
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
              <Input
                placeholder="เช่น 11078"
                value={hcode}
                onChange={(e) => setField('hcode', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                ชื่อสถานบริการ
              </label>
              <Input
                placeholder="ชื่อโรงพยาบาล"
                value={hname}
                onChange={(e) => setField('hname', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                เลขประจำตัวผู้ป่วย (HN)
              </label>
              <Input
                placeholder="HN ผู้ป่วย"
                value={hn}
                onChange={(e) => setField('hn', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                เลขบัตรประชาชน (PID)
              </label>
              <Input
                placeholder="13 หลัก"
                value={pid}
                onChange={(e) => setField('pid', e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: Inpatient Admission Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                เลขที่ผู้ป่วยใน (AN)
              </label>
              <Input
                placeholder="Admission Number"
                value={currentAn}
                onChange={(e) => setField('currentAn', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                หอผู้ป่วย (Ward)
              </label>
              <Input
                placeholder="ชื่อหอผู้ป่วย"
                value={wardName}
                onChange={(e) => setField('wardName', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                วันรับตัวเข้าโรงพยาบาล (Admit)
              </label>
              <Input
                type="date"
                value={admitDate}
                onChange={(e) => setField('admitDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                วันจำหน่าย (Discharge)
              </label>
              <Input
                type="date"
                value={dischargeDate}
                onChange={(e) => setField('dischargeDate', e.target.value)}
              />
            </div>
          </div>

          {/* Row 3: Clinical & Case type options */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-100 items-end">
            <div className="md:col-span-6">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Principal Diagnosis (การวินิจฉัยโรคหลัก)
              </label>
              <Input
                placeholder="ระบุการวินิจฉัยโรคหลัก (Clinical term)"
                value={diagnosis}
                onChange={(e) => setField('diagnosis', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                วันนอน (LOS)
              </label>
              <Input
                type="number"
                min="0"
                value={lengthOfStay || ''}
                onChange={(e) => setField('lengthOfStay', parseInt(e.target.value, 10) || 0)}
                placeholder="จำนวนวันนอน"
              />
            </div>
            <div className="md:col-span-4">
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                ประเภทเคสประเมิน IPD
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="ipdCaseType"
                    checked={caseType === 'general'}
                    onChange={() => setField('caseType', 'general')}
                    className="text-blue-900 focus:ring-blue-900 w-4 h-4"
                  />
                  <span className="font-semibold text-blue-950">ผู้ป่วยทั่วไป ≥ 56 คะแนน</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="ipdCaseType"
                    checked={caseType === 'psychiatric'}
                    onChange={() => setField('caseType', 'psychiatric')}
                    className="text-blue-900 focus:ring-blue-900 w-4 h-4"
                  />
                  <span className="font-semibold text-blue-950">ผู้ป่วยจิตเวช ≥ 57 คะแนน</span>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Main Assessment Area ── */}
      <div className="w-full">
        {activeTab === 'table' ? <IpdTableView /> : <IpdCriteriaView />}
      </div>

      {/* ── 4. Summary, Overall Finding & Auditor Signature ── */}
      <div className="grid-summary">
        {/* Card 1: Score summary */}
        <Card>
          <CardHeader className="bg-blue-50/70 border-b border-blue-100">
            <CardTitle className="text-sm font-bold text-blue-950 flex items-center justify-between gap-2 flex-wrap">
              <span>สรุปผลคะแนนประเมิน IPD</span>
              <span className="text-[11px] font-semibold text-blue-900 bg-white px-2 py-0.5 rounded-sm border border-blue-200 shrink-0">
                {caseType === 'psychiatric' ? 'จิตเวช ≥ 57' : 'ทั่วไป ≥ 56'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Big % */}
            <div className="text-center py-5 bg-slate-50 border border-slate-200 rounded-sm">
              <div className="text-4xl font-extrabold text-blue-900 tracking-tight tabular-nums">
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
                <strong className="text-blue-950">≥ {minRequiredScore} คะแนน และ ≥ 80%</strong>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">ผลการประเมิน</span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${isPassedMinScore ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                >
                  {isPassedMinScore ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>ผ่านเกณฑ์มาตรฐาน</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={13} />
                      <span>ต่ำกว่าเกณฑ์</span>
                    </>
                  )}
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
                value: 'no_issue' as const,
                label: 'No significant medical record issue identified',
                sub: 'ไม่มีปัญหาสำคัญจากการทบทวน',
              },
              {
                value: 'certain_issues' as const,
                label: 'Certain issues in question — specify',
                sub: 'มีปัญหาจากการทบทวนที่ต้องค้นต่อ',
              },
              {
                value: 'inadequate' as const,
                label: 'Documentation inadequate for meaningful review',
                sub: 'ข้อมูลไม่เพียงพอสำหรับการทบทวน',
              },
              {
                value: 'order_not_standard' as const,
                label: 'การจัดเรียงเวชระเบียนไม่เป็นไปตามมาตรฐานที่กำหนด',
                sub: 'การจัดเก็บเวชระเบียนหลังจำหน่ายไม่เรียงตามลำดับ ว/ด/ป และเวลา',
              },
              {
                value: 'missing_patient_identifiers' as const,
                label: 'เอกสารบางแผ่น ไม่มีชื่อผู้รับบริการ HN AN',
                sub: 'ทำให้ไม่สามารถระบุได้ว่าเป็นของผู้ใด จึงไม่สามารถทบทวนเอกสารแผ่นนั้นได้',
              },
            ].map(({ value, label, sub }) => (
              <label
                key={value}
                className="flex items-start gap-3 p-2.5 rounded-sm border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="ipdOverallFinding"
                  checked={overallFinding === value}
                  onChange={() => setField('overallFinding', value)}
                  className="mt-0.5 text-blue-900 focus:ring-blue-900 shrink-0"
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
                    href={`/ipd/sampling?batchId=${encodeURIComponent(effectiveBatchId)}`}
                    className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 text-xs font-semibold py-2.5 px-4 rounded-sm flex items-center justify-center gap-1.5 transition-colors shadow-xs min-h-[var(--touch-min)]"
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

      {/* ── คำชี้แจงการบันทึกคะแนนในตารางประเมิน IPD ── */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-sm text-xs text-slate-700 space-y-2 mt-2">
        <div className="flex items-center gap-1.5 font-bold text-blue-950 pb-1.5 border-b border-slate-200">
          <Info size={16} className="text-blue-900 shrink-0" />
          <span>คำชี้แจงการบันทึกคะแนนประเมินเวชระเบียนผู้ป่วยใน (IPD) ตามคู่มือ สปสช. 2563</span>
        </div>
        <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-700">
          <p>
            <strong className="text-blue-950">1. การใช้ NA:</strong> ให้กากบาทช่อง NA เฉพาะหมวดที่ไม่มีการให้บริการในผู้ป่วยรายนั้น เช่น ผู้ป่วยไม่มีการผ่าตัด (Operative note), ไม่มีการให้ยาระงับความรู้สึก (Anesthetic record), ไม่ได้ส่งปรึกษา (Consultation record), ไม่ใช่กรณีคลอด (Labour record) หรือไม่มีกายภาพบำบัด (Rehabilitation record)
          </p>
          <p>
            <strong className="text-blue-950">2. การใช้ Missing:</strong> กรณีเอกสารสูญหาย ไม่ครบถ้วน หรือไม่มีการบันทึกในหมวดที่ต้องมี ให้กากบาทช่อง Missing (คิดคะแนนเต็ม 7 แต่ได้ 0 คะแนน)
          </p>
          <p>
            <strong className="text-blue-950">3. เกณฑ์คะแนนการประเมิน:</strong> คะแนนเต็มจะปรับตามหมวดที่ประเมินจริง โดยผู้ป่วยทั่วไปต้องได้ไม่น้อยกว่า 56 คะแนน และผู้ป่วยจิตเวชไม่น้อยกว่า 57 คะแนน (หรือคิดเป็นร้อยละ ≥ 80% จึงจะถือว่าผ่านเกณฑ์มาตรฐาน)
          </p>
        </div>
      </div>

      {/* ── Modal: เลือกเคสตรวจเวชระเบียนผู้ป่วยในจาก HIS ── */}
      <SelectHisIpdVisitModal
        isOpen={isSelectVisitModalOpen}
        onClose={() => setIsSelectVisitModalOpen(false)}
      />
    </div>
  );
}
