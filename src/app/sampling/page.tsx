'use client';

import { apiUrl } from '@/lib/constants';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useUnifiedAuditStore } from '@/store/useUnifiedAuditStore';
import { alertSuccess, alertError, alertConfirm } from '@/lib/mra-alert';
import { Building2, Shuffle, History, SlidersHorizontal, Edit3, Trash2, Ban, RotateCcw, ExternalLink, XCircle, Trophy } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { RBAC } from '@/lib/rbac';
import { BatchSummaryModal } from '@/components/mra/BatchSummaryModal';
import { ManualSamplingModal } from '@/components/mra/ManualSamplingModal';

interface ClinicOption {
  clinic: string;
  name: string;
}

interface SampleVisitItem {
  itemId: string;
  batchId?: string;
  vn: string;
  hn: string;
  cid: string;
  patientName: string;
  sex: string;
  age: number;
  vstdate: string;
  vsttime: string;
  department: string;
  pdx: string;
  diagnosisName: string;
  pttypeName: string;
  doctorName: string;
  chiefComplaint: string;
  auditStatus: 'pending' | 'audited';
}

interface BatchHistoryItem {
  batchId: string;
  batchName?: string;
  samplingDate: string;
  caseType: string;
  dateFrom: string;
  dateTo: string;
  sampleSize: number;
  totalAvailable: number;
  departmentCode?: string;
  status?: 'active' | 'completed' | 'cancelled';
  note?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  auditedCount: number;
}

function formatThaiDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    const [yearStr, monthStr, dayStr] = cleanDate.split('-');
    if (!yearStr || !monthStr || !dayStr) return dateStr;
    const christianYear = parseInt(yearStr, 10);
    const thaiYear = christianYear > 2400 ? christianYear : christianYear + 543;
    return `${dayStr.padStart(2, '0')}/${monthStr.padStart(2, '0')}/${thaiYear}`;
  } catch {
    return dateStr;
  }
}

function formatThaiTime(timeStr?: string): string {
  if (!timeStr || timeStr === '-' || timeStr === '00:00:00' || timeStr === '00:00') return '-';
  try {
    const cleanTime = timeStr.includes(':') ? timeStr.slice(0, 5) : timeStr;
    return `${cleanTime} น.`;
  } catch {
    return timeStr;
  }
}

export default function SamplingPage() {
  const router = useRouter();
  const { loadSampledVisit } = useUnifiedAuditStore();
  const { user } = useAuthStore();

  // Tab: 'sampling' | 'history'
  const [activeTab, setActiveTab] = useState<'sampling' | 'history'>('sampling');
  const [summaryModalBatchId, setSummaryModalBatchId] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Metadata from Hospital HIS
  const [hospitalInfo, setHospitalInfo] = useState({
    hcode: '',
    hname: '',
    latestDate: new Date().toISOString().split('T')[0],
    defaultStart: new Date().toISOString().split('T')[0],
  });
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [isHisOffline, setIsHisOffline] = useState(false);

  // Quick date presets & local date helpers
  const toLocalDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPresetDates = (preset: 'today' | 'yesterday' | '7days' | '30days') => {
    const now = new Date();
    let from = new Date(now);
    let to = new Date(now);

    if (preset === 'today') {
      from = now;
      to = now;
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = y;
      to = y;
    } else if (preset === '7days') {
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 7);
      from = d7;
      to = now;
    } else if (preset === '30days') {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      from = d30;
      to = now;
    }

    return {
      fromStr: toLocalDateStr(from),
      toStr: toLocalDateStr(to),
    };
  };

  const initialDates = getPresetDates('30days');
  const [activeDatePreset, setActiveDatePreset] = useState<'today' | 'yesterday' | '7days' | '30days' | null>('30days');

  // Form states
  const [dateFrom, setDateFrom] = useState(initialDates.fromStr);
  const [dateTo, setDateTo] = useState(initialDates.toStr);
  const [caseType, setCaseType] = useState<'all' | 'general' | 'chronic' | 'er' | 'psychiatric'>('all');
  const [clinicCode, setClinicCode] = useState('');
  const [sampleSize, setSampleSize] = useState(10);

  // Sampling result states
  const [isSampling, setIsSampling] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [totalAvailable, setTotalAvailable] = useState<number | null>(null);
  const [samples, setSamples] = useState<SampleVisitItem[]>([]);
  const [historyBatches, setHistoryBatches] = useState<BatchHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // In-table search & filter states for Sampled Visits
  const [sampleSearchQuery, setSampleSearchQuery] = useState('');
  const [sampleStatusFilter, setSampleStatusFilter] = useState<'all' | 'pending' | 'audited'>('all');

  // In-table search & status filter for History Batches
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  // Modal: Edit Batch states
  const [editingBatch, setEditingBatch] = useState<BatchHistoryItem | null>(null);
  const [editBatchName, setEditBatchName] = useState('');
  const [editCreatedBy, setEditCreatedBy] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [editNote, setEditNote] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 1. Fetch metadata on load
  useEffect(() => {
    async function loadMeta() {
      try {
        setMetaLoading(true);
        const res = await fetch(apiUrl('/api/his/meta'));
        const json = await res.json().catch(() => null);
        if (json?.isHisOffline) {
          setIsHisOffline(true);
        } else if (json?.success) {
          setIsHisOffline(false);
        }
        if (json?.data) {
          setHospitalInfo(json.data);
          setClinics(json.data.clinics || []);
        }
      } catch {
        setIsHisOffline(true);
      } finally {
        setMetaLoading(false);
      }
    }
    loadMeta();
    loadHistory();
  }, []);

  // Support direct loading via ?batchId=... (e.g. returning from audit page) or ?caseType=...
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const bId = params.get('batchId');
      if (bId) {
        loadBatchById(bId, true);
      }
      const cType = params.get('caseType');
      if (cType && ['all', 'general', 'chronic', 'er', 'psychiatric'].includes(cType)) {
        setCaseType(cType as any);
      }
    }
  }, []);

  // 2. Fetch history batches
  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch(apiUrl('/api/mra/batches'));
      const json = await res.json().catch(() => null);
      if (json?.success && json?.data) {
        setHistoryBatches(json.data);
      }
    } catch {
      // Gracefully handle local fetch failure without noisy logs
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const applyDatePreset = (preset: 'today' | 'yesterday' | '7days' | '30days') => {
    const { fromStr, toStr } = getPresetDates(preset);
    setDateFrom(fromStr);
    setDateTo(toStr);
    setActiveDatePreset(preset);
  };

  // Perform random sampling
  const handlePerformSampling = async () => {
    if (!RBAC.canCreateSample(user?.role)) {
      alertError({ title: 'ไม่มีสิทธิ์ดำเนินการ', text: 'สิทธิ์ Officer สามารถดูข้อมูลได้เท่านั้น ไม่สามารถสุ่มเคสใหม่ได้' });
      return;
    }

    if (!dateFrom || !dateTo) {
      alertError({ title: 'กรุณาระบุช่วงวันที่', text: 'ต้องระบุวันที่เริ่มต้นและวันที่สิ้นสุด' });
      return;
    }

    try {
      setIsSampling(true);
      const res = await fetch(apiUrl('/api/his/sample'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom,
          dateTo,
          caseType,
          clinicCode: caseType === 'chronic' ? clinicCode : undefined,
          sampleSize,
          auditorName: user?.fullName || 'Auditor',
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json || !json.success) {
        const isOffline =
          json?.isHisOffline ||
          (json?.error && (
            json.error.includes('ETIMEDOUT') ||
            json.error.includes('ECONNREFUSED') ||
            json.error.includes('เชื่อมต่อ') ||
            json.error.includes('connect')
          ));

        if (isOffline) {
          setIsHisOffline(true);
          const useManual = await alertConfirm({
            title: 'ไม่ได้เชื่อมต่อฐานข้อมูล HIS',
            text: 'ไม่สามารถเชื่อมต่อฐานข้อมูล HIS ได้ในขณะนี้',
            confirmText: 'เปิดหน้าบันทึกตัวอย่าง',
            cancelText: 'ปิดหน้าต่าง',
            icon: 'info',
          });
          if (useManual) {
            setIsManualModalOpen(true);
          }
          return;
        }

        alertError({
          title: 'ไม่สามารถสุ่มข้อมูลได้',
          text: json?.error || 'เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบโรงพยาบาล',
        });
        return;
      }

      const { batchId, totalAvailable: total, samples: sampleList } = json.data;

      if (!sampleList || sampleList.length === 0) {
        alertError({
          title: 'ไม่พบข้อมูลเวชระเบียน',
          text: 'ไม่พบรายการผู้รับบริการตามช่วงวันที่และเงื่อนไขที่ระบุ กรุณาขยายช่วงเวลาหรือเปลี่ยนคลินิก',
        });
        return;
      }

      setCurrentBatchId(batchId);
      setTotalAvailable(total);
      setSamples(sampleList);
      setSampleSearchQuery('');
      setSampleStatusFilter('all');
      loadHistory();

      alertSuccess({
        title: 'สุ่มตัวอย่างสำเร็จ',
        text: `ดึงข้อมูลจากระบบโรงพยาบาลได้ ${sampleList.length} ตัวอย่าง จากทั้งหมด ${total.toLocaleString()} visits พร้อมบันทึกรอบการสุ่มเรียบร้อย`,
      });
    } catch {
      setIsHisOffline(true);
      const useManual = await alertConfirm({
        title: 'ไม่ได้เชื่อมต่อฐานข้อมูล HIS',
        text: 'ไม่สามารถเชื่อมต่อฐานข้อมูล HIS ได้ในขณะนี้',
        confirmText: 'เปิดหน้าบันทึกตัวอย่าง',
        cancelText: 'ปิดหน้าต่าง',
        icon: 'info',
      });
      if (useManual) {
        setIsManualModalOpen(true);
      }
    } finally {
      setIsSampling(false);
    }
  };

  // Helper to map caseType to standard label and badge style
  const getOpdCaseTypeBadge = (type?: string) => {
    switch (type) {
      case 'general':
        return {
          label: 'ผู้ป่วยนอกทั่วไป',
          badge: 'OPD',
          className: 'bg-blue-50 text-blue-800 border-blue-200',
        };
      case 'chronic':
        return {
          label: 'คลินิกโรคเรื้อรัง',
          badge: 'NCD',
          className: 'bg-amber-100 text-amber-800 border-amber-300',
        };
      case 'er':
        return {
          label: 'อุบัติเหตุ-ฉุกเฉิน',
          badge: 'ER',
          className: 'bg-rose-100 text-rose-800 border-rose-300',
        };
      case 'psychiatric':
        return {
          label: 'ผู้ป่วยจิตเวช',
          badge: 'PSY',
          className: 'bg-purple-100 text-purple-800 border-purple-300',
        };
      case 'all':
      default:
        return {
          label: 'ทั้งหมด',
          badge: 'ALL',
          className: 'bg-slate-100 text-slate-800 border-slate-300',
        };
    }
  };

  // Load items from an existing batch by ID (supports direct URL access ?batchId=...)
  const loadBatchById = async (batchId: string, silent = false) => {
    try {
      setIsSampling(true);
      const res = await fetch(apiUrl(`/api/mra/batches?batchId=${encodeURIComponent(batchId)}`));
      const json = await res.json();
      if (json.success && json.data) {
        setSamples(json.data);
        setCurrentBatchId(batchId);
        setActiveTab('sampling');
        setSampleSearchQuery('');
        setSampleStatusFilter('all');
        if (!silent) {
          alertSuccess({
            title: 'โหลดรอบการสุ่มสำเร็จ',
            text: `โหลดรายการ Visit จำนวน ${json.data.length} ชาร์ต จากรอบ ${batchId}`,
          });
        }
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        alertError({ title: 'ข้อผิดพลาด', text: 'ไม่สามารถโหลดข้อมูลรอบการสุ่มได้' });
      }
    } finally {
      setIsSampling(false);
    }
  };

  // Load items from an existing batch
  const handleLoadBatchItems = async (batch: BatchHistoryItem) => {
    if (batch.caseType) {
      setCaseType(batch.caseType as any);
    }
    if (batch.departmentCode) {
      setClinicCode(batch.departmentCode);
    }
    await loadBatchById(batch.batchId, false);
  };

  // Select visit to audit in MRA main page
  const handleStartAudit = (item: SampleVisitItem) => {
    const isItemPsychiatric =
      caseType === 'psychiatric' ||
      /^F[0-9]/i.test(item.pdx || '') ||
      item.department?.includes('จิตเวช') ||
      item.diagnosisName?.includes('จิตเวช');

    const isItemChronic =
      caseType === 'chronic' ||
      item.department?.includes('เรื้อรัง') ||
      item.department?.includes('NCD') ||
      item.department?.includes('เบาหวาน') ||
      item.department?.includes('ความดัน') ||
      /^(E1[0-4]|I1[0-5]|J4[4-5]|N18|I6[0-9]|F[0-9])/.test(item.pdx || '');

    const diag = item.pdx
      ? (item.diagnosisName ? `${item.pdx}: ${item.diagnosisName}` : item.pdx)
      : (item.diagnosisName || '');

    const bId = item.batchId || currentBatchId || undefined;

    loadSampledVisit({
      vn: item.vn,
      hn: item.hn,
      cid: item.cid,
      patientName: item.patientName,
      diagnosis: diag,
      pdx: item.pdx,
      vstdate: item.vstdate,
      caseType: isItemChronic ? 'chronic' : 'general',
      isPsychiatric: isItemPsychiatric,
      itemId: item.itemId,
      batchId: bId,
      hcode: hospitalInfo.hcode,
      hname: hospitalInfo.hname,
    });

    router.push(bId ? `/?batchId=${encodeURIComponent(bId)}&vn=${encodeURIComponent(item.vn)}` : `/?vn=${encodeURIComponent(item.vn)}`);
  };

  // Open edit modal
  const handleOpenEdit = (batch: BatchHistoryItem) => {
    if (!RBAC.isAdmin(user?.role)) {
      alertError({ title: 'ไม่มีสิทธิ์ดำเนินการ', text: 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถแก้ไขข้อมูลรอบการสุ่มได้' });
      return;
    }
    setEditingBatch(batch);
    setEditBatchName(batch.batchName || '');
    setEditCreatedBy(batch.createdBy || user?.fullName || '');
    setEditStatus(batch.status || 'active');
    setEditNote(batch.note || '');
  };

  // Submit batch edit
  const handleSaveEdit = async () => {
    if (!RBAC.isAdmin(user?.role)) {
      alertError({ title: 'ไม่มีสิทธิ์ดำเนินการ', text: 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถแก้ไขข้อมูลรอบการสุ่มได้' });
      return;
    }
    if (!editingBatch) return;
    try {
      setIsSavingEdit(true);
      const res = await fetch(apiUrl('/api/mra/batches'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: editingBatch.batchId,
          action: 'update',
          batchName: editBatchName,
          createdBy: editCreatedBy,
          status: editStatus,
          note: editNote,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setHistoryBatches((prev) =>
          prev.map((b) =>
            b.batchId === editingBatch.batchId
              ? {
                ...b,
                batchName: editBatchName,
                createdBy: editCreatedBy,
                status: editStatus,
                note: editNote,
              }
              : b
          )
        );
        alertSuccess({ title: 'บันทึกสำเร็จ', text: json.message });
        setEditingBatch(null);
        loadHistory();
      } else {
        alertError({ title: 'เกิดข้อผิดพลาด', text: json.error || 'ไม่สามารถบันทึกข้อมูลได้' });
      }
    } catch (err) {
      console.error(err);
      alertError({ title: 'ข้อผิดพลาด', text: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Toggle Cancel / Reactivate
  const handleToggleCancel = async (batch: BatchHistoryItem) => {
    if (!RBAC.canCancelBatch(user?.role)) {
      alertError({ title: 'ไม่มีสิทธิ์ดำเนินการ', text: 'เฉพาะผู้ดูแลระบบ (Administrator) และผู้ตรวจประเมิน (Auditor) เท่านั้นที่สามารถยกเลิกหรือคืนสถานะรอบการสุ่มได้' });
      return;
    }

    const isCurrentlyCancelled = batch.status === 'cancelled';
    const action = isCurrentlyCancelled ? 'reactivate' : 'cancel';
    const title = isCurrentlyCancelled ? 'คืนสถานะรอบการสุ่ม?' : 'ยืนยันยกเลิกรอบการสุ่ม?';
    const text = isCurrentlyCancelled
      ? `ต้องการคืนสถานะรอบ ${batch.batchId} กลับมาเป็นเปิดใช้งานเพื่อตรวจประเมินต่อ?`
      : `รอบ ${batch.batchId} จะถูกเปลี่ยนเป็น "ยกเลิกแล้ว" ข้อมูลตัวอย่างจะไม่ถูกลบ และสามารถคืนสถานะได้ตลอดเวลา`;

    const ok = await alertConfirm({
      title,
      text,
      confirmText: isCurrentlyCancelled ? 'คืนสถานะ' : 'ยืนยันยกเลิก',
      cancelText: 'ย้อนกลับ',
      icon: isCurrentlyCancelled ? 'question' : 'warning',
      danger: !isCurrentlyCancelled,
    });

    if (!ok) return;

    try {
      const res = await fetch(apiUrl('/api/mra/batches'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: batch.batchId, action }),
      });
      const json = await res.json();
      if (json.success) {
        const nextStatus: 'active' | 'cancelled' = isCurrentlyCancelled ? 'active' : 'cancelled';
        setHistoryBatches((prev) => {
          const exists = prev.some((b) => b.batchId === batch.batchId);
          if (exists) {
            return prev.map((b) => (b.batchId === batch.batchId ? { ...b, status: nextStatus } : b));
          } else {
            return [{ ...batch, status: nextStatus }, ...prev];
          }
        });
        alertSuccess({ title: 'สำเร็จ', text: json.message });
        loadHistory();
      } else {
        alertError({ title: 'ผิดพลาด', text: json.error || 'ไม่สามารถเปลี่ยนสถานะรอบได้' });
      }
    } catch (err) {
      console.error(err);
      alertError({ title: 'ข้อผิดพลาด', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    }
  };

  // Delete Batch with Safety Guard
  const handleDeleteBatch = async (batch: BatchHistoryItem) => {
    if (!RBAC.canDeleteBatch(user?.role)) {
      alertError({ title: 'ไม่มีสิทธิ์ดำเนินการ', text: 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถลบรอบการสุ่มได้' });
      return;
    }

    const hasAudited = (batch.auditedCount || 0) > 0;

    let confirmTitle = 'ยืนยันลบรอบการสุ่มนี้?';
    let confirmText = `ระบบจะลบรอบ ${batch.batchId} พร้อมรายการตัวอย่างทั้งหมด ${batch.sampleSize} รายการออกจากฐานข้อมูลอย่างถาวร`;
    let isForce = false;

    if (hasAudited) {
      confirmTitle = `รอบนี้มีการตรวจประเมินแล้ว ${batch.auditedCount} ชาร์ต`;
      confirmText = `มีการตรวจประเมินและบันทึกผล MRA ไปแล้ว ${batch.auditedCount} ชาร์ต (จาก ${batch.sampleSize} ชาร์ต) หากยืนยันลบถาวร ระบบจะลบรอบการสุ่มนี้พร้อมผลการตรวจประเมินทั้งหมดที่เกี่ยวข้องออกจากฐานข้อมูลอย่างสมบูรณ์ (หรือแนะนำให้เลือก "ยกเลิก" เพื่อคงข้อมูลไว้)`;
      isForce = true;
    }

    const ok = await alertConfirm({
      title: confirmTitle,
      text: confirmText,
      confirmText: hasAudited ? 'ยืนยันลบถาวร' : 'ลบข้อมูล',
      cancelText: 'ยกเลิก',
      icon: 'warning',
      danger: true,
    });

    if (!ok) return;

    try {
      const res = await fetch(apiUrl(`/api/mra/batches?batchId=${encodeURIComponent(batch.batchId)}${isForce ? '&force=true' : ''}`), {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        alertSuccess({ title: 'ลบสำเร็จ', text: json.message });
        loadHistory();
        if (currentBatchId === batch.batchId) {
          setSamples([]);
          setCurrentBatchId(null);
        }
      } else {
        alertError({ title: 'ไม่สามารถลบได้', text: json.message || json.error });
      }
    } catch (err) {
      console.error(err);
      alertError({ title: 'ข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อเพื่อลบข้อมูลได้' });
    }
  };

  // Revoke / Cancel audit for a single sampled case
  const handleRevokeCaseAudit = async (item: SampleVisitItem) => {
    if (!RBAC.canRevokeAudit(user?.role)) {
      alertError({ title: 'ไม่มีสิทธิ์ดำเนินการ', text: 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถยกเลิกผลการตรวจประเมินได้' });
      return;
    }

    const ok = await alertConfirm({
      title: 'ยกเลิกผลการตรวจประเมินเคสนี้?',
      text: `ต้องการยกเลิกผลการตรวจของ ${item.patientName || item.hn} (VN: ${item.vn}) ใช่หรือไม่? ข้อมูลคะแนนจะถูกลบ และสถานะของเคสนี้จะกลับเป็น "รอตรวจ"`,
      confirmText: 'ยกเลิกการตรวจ',
      cancelText: 'ย้อนกลับ',
      icon: 'warning',
      danger: true,
    });
    if (!ok) return;

    try {
      const params = new URLSearchParams();
      if (item.itemId) params.set('itemId', item.itemId);
      if (item.vn) params.set('vn', item.vn);

      const res = await fetch(apiUrl(`/api/mra/audit?${params.toString()}`), { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        alertSuccess('ยกเลิกสำเร็จ', 'ยกเลิกผลการตรวจประเมินเรียบร้อยแล้ว สถานะเปลี่ยนกลับเป็นรอตรวจ');
        setSamples((prev) =>
          prev.map((s) =>
            (s.itemId && s.itemId === item.itemId) || s.vn === item.vn
              ? { ...s, auditStatus: 'pending' as const }
              : s
          )
        );
        loadHistory();
      } else {
        alertError({ title: 'ยกเลิกไม่สำเร็จ', text: json.error || 'เกิดข้อผิดพลาดในการยกเลิก' });
      }
    } catch (err) {
      console.error(err);
      alertError({ title: 'ข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อเพื่อยกเลิกผลการตรวจได้' });
    }
  };

  // Memoized filtered samples
  const filteredSamples = useMemo(() => {
    return samples.filter((item) => {
      if (sampleStatusFilter !== 'all' && item.auditStatus !== sampleStatusFilter) {
        return false;
      }
      if (!sampleSearchQuery.trim()) return true;
      const q = sampleSearchQuery.trim().toLowerCase();
      const matchVn = (item.vn || '').toLowerCase().includes(q);
      const matchHn = (item.hn || '').toLowerCase().includes(q);
      const matchCid = (item.cid || '').toLowerCase().includes(q);
      const matchName = (item.patientName || '').toLowerCase().includes(q);
      const matchPdx = (item.pdx || '').toLowerCase().includes(q);
      const matchDiag = (item.diagnosisName || '').toLowerCase().includes(q);
      const matchDoctor = (item.doctorName || '').toLowerCase().includes(q);
      const matchDept = (item.department || '').toLowerCase().includes(q);
      return matchVn || matchHn || matchCid || matchName || matchPdx || matchDiag || matchDoctor || matchDept;
    });
  }, [samples, sampleSearchQuery, sampleStatusFilter]);

  // Memoized filtered history batches with Status & Text Search
  const filteredHistoryBatches = useMemo(() => {
    return historyBatches.filter((b) => {
      if (historyStatusFilter !== 'all') {
        const bStatus = b.status || 'active';
        if (historyStatusFilter === 'completed') {
          if (bStatus !== 'completed' && (b.auditedCount || 0) < b.sampleSize) return false;
        } else if (historyStatusFilter === 'cancelled') {
          if (bStatus !== 'cancelled') return false;
        } else if (historyStatusFilter === 'active') {
          if (bStatus === 'cancelled' || bStatus === 'completed') return false;
        }
      }

      if (!historySearchQuery.trim()) return true;
      const q = historySearchQuery.trim().toLowerCase();
      const matchId = (b.batchId || '').toLowerCase().includes(q);
      const matchName = (b.batchName || '').toLowerCase().includes(q);
      const matchDate = (b.samplingDate || '').toLowerCase().includes(q);
      const badge = getOpdCaseTypeBadge(b.caseType);
      const matchCase =
        (b.caseType || '').toLowerCase().includes(q) ||
        badge.label.toLowerCase().includes(q) ||
        badge.badge.toLowerCase().includes(q);
      const matchCreator = (b.createdBy || '').toLowerCase().includes(q);
      const matchNote = (b.note || '').toLowerCase().includes(q);
      const matchRange = `${b.dateFrom} ${b.dateTo}`.toLowerCase().includes(q);
      return matchId || matchName || matchDate || matchCase || matchCreator || matchNote || matchRange;
    });
  }, [historyBatches, historySearchQuery, historyStatusFilter]);

  // Current batch object in history (for immediate reactive status display)
  const currentBatchObj = useMemo(
    () => historyBatches.find((b) => b.batchId === currentBatchId),
    [historyBatches, currentBatchId]
  );

  // Standardized options for SearchableSelect
  const caseTypeOptions = [
    { value: 'all', label: 'ทั้งหมด', badge: 'ALL' },
    { value: 'general', label: 'ผู้ป่วยนอกทั่วไป', badge: 'OPD' },
    { value: 'chronic', label: 'คลินิกโรคเรื้อรัง', badge: 'NCD' },
    { value: 'er', label: 'อุบัติเหตุ-ฉุกเฉิน', badge: 'ER' },
    { value: 'psychiatric', label: 'ผู้ป่วยจิตเวช', badge: 'PSY' },
  ];

  const sampleSizeOptions = [
    { value: '5', label: '5 ชาร์ต (ทดสอบ)', badge: '5 ชาร์ต' },
    { value: '10', label: '10 ชาร์ต (มาตรฐาน OPD)', badge: '10 ชาร์ต' },
    { value: '20', label: '20 ชาร์ต (ตรวจประจำเดือน)', badge: '20 ชาร์ต' },
    { value: '30', label: '30 ชาร์ต (สำรวจย้อนหลัง)', badge: '30 ชาร์ต' },
    { value: '50', label: '50 ชาร์ต (ประเมินใหญ่)', badge: '50 ชาร์ต' },
  ];

  // Clinics transformed for SearchableSelect
  const clinicSelectOptions = useMemo(() => {
    return clinics.map((c) => ({
      value: c.clinic,
      label: c.name,
      badge: c.clinic,
      subLabel: `รหัสคลินิก: ${c.clinic}`,
    }));
  }, [clinics]);

  return (
    <div className="section-gap">
      {/* ── 1. Page Header ── */}
      <div className="bg-white p-4 md:p-5 rounded-sm border border-slate-200 shadow-xs space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-pink-50 text-pink-700 border border-pink-200">
              OPD & ER Sampling
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Building2 size={13} className="text-slate-400" />
              <span>
                {hospitalInfo.hname || 'หน่วยบริการสุขภาพ'} {hospitalInfo.hcode ? `(${hospitalInfo.hcode})` : ''}
              </span>
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-blue-950 leading-snug flex items-center gap-2">
                <Shuffle className="text-blue-900" size={20} />
                <span>สุ่มตรวจเวชระเบียนผู้ป่วยนอก (OPD/ER)</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                สุ่มตัวอย่างเวชระเบียนผู้ป่วยนอกและฉุกเฉินตามมาตรฐานคู่มือ MRA สปสช.
              </p>
            </div>

            {/* Tab switch buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-sm border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('sampling')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-semibold transition-all ${activeTab === 'sampling'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
              >
                <Shuffle size={14} />
                <span>สุ่มตัวอย่าง</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-semibold transition-all ${activeTab === 'history'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
              >
                <History size={14} />
                <span>ประวัติ</span>
                {historyBatches.length > 0 && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-sm font-bold ${activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700'
                      }`}
                  >
                    {historyBatches.length}
                  </span>
                )}
              </button>
              {RBAC.canCreateSample(user?.role) && (
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 transition-all shadow-xs cursor-pointer ml-1"
                  title="สร้างชุดสุ่มตรวจด้วยตนเอง หรือนำเข้าไฟล์ CSV (Standalone Mode)"
                >
                  <Edit3 size={13} className="text-pink-600" />
                  <span>บันทึกตัวอย่าง</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'sampling' ? (
        <>
          {/* ── 2. Filter & Sampling Controls Card ── */}
          <Card>
            <CardHeader className="bg-slate-50/70 border-b border-slate-200">
              <CardTitle className="text-sm font-bold text-blue-950 flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-blue-900" />
                  <span>กำหนดเงื่อนไขการสุ่มตัวอย่าง</span>
                </span>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
                  <span className="font-semibold text-slate-700">ช่วงด่วน:</span>
                  {(
                    [
                      { id: 'today', label: 'วันนี้' },
                      { id: 'yesterday', label: 'เมื่อวาน' },
                      { id: '7days', label: '7 วันล่าสุด' },
                      { id: '30days', label: '30 วันล่าสุด' },
                    ] as const
                  ).map((p) => {
                    const isActive = activeDatePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyDatePreset(p.id)}
                        className={`px-2.5 py-1 rounded-sm text-xs transition-all font-medium border ${isActive
                          ? 'bg-blue-900 text-white border-blue-900 shadow-xs ring-2 ring-blue-900/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                {/* 1. Date Range From - To */}
                <div className="md:col-span-4">
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    ช่วงวันที่รับบริการ (จาก – ถึง)
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setActiveDatePreset(null);
                      }}
                      className="text-xs"
                    />
                    <span className="text-xs text-slate-500 font-medium shrink-0">ถึง</span>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setActiveDatePreset(null);
                      }}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* 2. Case Type (Searchable) */}
                <div className={caseType === 'chronic' ? 'md:col-span-3' : 'md:col-span-3'}>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    ประเภทเคสที่ต้องการสุ่ม
                  </label>
                  <SearchableSelect
                    options={caseTypeOptions}
                    value={caseType}
                    onChange={(v) => setCaseType(v as any)}
                    placeholder="เลือกประเภทเคส..."
                    searchPlaceholder="พิมพ์เพื่อค้นหาประเภทเคส..."
                  />
                </div>

                {/* 3. Chronic Clinic (Searchable Combobox) */}
                {caseType === 'chronic' ? (
                  <div className="md:col-span-5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 block">
                        ค้นหาคลินิกโรคเรื้อรัง ({clinics.length} คลินิก)
                      </label>
                      {clinicCode && (
                        <span className="text-[10px] text-pink-600 font-semibold">
                          รหัส: {clinicCode}
                        </span>
                      )}
                    </div>
                    <SearchableSelect
                      options={clinicSelectOptions}
                      value={clinicCode}
                      onChange={setClinicCode}
                      placeholder="พิมพ์เพื่อค้นหาคลินิก (เช่น 001, เบาหวาน, ความดัน)..."
                      searchPlaceholder="พิมพ์รหัสหรือชื่อคลินิก..."
                      allOptionLabel="ทุกคลินิกโรคเรื้อรัง (ทั้งหมด)"
                      emptyMessage="ไม่พบคลิกนิกที่ตรงกับการค้นหา"
                    />
                  </div>
                ) : null}

                {/* 4. Sample Size (Searchable) */}
                <div className={caseType === 'chronic' ? 'md:col-span-4' : 'md:col-span-3'}>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    จำนวนที่ต้องการสุ่ม (ชาร์ต)
                  </label>
                  <SearchableSelect
                    options={sampleSizeOptions}
                    value={String(sampleSize)}
                    onChange={(v) => setSampleSize(parseInt(v, 10) || 10)}
                    placeholder="เลือกจำนวนชาร์ต..."
                    searchPlaceholder="ค้นหาจำนวน..."
                  />
                </div>

                {/* 5. Action Button */}
                <div className={caseType === 'chronic' ? 'md:col-span-8' : 'md:col-span-2'}>
                  <button
                    type="button"
                    disabled={isSampling || metaLoading || isHisOffline || !RBAC.canCreateSample(user?.role)}
                    onClick={handlePerformSampling}
                    className="w-full h-11 sm:h-10 bg-pink-600 hover:bg-pink-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold text-xs rounded-sm shadow-xs flex items-center justify-center transition-colors disabled:cursor-not-allowed"
                    title={isHisOffline ? 'ไม่ได้เชื่อมต่อฐานข้อมูล HIS (กรุณาใช้ปุ่ม "บันทึกตัวอย่าง")' : 'สุ่มดึงข้อมูลจาก HIS'}
                  >
                    {isSampling
                      ? 'กำลังสุ่มดึงข้อมูล...'
                      : isHisOffline
                        ? 'ไม่ได้เชื่อมต่อ HIS'
                        : 'สุ่มดึงข้อมูลจาก HIS'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── 3. Sampling Result Header & Stats ── */}
          {samples.length > 0 && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-sm p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {samples.length}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-blue-950 flex items-center gap-2">
                    <span>รายการสุ่มตรวจตัวอย่าง</span>
                    <span className="text-[11px] font-normal text-slate-600 bg-white px-2 py-0.5 rounded-sm border border-blue-200">
                      รอบ: {currentBatchId}
                    </span>
                    {currentBatchObj && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-sm border ${currentBatchObj.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : currentBatchObj.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                      >
                        {currentBatchObj.status === 'cancelled'
                          ? 'ยกเลิกแล้ว'
                          : currentBatchObj.status === 'completed'
                            ? 'ตรวจครบแล้ว'
                            : 'เปิดใช้งาน'}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    ยอดผู้รับบริการในระบบทั้งหมด {totalAvailable?.toLocaleString()} รายการ (สุ่มออกมา {samples.length} ชาร์ต)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentBatchId && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSummaryModalBatchId(currentBatchId)}
                      className="px-2.5 py-1 text-xs font-semibold text-pink-700 bg-white hover:bg-pink-50 border border-pink-300 rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                      title="ดูสรุปผลคะแนนชุดสุ่มนี้ (Batch Summary)"
                    >
                      <Trophy size={13} className="text-pink-600" />
                      <span>สรุปคะแนน</span>
                    </button>
                    {currentBatchObj?.status === 'cancelled' ? (
                      <button
                        type="button"
                        disabled={!RBAC.canCancelBatch(user?.role)}
                        onClick={() => {
                          const b = currentBatchObj || {
                            batchId: currentBatchId,
                            samplingDate: new Date().toISOString(),
                            caseType,
                            dateFrom,
                            dateTo,
                            sampleSize: samples.length,
                            totalAvailable: totalAvailable || samples.length,
                            createdBy: user?.fullName || 'Auditor',
                            auditedCount: samples.filter((s) => s.auditStatus === 'audited').length,
                            status: 'cancelled',
                          };
                          handleToggleCancel(b);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white border border-emerald-300 rounded-sm flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                        title="คืนสถานะให้เปิดใช้งานรอบนี้อีกครั้ง"
                      >
                        <RotateCcw size={13} className="text-emerald-600" />
                        <span>คืนสถานะ</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!RBAC.canCancelBatch(user?.role)}
                        onClick={() => {
                          const b = currentBatchObj || {
                            batchId: currentBatchId,
                            samplingDate: new Date().toISOString(),
                            caseType,
                            dateFrom,
                            dateTo,
                            sampleSize: samples.length,
                            totalAvailable: totalAvailable || samples.length,
                            createdBy: user?.fullName || 'Auditor',
                            auditedCount: samples.filter((s) => s.auditStatus === 'audited').length,
                            status: 'active',
                          };
                          handleToggleCancel(b);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-white hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white border border-amber-300 rounded-sm flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                        title="ยกเลิกรอบการสุ่มนี้"
                      >
                        <XCircle size={13} className="text-amber-600" />
                        <span>ยกเลิก</span>
                      </button>
                    )}
                  </>
                )}
                <span className="text-xs text-slate-600 font-medium">
                  ตรวจแล้ว:{' '}
                  <strong className="text-emerald-700">
                    {samples.filter((s) => s.auditStatus === 'audited').length}
                  </strong>{' '}
                  / {samples.length} ชาร์ต
                </span>
              </div>
            </div>
          )}

          {/* ── 4. Sampled Visits Table with Instant Searchable Filter & text-nowrap ── */}
          {samples.length > 0 ? (
            <div className="space-y-2">
              {/* Quick Filter & Search Bar for Sampled Items */}
              <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                {/* Search input */}
                <div className="relative flex-1 min-w-[240px]">
                  <input
                    type="text"
                    value={sampleSearchQuery}
                    onChange={(e) => setSampleSearchQuery(e.target.value)}
                    placeholder="ค้นหาในรายการสุ่ม (HN, VN, ชื่อ-สกุล ผู้ป่วย, ICD-10, แผนก, แพทย์)..."
                    className="w-full px-3 py-1.5 text-xs rounded-sm border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
                  />
                  {sampleSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSampleSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                    >
                      ล้าง
                    </button>
                  )}
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 self-start md:self-auto shrink-0">
                  <span className="text-xs text-slate-500 font-medium">สถานะ:</span>
                  {(
                    [
                      { id: 'all', label: 'ทั้งหมด', count: samples.length },
                      { id: 'pending', label: 'รอตรวจ', count: samples.filter((s) => s.auditStatus === 'pending').length },
                      { id: 'audited', label: 'ตรวจแล้ว', count: samples.filter((s) => s.auditStatus === 'audited').length },
                    ] as const
                  ).map((filter) => {
                    const isActive = sampleStatusFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setSampleStatusFilter(filter.id)}
                        className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${isActive
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                          }`}
                      >
                        {filter.label} ({filter.count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table */}
              <div className="table-responsive overflow-x-auto bg-white rounded-sm border border-slate-200 shadow-xs">
                <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                  <thead>
                    <tr className="bg-blue-950 text-white font-semibold border-b border-blue-900 text-nowrap whitespace-nowrap">
                      <th className="p-2.5 text-center w-10 border-r border-blue-900 text-nowrap whitespace-nowrap">#</th>
                      <th className="p-2.5 text-center w-32 min-w-[125px] border-r border-blue-900 text-nowrap whitespace-nowrap">เวชระเบียน</th>
                      <th className="p-2.5 text-center w-32 min-w-[125px] border-r border-blue-900 text-nowrap whitespace-nowrap">จัดการ</th>
                      <th className="p-2.5 text-center w-24 border-r border-blue-900 text-nowrap whitespace-nowrap">สถานะ</th>
                      <th className="p-2.5 border-r border-blue-900 w-28 text-nowrap whitespace-nowrap">วันที่-เวลา</th>
                      <th className="p-2.5 border-r border-blue-900 w-28 text-nowrap whitespace-nowrap">VN / HN</th>
                      <th className="p-2.5 border-r border-blue-900 min-w-[180px] text-nowrap whitespace-nowrap">ชื่อ-สกุล ผู้ป่วย</th>
                      <th className="p-2.5 border-r border-blue-900 w-16 text-center text-nowrap whitespace-nowrap">เพศ</th>
                      <th className="p-2.5 border-r border-blue-900 w-16 text-center text-nowrap whitespace-nowrap">อายุ</th>
                      <th className="p-2.5 border-r border-blue-900 min-w-[160px] text-nowrap whitespace-nowrap">สิทธิการรักษา</th>
                      <th className="p-2.5 border-r border-blue-900 min-w-[220px] text-nowrap whitespace-nowrap">การวินิจฉัยโรค (ICD-10)</th>
                      <th className="p-2.5 border-r border-blue-900 min-w-[140px] text-nowrap whitespace-nowrap">แผนก/จุดบริการ</th>
                      <th className="p-2.5 min-w-[140px] text-nowrap whitespace-nowrap">แพทย์ผู้ตรวจ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredSamples.length > 0 ? (
                      filteredSamples.map((item, idx) => {
                        const isAudited = item.auditStatus === 'audited';
                        return (
                          <tr
                            key={item.itemId || item.vn}
                            className={`hover:bg-slate-50 transition-colors text-nowrap whitespace-nowrap ${isAudited ? 'bg-emerald-50/30' : ''
                              }`}
                          >
                            {/* 1. No */}
                            <td className="p-2 text-center text-slate-500 font-semibold border-r border-slate-200 text-nowrap whitespace-nowrap">
                              {idx + 1}
                            </td>

                            {/* 2. เวชระเบียน: Audit Button */}
                            <td className="p-1.5 text-center border-r border-slate-200 text-nowrap whitespace-nowrap w-32 min-w-[125px]">
                              <button
                                type="button"
                                onClick={() => handleStartAudit(item)}
                                className={`w-full py-1.5 px-2.5 rounded-sm font-semibold text-[11px] shadow-xs transition-colors flex items-center justify-center text-nowrap whitespace-nowrap cursor-pointer ${isAudited
                                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                  : 'bg-blue-900 hover:bg-blue-950 text-white'
                                  }`}
                                title={isAudited ? 'ตรวจซ้ำหรือแก้ไขผลการประเมิน' : 'เริ่มบันทึกการตรวจประเมิน'}
                              >
                                {isAudited ? 'ทบทวนเวชระเบียน' : 'ตรวจเวชระเบียน'}
                              </button>
                            </td>

                            {/* 3. จัดการ: ยกเลิกการตรวจ */}
                            <td className="p-1.5 text-center border-r border-slate-200 text-nowrap whitespace-nowrap w-32 min-w-[125px]">
                              {isAudited ? (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeCaseAudit(item)}
                                  disabled={!RBAC.canRevokeAudit(user?.role)}
                                  className="w-full py-1.5 px-2.5 rounded-sm text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-50 border border-rose-200 shadow-xs flex items-center justify-center gap-1.5 transition-all"
                                  title="ยกเลิกผลการตรวจประเมินเคสนี้"
                                >
                                  <XCircle size={13} className="text-rose-600 shrink-0" />
                                  <span>ยกเลิกการตรวจ</span>
                                </button>
                              ) : (
                                <span className="text-slate-300 font-medium block text-center">-</span>
                              )}
                            </td>

                            {/* 4. Status */}
                            <td className="p-2 text-center border-r border-slate-200 text-nowrap whitespace-nowrap w-24">
                              {isAudited ? (
                                <span className="w-full block text-center text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2.5 py-0.5 rounded-sm text-nowrap whitespace-nowrap">
                                  ตรวจแล้ว
                                </span>
                              ) : (
                                <span className="w-full block text-center text-[11px] font-semibold text-amber-700 bg-amber-100/70 border border-amber-300 px-2.5 py-0.5 rounded-sm text-nowrap whitespace-nowrap">
                                  รอตรวจ
                                </span>
                              )}
                            </td>

                            {/* 4. Date & Time */}
                            <td className="p-2.5 border-r border-slate-200 text-nowrap whitespace-nowrap">
                              <div className="font-semibold text-slate-800">{formatThaiDate(item.vstdate)}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {formatThaiTime(item.vsttime)}
                              </div>
                            </td>

                            {/* 5. VN / HN */}
                            <td className="p-2.5 border-r border-slate-200 text-nowrap whitespace-nowrap">
                              <div className="font-bold text-blue-950">{item.hn}</div>
                              <div className="text-[10px] text-slate-500 font-medium">VN: {item.vn}</div>
                            </td>

                            {/* 6. Patient Name & CID */}
                            <td className="p-2.5 border-r border-slate-200 text-nowrap whitespace-nowrap">
                              <div className="font-semibold text-slate-900">
                                {item.patientName}
                              </div>
                              {item.cid && (
                                <div className="text-[10px] text-slate-500 font-medium">
                                  CID: {item.cid}
                                </div>
                              )}
                            </td>

                            {/* 7. Sex */}
                            <td className="p-2.5 text-center border-r border-slate-200 text-nowrap whitespace-nowrap text-slate-800">
                              {item.sex || '-'}
                            </td>

                            {/* 8. Age */}
                            <td className="p-2.5 text-center border-r border-slate-200 text-nowrap whitespace-nowrap text-slate-800">
                              {item.age !== undefined && item.age !== null ? `${item.age} ปี` : '-'}
                            </td>

                            {/* 9. Pttype */}
                            <td className="p-2.5 border-r border-slate-200 text-slate-700 text-[11px] text-nowrap whitespace-nowrap">
                              {item.pttypeName || '-'}
                            </td>

                            {/* 10. Diagnosis */}
                            <td className="p-2.5 border-r border-slate-200 text-nowrap whitespace-nowrap">
                              <div className="font-semibold text-blue-900">
                                {item.pdx || '-'}
                              </div>
                              <div className="text-[11px] text-slate-600 truncate max-w-xs" title={item.diagnosisName}>
                                {item.diagnosisName || '-'}
                              </div>
                            </td>

                            {/* 11. Department */}
                            <td className="p-2.5 border-r border-slate-200 text-slate-700 text-[11px] text-nowrap whitespace-nowrap">
                              {item.department || '-'}
                            </td>

                            {/* 12. Doctor */}
                            <td className="p-2.5 text-slate-700 text-[11px] text-nowrap whitespace-nowrap">
                              {item.doctorName || '-'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={13} className="py-8 text-center text-slate-400">
                          <p className="text-xs">ไม่พบรายการสุ่มที่ตรงกับคำค้นหา "{sampleSearchQuery}"</p>
                          <button
                            type="button"
                            onClick={() => {
                              setSampleSearchQuery('');
                              setSampleStatusFilter('all');
                            }}
                            className="mt-2 text-xs text-pink-600 hover:underline font-medium"
                          >
                            ล้างตัวกรองทั้งหมด
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-slate-500 space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  ยังไม่มีการสุ่มตัวอย่างในรอบปัจจุบัน
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  เลือกช่วงวันที่และประเภทเคสที่ต้องการ จากนั้นกดปุ่ม "สุ่มดึงข้อมูลจาก HIS" เพื่อสุ่มชาร์ตเวชระเบียนจากระบบโรงพยาบาล
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* ── 5. History Batches Tab with Searchable Filter & text-nowrap ── */
        <Card>
          <CardHeader className="bg-slate-50/70 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-950 text-sm">ประวัติรอบการสุ่มเวชระเบียน</span>
                <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-sm border border-slate-200">
                  ทั้งหมด {historyBatches.length} รอบ
                </span>
              </div>

              {/* Status Filter Pills & Search */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Tabs */}
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-sm border border-slate-200 text-xs">
                  {[
                    { id: 'all', label: 'ทั้งหมด', count: historyBatches.length },
                    {
                      id: 'active',
                      label: 'เปิดใช้งาน',
                      count: historyBatches.filter((b) => (b.status || 'active') === 'active' && (b.auditedCount || 0) < b.sampleSize).length,
                    },
                    {
                      id: 'completed',
                      label: 'ตรวจครบแล้ว',
                      count: historyBatches.filter((b) => b.status === 'completed' || (b.auditedCount || 0) >= b.sampleSize).length,
                    },
                    {
                      id: 'cancelled',
                      label: 'ยกเลิกแล้ว',
                      count: historyBatches.filter((b) => b.status === 'cancelled').length,
                    },
                  ].map((tab) => {
                    const isActive = historyStatusFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setHistoryStatusFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-sm text-[11px] font-medium transition-colors ${isActive
                          ? 'bg-blue-900 text-white font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    );
                  })}
                </div>

                {/* History Search input */}
                <div className="relative">
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="ค้นหารหัส, ชื่อรอบ, วันที่..."
                    className="px-3 py-1 text-xs rounded-sm border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500 w-48"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 font-medium rounded-sm border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                  title="รีเฟรชประวัติ"
                >
                  {historyLoading ? 'กำลังโหลด...' : 'รีเฟรช'}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredHistoryBatches.length > 0 ? (
              <div className="table-responsive overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-nowrap whitespace-nowrap">
                      <th className="p-2.5 text-center w-10 border-r border-slate-200 text-nowrap whitespace-nowrap">#</th>
                      <th className="p-2.5 text-center w-28 border-r border-slate-200 text-nowrap whitespace-nowrap">เวชระเบียน</th>
                      <th className="p-2.5 text-center w-32 min-w-[125px] border-r border-slate-200 text-nowrap whitespace-nowrap">จัดการ</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[200px] text-nowrap whitespace-nowrap">รหัสรอบ / ชื่อรอบ</th>
                      <th className="p-2.5 border-r border-slate-200 w-36 text-nowrap whitespace-nowrap">วันที่สุ่ม</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[130px] text-nowrap whitespace-nowrap">ประเภทเคส</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[160px] text-nowrap whitespace-nowrap">ช่วงวันที่ตรวจ</th>
                      <th className="p-2.5 text-center border-r border-slate-200 w-24 text-nowrap whitespace-nowrap">ขนาดตัวอย่าง</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[160px] text-nowrap whitespace-nowrap">ความก้าวหน้า</th>
                      <th className="p-2.5 text-center w-28 border-r border-slate-200 text-nowrap whitespace-nowrap">สถานะ</th>
                      <th className="p-2.5 text-center text-nowrap whitespace-nowrap">ผู้ดำเนินการสุ่ม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistoryBatches.map((b, idx) => {
                      const progressPct =
                        b.sampleSize > 0 ? Math.round(((b.auditedCount || 0) / b.sampleSize) * 100) : 0;
                      const isCancelled = b.status === 'cancelled';

                      return (
                        <tr
                          key={b.batchId}
                          className={`hover:bg-slate-50 text-nowrap whitespace-nowrap ${isCancelled ? 'bg-slate-50/60 opacity-80' : ''
                            }`}
                        >
                          {/* 1. # */}
                          <td className="p-2.5 text-center text-slate-500 font-semibold border-r border-slate-200 text-nowrap whitespace-nowrap">
                            {idx + 1}
                          </td>

                          {/* 2. เวชระเบียน (Action: เปิด) */}
                          <td className="p-1.5 text-center border-r border-slate-200 text-nowrap whitespace-nowrap w-28">
                            <button
                              type="button"
                              onClick={() => handleLoadBatchItems(b)}
                              disabled={isCancelled}
                              className="w-full py-1 px-2 rounded-sm text-[11px] font-semibold bg-blue-900 hover:bg-blue-950 text-white shadow-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                              title={isCancelled ? 'รอบการสุ่มนี้ถูกยกเลิกแล้ว' : 'เปิดดูรายการตัวอย่างเวชระเบียนในรอบนี้'}
                            >
                              <span>เปิด</span>
                              <ExternalLink size={11} />
                            </button>
                          </td>

                          {/* 3. จัดการประวัติ (Summary, Edit, Cancel/Restore, Delete) */}
                          <td className="p-2 text-center text-nowrap whitespace-nowrap border-r border-slate-200 w-36 min-w-[140px]">
                            <div className="flex items-center gap-1.5 justify-center">
                              {/* สรุปคะแนนชุดนี้ */}
                              <button
                                type="button"
                                onClick={() => setSummaryModalBatchId(b.batchId)}
                                className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-pink-600 hover:text-pink-700 hover:bg-pink-50/80 hover:border-pink-300 shadow-xs transition-all cursor-pointer"
                                title="ดูสรุปผลคะแนนชุดสุ่มนี้ (Batch Summary Report)"
                              >
                                <Trophy size={16} />
                              </button>

                              {/* แก้ไข */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(b)}
                                disabled={!RBAC.canEditBatch(user?.role)}
                                className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-blue-700 hover:bg-blue-50/80 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 shadow-xs transition-all"
                                title="แก้ไขข้อมูลรอบการสุ่ม"
                              >
                                <Edit3 size={16} />
                              </button>

                              {/* ยกเลิก / คืนสถานะ */}
                              {b.status === 'cancelled' ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleCancel(b)}
                                  disabled={!RBAC.canCancelBatch(user?.role)}
                                  className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/80 hover:border-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-emerald-600 shadow-xs transition-all"
                                  title="คืนสถานะให้เปิดใช้งานรอบนี้อีกครั้ง"
                                >
                                  <RotateCcw size={16} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleCancel(b)}
                                  disabled={!RBAC.canCancelBatch(user?.role)}
                                  className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-amber-600 hover:text-amber-700 hover:bg-amber-50/80 hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-amber-600 shadow-xs transition-all"
                                  title="ยกเลิกรอบการสุ่มนี้"
                                >
                                  <XCircle size={16} />
                                </button>
                              )}

                              {/* ลบ */}
                              <button
                                type="button"
                                onClick={() => handleDeleteBatch(b)}
                                disabled={!RBAC.canDeleteBatch(user?.role)}
                                className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-rose-500 hover:text-rose-700 hover:bg-rose-50/80 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-rose-500 shadow-xs transition-all"
                                title="ลบรอบการสุ่มนี้ออกจากระบบ"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>

                          {/* 4. รหัสรอบ / ชื่อรอบ */}
                          <td className="p-2.5 border-r border-slate-200 text-nowrap whitespace-nowrap min-w-[200px]">
                            <div className="font-bold text-blue-950">{b.batchId}</div>
                            {b.batchName ? (
                              <div className="text-[11px] text-pink-700 font-medium truncate max-w-[200px]" title={b.batchName}>
                                {b.batchName}
                              </div>
                            ) : null}
                            {b.note ? (
                              <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={b.note}>
                                หมายเหตุ: {b.note}
                              </div>
                            ) : null}
                          </td>

                          {/* 5. วันที่สุ่ม */}
                          <td className="p-2.5 text-slate-700 border-r border-slate-200 text-nowrap whitespace-nowrap w-36">
                            {formatThaiDate(b.samplingDate)}
                          </td>

                          {/* 6. ประเภทเคส */}
                          <td className="p-2 border-r border-slate-200 text-nowrap whitespace-nowrap min-w-[130px]">
                            {(() => {
                              const badge = getOpdCaseTypeBadge(b.caseType);
                              return (
                                <span
                                  className={`w-full block text-center px-2 py-0.5 rounded-sm border text-[11px] font-semibold text-nowrap whitespace-nowrap ${badge.className}`}
                                  title={`ประเภทเคส: ${badge.label} (${badge.badge})`}
                                >
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </td>

                          {/* 7. ช่วงวันที่ตรวจ */}
                          <td className="p-2.5 text-slate-600 border-r border-slate-200 text-nowrap whitespace-nowrap min-w-[160px]">
                            {formatThaiDate(b.dateFrom)} - {formatThaiDate(b.dateTo)}
                          </td>

                          {/* 8. ขนาดตัวอย่าง */}
                          <td className="p-2.5 text-center font-bold text-slate-800 border-r border-slate-200 text-nowrap whitespace-nowrap w-24">
                            {b.sampleSize}{' '}
                            <span className="text-[10px] font-normal text-slate-500">
                              / {(b.totalAvailable || 0).toLocaleString()}
                            </span>
                          </td>

                          {/* 9. ความก้าวหน้า */}
                          <td className="p-2.5 border-r border-slate-200 min-w-[160px]">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-bold text-slate-800">
                                {b.auditedCount || 0}/{b.sampleSize} ชาร์ต
                              </span>
                              <span className="font-semibold text-slate-600">{progressPct}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-sm overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${isCancelled
                                  ? 'bg-rose-400'
                                  : progressPct === 100
                                    ? 'bg-emerald-600'
                                    : progressPct > 0
                                      ? 'bg-blue-600'
                                      : 'bg-slate-300'
                                  }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </td>

                          {/* 10. สถานะ */}
                          <td className="p-2 text-center text-nowrap whitespace-nowrap border-r border-slate-200 w-28">
                            {b.status === 'cancelled' ? (
                              <span className="w-full block text-center px-2.5 py-0.5 rounded-sm text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                ยกเลิกแล้ว
                              </span>
                            ) : b.status === 'completed' || (b.auditedCount || 0) >= b.sampleSize ? (
                              <span className="w-full block text-center px-2.5 py-0.5 rounded-sm text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ตรวจครบ
                              </span>
                            ) : (b.auditedCount || 0) > 0 ? (
                              <span className="w-full block text-center px-2.5 py-0.5 rounded-sm text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                กำลังตรวจ
                              </span>
                            ) : (
                              <span className="w-full block text-center px-2.5 py-0.5 rounded-sm text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                รอตรวจ
                              </span>
                            )}
                          </td>

                          {/* 11. ผู้ดำเนินการสุ่ม */}
                          <td className="p-2.5 text-center text-slate-600 text-nowrap whitespace-nowrap min-w-[120px]">
                            {b.createdBy || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">
                <p className="text-xs">
                  {historySearchQuery
                    ? `ไม่พบประวัติรอบการสุ่มที่ตรงกับคำค้นหา "${historySearchQuery}"`
                    : 'ยังไม่มีประวัติรอบการสุ่มในฐานข้อมูล'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Modal: แก้ไขข้อมูลรอบการสุ่มเวชระเบียน ── */}
      {editingBatch && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/80">
              <h3 className="text-sm font-bold text-blue-950">แก้ไขข้อมูลรอบการสุ่ม</h3>
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="text-slate-400 hover:text-slate-600 px-2 py-0.5 text-xs rounded-sm border border-slate-200 bg-white transition-colors"
              >
                ปิด
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  รหัสรอบการสุ่ม (Batch ID)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingBatch.batchId}
                  className="w-full px-3 py-1.5 text-xs rounded-sm border border-slate-200 bg-slate-100 text-slate-500 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  ชื่อรอบการสุ่ม / วัตถุประสงค์
                </label>
                <Input
                  type="text"
                  placeholder="เช่น สุ่มตรวจประจำเดือน, ตรวจคลินิก NCD ไตรมาส 1..."
                  value={editBatchName}
                  onChange={(e) => setEditBatchName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    ผู้ตรวจ / ผู้รับผิดชอบ
                  </label>
                  <Input
                    type="text"
                    placeholder="เช่น นพ.ตรวจสอบ, ทีม MRA..."
                    value={editCreatedBy}
                    onChange={(e) => setEditCreatedBy(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    สถานะรอบ
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-sm border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-pink-500"
                  >
                    <option value="active">เปิดใช้งาน (Active)</option>
                    <option value="completed">ตรวจเสร็จสิ้นแล้ว (Completed)</option>
                    <option value="cancelled">ยกเลิกการใช้งาน (Cancelled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  หมายเหตุเพิ่มเติม
                </label>
                <textarea
                  rows={3}
                  placeholder="บันทึกรายละเอียดเพิ่มเติมของรอบนี้..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-sm border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-sm hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-sm shadow-xs transition-colors disabled:bg-slate-400"
              >
                {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Summary Report Modal */}
      <BatchSummaryModal
        isOpen={Boolean(summaryModalBatchId)}
        onClose={() => setSummaryModalBatchId(null)}
        batchId={summaryModalBatchId || ''}
        serviceType="OPD"
      />

      {/* Manual Sampling Modal */}
      <ManualSamplingModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        mode="opd"
        onSuccess={async (newBatchId) => {
          await loadBatchById(newBatchId, false);
          loadHistory();
          setActiveTab('sampling');
        }}
      />
    </div>
  );
}
