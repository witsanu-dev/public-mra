'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchableSelect, SearchableOption } from '@/components/ui/SearchableSelect';
import { useIpdAuditStore } from '@/store/useIpdAuditStore';
import { useAuthStore } from '@/store/useAuthStore';
import { RBAC } from '@/lib/rbac';
import { alertSuccess, alertError, alertConfirm } from '@/lib/mra-alert';
import {
  Shuffle,
  Building2,
  Calendar,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  ArrowRight,
  RefreshCw,
  Layers,
  X,
  SlidersHorizontal,
  History,
  Trash2,
  Edit3,
  ExternalLink,
  Ban,
  RotateCcw,
  XCircle,
  Trophy,
} from 'lucide-react';
import { BatchSummaryModal } from '@/components/mra/BatchSummaryModal';
import { ManualSamplingModal } from '@/components/mra/ManualSamplingModal';

interface WardOption {
  ward: string;
  name: string;
}

interface IpdSampleVisitItem {
  itemId: string;
  batchId?: string;
  an: string;
  hn: string;
  cid: string;
  patientName: string;
  sex: string;
  age: number;
  admitDate: string;
  admitTime: string;
  dischargeDate: string;
  dischargeTime: string;
  wardCode: string;
  wardName: string;
  pdx: string;
  diagnosisName: string;
  pttypeName: string;
  dischargeStatus: string;
  dischargeType: string;
  lengthOfStay: number;
  doctorName: string;
  auditStatus: 'pending' | 'audited';
}

interface IpdBatchHistoryItem {
  batchId: string;
  batchName?: string;
  samplingDate: string;
  caseType: string;
  dateFrom: string;
  dateTo: string;
  sampleSize: number;
  totalAvailable: number;
  wardCode?: string;
  wardName?: string;
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

export default function IpdSamplingPage() {
  const router = useRouter();
  const { loadSampledIpdVisit } = useIpdAuditStore();

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
  const [wards, setWards] = useState<WardOption[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [isHisOffline, setIsHisOffline] = useState(false);

  // Quick date presets
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
  const { user } = useAuthStore();

  // Form states
  const [dateFrom, setDateFrom] = useState(initialDates.fromStr);
  const [dateTo, setDateTo] = useState(initialDates.toStr);
  const [caseType, setCaseType] = useState<'all' | 'medical' | 'surgical' | 'pediatric' | 'obgyn' | 'psychiatric'>('all');
  const [wardCode, setWardCode] = useState('');
  const [sampleSize, setSampleSize] = useState(10);
  const [batchName, setBatchName] = useState('');
  const [batchNote, setBatchNote] = useState('');

  // Sampling result states
  const [isSampling, setIsSampling] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [currentBatchName, setCurrentBatchName] = useState<string>('');
  const [totalAvailable, setTotalAvailable] = useState<number | null>(null);
  const [samples, setSamples] = useState<IpdSampleVisitItem[]>([]);
  const [historyBatches, setHistoryBatches] = useState<IpdBatchHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // In-table search & filter states for Sampled Visits
  const [sampleSearchQuery, setSampleSearchQuery] = useState('');
  const [sampleStatusFilter, setSampleStatusFilter] = useState<'all' | 'pending' | 'audited'>('all');

  // In-table search & status filter for History Batches
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  // Modal: Edit Batch states
  const [editingBatch, setEditingBatch] = useState<IpdBatchHistoryItem | null>(null);
  const [editBatchName, setEditBatchName] = useState('');
  const [editCreatedBy, setEditCreatedBy] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [editNote, setEditNote] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Dual horizontal scrollbars: Current Sample
  const topSampleScrollRef = useRef<HTMLDivElement>(null);
  const bottomSampleScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingSampleScroll = useRef(false);
  const [sampleScrollWidth, setSampleScrollWidth] = useState(1300);

  // Dual horizontal scrollbars: History
  const topHistoryScrollRef = useRef<HTMLDivElement>(null);
  const bottomHistoryScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingHistoryScroll = useRef(false);
  const [historyScrollWidth, setHistoryScrollWidth] = useState(1200);

  /** Helper to get contextual color badge for wards */
  const getWardBadgeClass = (name: string): string => {
    if (!name) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (name.includes('อายุร') || name.includes('หญิง') || name.includes('ชาย')) {
      return 'bg-blue-50 text-blue-800 border-blue-200';
    }
    if (name.includes('ศัลย') || name.includes('ผ่าตัด')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (name.includes('กุมาร') || name.includes('เด็ก')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (name.includes('สูติ') || name.includes('นรี') || name.includes('คลอด')) {
      return 'bg-pink-50 text-pink-800 border-pink-200';
    }
    if (name.includes('จิต') || name.includes('ฟื้นฟู')) {
      return 'bg-purple-50 text-purple-800 border-purple-200';
    }
    if (name.includes('ICU') || name.includes('วิกฤต')) {
      return 'bg-rose-50 text-rose-800 border-rose-200';
    }
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  /** Helper to get contextual color badge for IPD case types */
  const getIpdCaseTypeBadge = (type?: string) => {
    switch (type) {
      case 'medical':
        return {
          label: 'อายุรกรรม',
          className: 'bg-blue-50 text-blue-800 border-blue-200',
        };
      case 'surgical':
        return {
          label: 'ศัลยกรรม',
          className: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'pediatric':
        return {
          label: 'เด็ก ≤ 15',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'obgyn':
        return {
          label: 'สูติ-นรี',
          className: 'bg-pink-50 text-pink-800 border-pink-200',
        };
      case 'psychiatric':
        return {
          label: 'จิตเวช',
          className: 'bg-purple-50 text-purple-800 border-purple-200',
        };
      case 'all':
      default:
        return {
          label: 'ทั้งหมด',
          className: 'bg-slate-100 text-slate-800 border-slate-200',
        };
    }
  };

  // 1. Fetch metadata on load
  useEffect(() => {
    async function loadMeta() {
      try {
        setMetaLoading(true);
        const res = await fetch('/api/his/ipd-meta');
        const json = await res.json().catch(() => null);
        if (json?.isHisOffline) {
          setIsHisOffline(true);
        } else if (json?.success) {
          setIsHisOffline(false);
        }
        if (json?.data) {
          setHospitalInfo(json.data);
          setWards(json.data.wards || []);
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

  // Support direct loading via ?batchId=... (e.g. returning from IPD audit page) or ?caseType=...
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const bId = params.get('batchId');
      if (bId) {
        loadBatchById(bId, true);
      }
      const cType = params.get('caseType');
      if (cType && ['all', 'medical', 'surgical', 'pediatric', 'obgyn', 'psychiatric'].includes(cType)) {
        setCaseType(cType as any);
      }
    }
  }, []);

  // 2. Fetch history batches
  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch('/api/mra/ipd-batches');
      const json = await res.json();
      if (json.success && json.data) {
        setHistoryBatches(json.data);
      }
    } catch (err) {
      console.error('Failed to load IPD batches:', err);
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
      alertError({ title: 'กรุณาระบุช่วงวันที่จำหน่าย', text: 'ต้องระบุวันที่เริ่มต้นและวันที่สิ้นสุด' });
      return;
    }

    if (sampleSize <= 0) {
      alertError({ title: 'จำนวนตัวอย่างไม่ถูกต้อง', text: 'จำนวนตัวอย่างต้องมากกว่า 0' });
      return;
    }

    try {
      setIsSampling(true);
      setSamples([]);
      setCurrentBatchId(null);

      const res = await fetch('/api/his/ipd-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseType,
          dateFrom,
          dateTo,
          sampleSize,
          wardCode: wardCode || undefined,
          batchName: batchName.trim() || undefined,
          note: batchNote.trim() || undefined,
          auditorName: user?.fullName || 'ผู้ตรวจประเมิน IPD',
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
          title: 'การสุ่มตรวจล้มเหลว',
          text: json?.error || 'เกิดข้อผิดพลาดในการสุ่มตรวจเวชระเบียนผู้ป่วยในจาก HIS',
        });
        return;
      }

      const { batchId, batchName: resBatchName, totalAvailable: total, samples: sampleList, message } = json.data;

      setTotalAvailable(total);
      setCurrentBatchId(batchId);
      setCurrentBatchName(resBatchName);
      setSamples(sampleList || []);
      loadHistory();

      if (total === 0) {
        alertError({
          title: 'ไม่พบข้อมูลตามเงื่อนไข',
          text: message || 'ไม่พบผู้ป่วยในที่จำหน่ายในช่วงเวลาและเงื่อนไขที่เลือก',
        });
      } else {
        alertSuccess(
          'สุ่มตรวจเวชระเบียน IPD สำเร็จ!',
          `สุ่มได้จำนวน ${sampleList.length} เคส จากทั้งหมด ${total.toLocaleString()} เคส (รหัสชุด: ${batchId})`
        );
      }
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

  // Convert wards to SearchableSelect options
  const wardSelectOptions: SearchableOption[] = useMemo(() => {
    return [
      { value: '', label: 'ทุกหอผู้ป่วย' },
      ...wards.map((w) => ({
        value: w.ward,
        label: `${w.ward} : ${w.name}`,
      })),
    ];
  }, [wards]);

  // Filtered samples
  const filteredSamples = useMemo(() => {
    return samples.filter((item) => {
      if (sampleStatusFilter !== 'all' && item.auditStatus !== sampleStatusFilter) {
        return false;
      }
      const q = sampleSearchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        item.hn.toLowerCase().includes(q) ||
        item.an.toLowerCase().includes(q) ||
        (item.patientName || '').toLowerCase().includes(q) ||
        (item.wardName || '').toLowerCase().includes(q) ||
        (item.pdx || '').toLowerCase().includes(q) ||
        (item.diagnosisName || '').toLowerCase().includes(q)
      );
    });
  }, [samples, sampleStatusFilter, sampleSearchQuery]);

  // Filtered history batches
  const filteredHistoryBatches = useMemo(() => {
    return historyBatches.filter((b) => {
      if (historyStatusFilter !== 'all' && (b.status || 'active') !== historyStatusFilter) {
        return false;
      }
      const q = historySearchQuery.trim().toLowerCase();
      if (!q) return true;
      const caseBadge = getIpdCaseTypeBadge(b.caseType);
      return (
        b.batchId.toLowerCase().includes(q) ||
        (b.batchName || '').toLowerCase().includes(q) ||
        (b.wardName || '').toLowerCase().includes(q) ||
        (b.caseType || '').toLowerCase().includes(q) ||
        caseBadge.label.toLowerCase().includes(q) ||
        (b.createdBy || '').toLowerCase().includes(q) ||
        (b.note || '').toLowerCase().includes(q)
      );
    });
  }, [historyBatches, historyStatusFilter, historySearchQuery]);

  // Current batch object in history (for immediate reactive status display)
  const currentBatchObj = useMemo(
    () => historyBatches.find((b) => b.batchId === currentBatchId),
    [historyBatches, currentBatchId]
  );

  // Load items from an existing IPD batch by ID (supports direct URL access ?batchId=...)
  const loadBatchById = async (batchId: string, silent = false) => {
    try {
      setIsSampling(true);
      const res = await fetch(`/api/mra/ipd-batches?batchId=${encodeURIComponent(batchId)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCurrentBatchId(batchId);
        const matched = historyBatches.find((b) => b.batchId === batchId);
        if (matched) {
          setCurrentBatchName(matched.batchName || `การสุ่ม ${batchId}`);
          setTotalAvailable(matched.totalAvailable);
          if (matched.caseType) setCaseType(matched.caseType as any);
          if (matched.wardCode !== undefined) setWardCode(matched.wardCode || '');
        } else {
          setCurrentBatchName(`การสุ่ม ${batchId}`);
        }
        setSamples(json.data);
        setActiveTab('sampling');
        if (!silent) {
          alertSuccess(
            'เปิดการสุ่มตรวจสำเร็จ',
            `โหลดข้อมูลการสุ่ม ${batchId} (${json.data.length} รายการ) เรียบร้อยแล้ว`
          );
        }
      }
    } catch (err) {
      console.error('Error opening batch:', err);
      if (!silent) {
        alertError({ title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถเปิดข้อมูลการสุ่มตรวจนี้ได้' });
      }
    } finally {
      setIsSampling(false);
    }
  };

  // Open IPD Audit page with selected sample item
  const handleOpenAudit = (item: IpdSampleVisitItem) => {
    const isItemPsychiatric =
      caseType === 'psychiatric' ||
      /^F[0-9]/i.test(item.pdx || '') ||
      item.wardName?.includes('จิตเวช') ||
      item.diagnosisName?.includes('จิตเวช');

    const bId = item.batchId || currentBatchId || undefined;

    loadSampledIpdVisit({
      an: item.an,
      hn: item.hn,
      cid: item.cid,
      patientName: item.patientName,
      sex: item.sex,
      age: item.age,
      wardCode: item.wardCode,
      wardName: item.wardName,
      admitDate: item.admitDate,
      admitTime: item.admitTime,
      dischargeDate: item.dischargeDate,
      dischargeTime: item.dischargeTime,
      lengthOfStay: item.lengthOfStay,
      dischargeStatus: item.dischargeStatus,
      dischargeType: item.dischargeType,
      diagnosis: item.pdx ? `${item.pdx}: ${item.diagnosisName}` : item.diagnosisName,
      caseType: isItemPsychiatric ? 'psychiatric' : 'general',
      itemId: item.itemId,
      batchId: bId,
      hcode: hospitalInfo.hcode,
      hname: hospitalInfo.hname,
    });
    router.push(bId ? `/ipd?batchId=${encodeURIComponent(bId)}&an=${encodeURIComponent(item.an)}` : `/ipd?an=${encodeURIComponent(item.an)}`);
  };

  // Open existing batch from history
  const handleOpenBatchFromHistory = async (batch: IpdBatchHistoryItem) => {
    if (batch.caseType) {
      setCaseType(batch.caseType as any);
    }
    if (batch.wardCode !== undefined) {
      setWardCode(batch.wardCode || '');
    }
    await loadBatchById(batch.batchId, false);
  };

  // Delete batch with safety guard for audited items
  const handleDeleteBatch = async (bOrId: IpdBatchHistoryItem | string) => {
    if (!RBAC.canDeleteBatch(user?.role)) {
      alertError({ title: 'ไม่มีสิทธิ์ดำเนินการ', text: 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถลบข้อมูลการสุ่มตรวจได้' });
      return;
    }

    const batchId = typeof bOrId === 'string' ? bOrId : bOrId.batchId;
    const batchObj = typeof bOrId === 'object' ? bOrId : historyBatches.find((h) => h.batchId === batchId);
    const auditedCount = batchObj?.auditedCount || 0;
    const hasAudited = auditedCount > 0;

    let confirmTitle = 'ยืนยันการลบข้อมูลการสุ่มตรวจ?';
    let confirmText = `คุณต้องการลบข้อมูลการสุ่มตรวจ ${batchId} ใช่หรือไม่? ข้อมูลการสุ่มทั้งหมดจะถูกลบ`;
    let isForce = false;

    if (hasAudited) {
      confirmTitle = `ชุดนี้มีการตรวจประเมินแล้ว ${auditedCount} เคส`;
      confirmText = `ชุดนี้มีเคสที่ตรวจประเมินและบันทึกผลแล้ว ${auditedCount} เคส หากยืนยันลบถาวร ระบบจะลบข้อมูลการสุ่มนี้พร้อมผลการตรวจประเมินทั้งหมดที่เกี่ยวข้องออกจากฐานข้อมูลอย่างสมบูรณ์ (หรือแนะนำให้เลือก "ยกเลิก" เพื่อคงข้อมูลไว้)`;
      isForce = true;
    }

    const isConfirmed = await alertConfirm({
      title: confirmTitle,
      text: confirmText,
      confirmText: hasAudited ? 'ยืนยันลบถาวร' : 'ลบข้อมูลการสุ่ม',
      cancelText: 'ยกเลิก',
      icon: 'warning',
      danger: true,
    });
    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/mra/ipd-batches?batchId=${batchId}${isForce ? '&force=true' : ''}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ลบข้อมูลการสุ่มตรวจไม่สำเร็จ');
      }
      alertSuccess('ลบข้อมูลการสุ่มตรวจสำเร็จ', `ลบข้อมูลการสุ่มตรวจ ${batchId} เรียบร้อยแล้ว`);
      loadHistory();
      if (currentBatchId === batchId) {
        setSamples([]);
        setCurrentBatchId(null);
      }
    } catch (err) {
      alertError({
        title: 'ลบล้มเหลว',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบข้อมูลการสุ่ม',
      });
    }
  };

  // Revoke / Cancel audit for a single sampled IPD case
  const handleRevokeCaseAudit = async (item: IpdSampleVisitItem) => {
    if (!RBAC.canRevokeAudit(user?.role)) {
      alertError({ title: 'ไม่มีสิทธิ์ดำเนินการ', text: 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถยกเลิกผลการตรวจประเมินได้' });
      return;
    }

    const ok = await alertConfirm({
      title: 'ยกเลิกผลการตรวจประเมินเคสนี้?',
      text: `ต้องการยกเลิกผลการตรวจของ ${item.patientName || item.hn} (AN: ${item.an}) ใช่หรือไม่? ข้อมูลคะแนนจะถูกลบ และสถานะของเคสนี้จะกลับเป็น "รอตรวจ"`,
      confirmText: 'ยกเลิกการตรวจ',
      cancelText: 'ย้อนกลับ',
      icon: 'warning',
      danger: true,
    });
    if (!ok) return;

    try {
      const params = new URLSearchParams();
      if (item.itemId) params.set('itemId', item.itemId);
      if (item.an) params.set('an', item.an);

      const res = await fetch(`/api/mra/ipd-audit?${params.toString()}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        alertSuccess('ยกเลิกสำเร็จ', 'ยกเลิกผลการตรวจประเมิน IPD เรียบร้อยแล้ว สถานะเปลี่ยนกลับเป็นรอตรวจ');
        setSamples((prev) =>
          prev.map((s) =>
            (s.itemId && s.itemId === item.itemId) || s.an === item.an
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

  // Change batch status
  const handleBatchStatusAction = async (batchId: string, action: 'cancel' | 'reactivate' | 'complete') => {
    if (!RBAC.canDeleteBatch(user?.role)) {
      alertError({ title: 'ไม่มีสิทธิ์ดำเนินการ', text: 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถเปลี่ยนสถานะรอบการสุ่มได้' });
      return;
    }

    const actionLabel =
      action === 'cancel' ? 'ยกเลิก' : action === 'reactivate' ? 'เปิดใช้งานการสุ่ม' : 'ปิดการสุ่มตรวจ';
    const isConfirmed = await alertConfirm({
      title: `ยืนยันการ${actionLabel}?`,
      text: `คุณต้องการ${actionLabel} (${batchId}) ใช่หรือไม่?`,
      confirmText: actionLabel,
      danger: action === 'cancel',
    });
    if (!isConfirmed) return;

    try {
      const res = await fetch('/api/mra/ipd-batches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'อัปเดตสถานะไม่สำเร็จ');

      const nextStatus: 'active' | 'completed' | 'cancelled' =
        action === 'cancel' ? 'cancelled' : action === 'reactivate' ? 'active' : 'completed';

      setHistoryBatches((prev) => {
        const exists = prev.some((b) => b.batchId === batchId);
        if (exists) {
          return prev.map((b) => (b.batchId === batchId ? { ...b, status: nextStatus } : b));
        } else {
          return [
            {
              batchId,
              batchName: currentBatchName,
              samplingDate: new Date().toISOString(),
              caseType,
              dateFrom,
              dateTo,
              sampleSize: samples.length,
              totalAvailable: totalAvailable || samples.length,
              wardCode,
              createdBy: user?.fullName || 'ผู้ตรวจประเมิน IPD',
              auditedCount: samples.filter((s) => s.auditStatus === 'audited').length,
              status: nextStatus,
            },
            ...prev,
          ];
        }
      });

      alertSuccess('สำเร็จ', json.data?.message || 'อัปเดตสถานะเรียบร้อย');
      loadHistory();
    } catch (err) {
      alertError({ title: 'เกิดข้อผิดพลาด', text: err instanceof Error ? err.message : 'อัปเดตสถานะไม่สำเร็จ' });
    }
  };

  // Synchronize Scrollbars: Sample Table
  const handleSampleTopScroll = () => {
    if (isSyncingSampleScroll.current) return;
    if (topSampleScrollRef.current && bottomSampleScrollRef.current) {
      isSyncingSampleScroll.current = true;
      bottomSampleScrollRef.current.scrollLeft = topSampleScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingSampleScroll.current = false;
      });
    }
  };

  const handleSampleBottomScroll = () => {
    if (isSyncingSampleScroll.current) return;
    if (topSampleScrollRef.current && bottomSampleScrollRef.current) {
      isSyncingSampleScroll.current = true;
      topSampleScrollRef.current.scrollLeft = bottomSampleScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingSampleScroll.current = false;
      });
    }
  };

  // Synchronize Scrollbars: History Table
  const handleHistoryTopScroll = () => {
    if (isSyncingHistoryScroll.current) return;
    if (topHistoryScrollRef.current && bottomHistoryScrollRef.current) {
      isSyncingHistoryScroll.current = true;
      bottomHistoryScrollRef.current.scrollLeft = topHistoryScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingHistoryScroll.current = false;
      });
    }
  };

  const handleHistoryBottomScroll = () => {
    if (isSyncingHistoryScroll.current) return;
    if (topHistoryScrollRef.current && bottomHistoryScrollRef.current) {
      isSyncingHistoryScroll.current = true;
      topHistoryScrollRef.current.scrollLeft = bottomHistoryScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingHistoryScroll.current = false;
      });
    }
  };

  useEffect(() => {
    if (bottomSampleScrollRef.current) {
      const sw = bottomSampleScrollRef.current.scrollWidth;
      if (sw > 0) setSampleScrollWidth(sw);
    }
  }, [filteredSamples]);

  useEffect(() => {
    if (bottomHistoryScrollRef.current) {
      const sw = bottomHistoryScrollRef.current.scrollWidth;
      if (sw > 0) setHistoryScrollWidth(sw);
    }
  }, [filteredHistoryBatches]);

  return (
    <div className="section-gap pb-16">
      {/* ── Page Header ── */}
      <div className="bg-white p-4 md:p-5 rounded-sm border border-slate-200 shadow-xs space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-pink-50 text-pink-700 border border-pink-200">
              IPD Sampling
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Building2 size={13} className="text-slate-400" />
              <span>
                {hospitalInfo.hname || 'โรงพยาบาลกมลาไสย'} ({hospitalInfo.hcode || '11078'})
              </span>
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-blue-950 leading-snug flex items-center gap-2">
                <Shuffle className="text-blue-900" size={20} />
                <span>สุ่มตรวจเวชระเบียนผู้ป่วยใน (IPD)</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                สุ่มตัวอย่างเวชระเบียนผู้ป่วยในตามมาตรฐานคู่มือ MRA สปสช.
              </p>
            </div>

            {/* Tab switchers */}
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

      {/* ── TAB 1: NEW SAMPLING ── */}
      {activeTab === 'sampling' && (
        <div className="space-y-4">
          {/* Filter Card */}
          <Card className="border border-slate-200 shadow-xs bg-white rounded-sm">
            <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-blue-900" />
                <span>กำหนดการสุ่มเวชระเบียนผู้ป่วยใน</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Presets + Date Range */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-900" />
                    <span>ช่วงวันที่จำหน่ายผู้ป่วย</span>
                  </label>

                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap items-center gap-1">
                    {(['today', 'yesterday', '7days', '30days'] as const).map((p) => {
                      const labels = {
                        today: 'วันนี้',
                        yesterday: 'เมื่อวาน',
                        '7days': '7 วันล่าสุด',
                        '30days': '30 วันล่าสุด',
                      };
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => applyDatePreset(p)}
                          className={`px-2.5 py-1 rounded-sm text-[11px] font-semibold transition-colors ${activeDatePreset === p
                            ? 'bg-blue-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                          {labels[p]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium mb-1 block">ตั้งแต่วันที่</span>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setActiveDatePreset(null);
                      }}
                      className="text-xs h-9"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium mb-1 block">ถึงวันที่</span>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setActiveDatePreset(null);
                      }}
                      className="text-xs h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Ward and Case Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100 relative z-50">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    หอผู้ป่วย
                  </label>
                  <SearchableSelect
                    options={wardSelectOptions}
                    value={wardCode}
                    onChange={(val) => setWardCode(val)}
                    placeholder="-- ทุกหอผู้ป่วย --"
                    disabled={metaLoading}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    ประเภทเคสผู้ป่วยใน
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { id: 'all', label: 'ทั้งหมด' },
                      { id: 'medical', label: 'อายุรกรรม' },
                      { id: 'surgical', label: 'ศัลยกรรม' },
                      { id: 'pediatric', label: 'เด็ก ≤ 15' },
                      { id: 'obgyn', label: 'สูติ-นรี' },
                      { id: 'psychiatric', label: 'จิตเวช' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setCaseType(t.id as any)}
                        className={`px-2 py-2 rounded-sm text-[11px] font-semibold border transition-all text-center ${caseType === t.id
                          ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sample Size & Batch Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100 relative z-40">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      ขนาดตัวอย่างที่สุ่ม (ชาร์ต)
                    </label>
                    <div className="flex items-center gap-1">
                      {[5, 10, 20, 30].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSampleSize(sz)}
                          className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${sampleSize === sz
                            ? 'bg-blue-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={sampleSize}
                    onChange={(e) => setSampleSize(parseInt(e.target.value, 10) || 1)}
                    className="text-xs h-9"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    ชื่อการสุ่มตรวจ (ไม่ระบุก็ได้)
                  </label>
                  <Input
                    type="text"
                    placeholder="เช่น สุ่มตรวจประจำเดือน มีนาคม 2567"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    บันทึกเพิ่มเติม
                  </label>
                  <Input
                    type="text"
                    placeholder="ระบุหมายเหตุ เช่น โครงการตรวจความสมบูรณ์ฯ"
                    value={batchNote}
                    onChange={(e) => setBatchNote(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                {isHisOffline && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>ไม่ได้เชื่อมต่อ HIS (กรุณาใช้ปุ่ม &quot;บันทึกตัวอย่าง&quot;)</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handlePerformSampling}
                  disabled={isSampling || metaLoading || isHisOffline || !RBAC.canCreateSample(user?.role)}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-950 disabled:bg-slate-300 disabled:text-slate-500 rounded-sm flex items-center gap-2 shadow-sm transition-all disabled:cursor-not-allowed"
                  title={isHisOffline ? 'ไม่ได้เชื่อมต่อฐานข้อมูล HIS (กรุณาใช้ปุ่ม "บันทึกตัวอย่าง")' : 'สุ่มตัวอย่างจาก HIS'}
                >
                  <Shuffle size={15} className={isSampling ? 'animate-spin' : ''} />
                  <span>
                    {isSampling
                      ? 'กำลังสุ่มตัวอย่างจาก HIS...'
                      : isHisOffline
                        ? 'ไม่ได้เชื่อมต่อ HIS'
                        : 'สุ่มตัวอย่างจาก HIS'}
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* ── Results Section ── */}
          {samples.length > 0 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-blue-50/60 rounded-sm border border-blue-200">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-blue-800">รหัสการสุ่มตรวจ</span>
                    {currentBatchObj && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm border ${currentBatchObj.status === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : currentBatchObj.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border-blue-300'
                          }`}
                      >
                        {currentBatchObj.status === 'cancelled'
                          ? 'ยกเลิกแล้ว'
                          : currentBatchObj.status === 'completed'
                            ? 'ตรวจครบแล้ว'
                            : 'เปิดใช้งาน'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-blue-950 mt-0.5 truncate" title={currentBatchId || ''}>
                    {currentBatchId || '-'}
                  </div>
                  <div className="text-[10px] text-blue-700 mt-1 truncate">{currentBatchName}</div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-sm border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-600">รายการทั้งหมดตามเกณฑ์</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {totalAvailable !== null ? totalAvailable.toLocaleString() : '-'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">ผู้ป่วยในที่จำหน่าย</div>
                </div>

                <div className="p-3.5 bg-emerald-50/60 rounded-sm border border-emerald-200">
                  <div className="text-[11px] font-semibold text-emerald-800">สุ่มตัวอย่างได้</div>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">
                    {samples.length}{' '}
                    <span className="text-xs font-normal text-emerald-600">เคส</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-1">
                    {totalAvailable && totalAvailable > 0
                      ? `อัตราการสุ่ม ${((samples.length / totalAvailable) * 100).toFixed(1)}%`
                      : ''}
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50/60 rounded-sm border border-amber-200">
                  <div className="text-[11px] font-semibold text-amber-800">ความก้าวหน้าการตรวจ</div>
                  <div className="text-xl font-black text-amber-700 mt-0.5">
                    {samples.filter((s) => s.auditStatus === 'audited').length}/{samples.length}
                  </div>
                  <div className="text-[10px] text-amber-700 mt-1">
                    ตรวจแล้ว{' '}
                    {Math.round(
                      (samples.filter((s) => s.auditStatus === 'audited').length / samples.length) * 100
                    )}
                    %
                  </div>
                </div>
              </div>

              {/* Table Card */}
              <Card className="border border-slate-200 shadow-xs bg-white overflow-hidden">
                <CardHeader className="p-4 bg-slate-50/60 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileText size={16} className="text-blue-900" />
                      <span>รายการเวชระเบียนผู้ป่วยในที่สุ่มได้ ({filteredSamples.length} รายการ)</span>
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
                    </CardTitle>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      คลิกปุ่ม &quot;เปิดตรวจเวชระเบียน&quot; เพื่อดึงข้อมูลเข้าสู่แบบประเมินผู้ป่วยในทันที
                    </p>
                  </div>

                  {/* Filter, search and action */}
                  <div className="flex flex-wrap items-center gap-2">
                    {currentBatchId && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSummaryModalBatchId(currentBatchId)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                          title="ดูสรุปผลคะแนนชุดสุ่มนี้ (Batch Summary)"
                        >
                          <Trophy size={13} className="text-blue-700" />
                          <span>สรุปคะแนน</span>
                        </button>
                        {currentBatchObj?.status === 'cancelled' ? (
                          <button
                            type="button"
                            disabled={!RBAC.canDeleteBatch(user?.role)}
                            onClick={() => handleBatchStatusAction(currentBatchId, 'reactivate')}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-50 border border-emerald-300 rounded-sm flex items-center gap-1.5 transition-colors shrink-0"
                            title="คืนสถานะให้เปิดใช้งานรอบนี้อีกครั้ง"
                          >
                            <RotateCcw size={13} className="text-emerald-600" />
                            <span>คืนสถานะ</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!RBAC.canDeleteBatch(user?.role)}
                            onClick={() => handleBatchStatusAction(currentBatchId, 'cancel')}
                            className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-50 border border-amber-300 rounded-sm flex items-center gap-1.5 transition-colors shrink-0"
                            title="ยกเลิกรอบการสุ่มนี้"
                          >
                            <XCircle size={13} className="text-amber-600" />
                            <span>ยกเลิก</span>
                          </button>
                        )}
                      </>
                    )}
                    <div className="relative min-w-[200px]">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="ค้นหา AN, HN, ชื่อ, PDx..."
                        value={sampleSearchQuery}
                        onChange={(e) => setSampleSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-sm text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSampleStatusFilter('all')}
                        className={`px-2 py-0.5 rounded-sm font-semibold ${sampleStatusFilter === 'all'
                          ? 'bg-blue-900 text-white'
                          : 'text-slate-600 hover:bg-slate-200'
                          }`}
                      >
                        ทั้งหมด
                      </button>
                      <button
                        type="button"
                        onClick={() => setSampleStatusFilter('pending')}
                        className={`px-2 py-0.5 rounded-sm font-semibold ${sampleStatusFilter === 'pending'
                          ? 'bg-amber-600 text-white'
                          : 'text-amber-700 hover:bg-amber-100'
                          }`}
                      >
                        รอตรวจ
                      </button>
                      <button
                        type="button"
                        onClick={() => setSampleStatusFilter('audited')}
                        className={`px-2 py-0.5 rounded-sm font-semibold ${sampleStatusFilter === 'audited'
                          ? 'bg-emerald-600 text-white'
                          : 'text-emerald-700 hover:bg-emerald-100'
                          }`}
                      >
                        ตรวจแล้ว
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {/* Top Horizontal Scrollbar */}
                  <div
                    ref={topSampleScrollRef}
                    onScroll={handleSampleTopScroll}
                    className="overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-50/70 py-1"
                    title="เลื่อนเพื่อดูคอลัมน์ของตาราง"
                  >
                    <div style={{ width: `${sampleScrollWidth}px`, height: '1px' }} />
                  </div>

                  {/* Main Table */}
                  <div
                    ref={bottomSampleScrollRef}
                    onScroll={handleSampleBottomScroll}
                    className="table-responsive overflow-x-auto max-h-[60vh]"
                  >
                    <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 text-nowrap whitespace-nowrap">
                          <th className="p-2.5 text-center w-10 border-r border-slate-200">#</th>
                          <th className="p-2.5 text-center w-32 min-w-[125px] border-r border-slate-200">เวชระเบียน</th>
                          <th className="p-2.5 text-center w-32 min-w-[125px] border-r border-slate-200">จัดการ</th>
                          <th className="p-2.5 text-center w-24 border-r border-slate-200">สถานะ</th>
                          <th className="p-2.5 border-r border-slate-200 w-28">AN / HN</th>
                          <th className="p-2.5 border-r border-slate-200 min-w-[180px]">ชื่อ-สกุล ผู้ป่วย</th>
                          <th className="p-2.5 text-center border-r border-slate-200 w-16">เพศ</th>
                          <th className="p-2.5 text-center border-r border-slate-200 w-16">อายุ</th>
                          <th className="p-2.5 text-center border-r border-slate-200 min-w-[140px]">หอผู้ป่วย</th>
                          <th className="p-2.5 border-r border-slate-200 w-36 min-w-[145px]">วันรับตัว (Admit)</th>
                          <th className="p-2.5 border-r border-slate-200 w-36 min-w-[145px]">วันจำหน่าย (Discharge)</th>
                          <th className="p-2.5 text-center border-r border-slate-200 w-24">วันนอน (LOS)</th>
                          <th className="p-2.5 border-r border-slate-200 min-w-[220px]">การวินิจฉัยโรค (PDx)</th>
                          <th className="p-2.5 min-w-[150px]">สิทธิการรักษา</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredSamples.map((item, idx) => {
                          const isAudited = item.auditStatus === 'audited';
                          return (
                            <tr
                              key={item.itemId}
                              className="hover:bg-slate-50 transition-colors text-nowrap whitespace-nowrap"
                            >
                              <td className="p-2 text-center text-slate-500 font-semibold border-r border-slate-200">
                                {idx + 1}
                              </td>
                              {/* เวชระเบียน: Audit Button */}
                              <td className="p-1.5 text-center border-r border-slate-200 w-32 min-w-[125px]">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAudit(item)}
                                  className={`w-full py-1.5 px-2.5 rounded-sm text-[11px] font-semibold shadow-xs flex items-center justify-center transition-colors cursor-pointer ${isAudited
                                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                    : 'bg-blue-900 hover:bg-blue-950 text-white'
                                    }`}
                                >
                                  <span>{isAudited ? 'ทบทวนเวชระเบียน' : 'ตรวจเวชระเบียน'}</span>
                                </button>
                              </td>

                              {/* จัดการ: ยกเลิกการตรวจ */}
                              <td className="p-1.5 text-center border-r border-slate-200 w-32 min-w-[125px]">
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
                              <td className="p-2 text-center border-r border-slate-200 w-24">
                                {isAudited ? (
                                  <span className="w-full block text-center px-2 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    ตรวจแล้ว
                                  </span>
                                ) : (
                                  <span className="w-full block text-center px-2 py-0.5 rounded-sm text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    รอตรวจ
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-bold text-blue-950">AN: {item.an}</div>
                                <div className="text-[10px] text-slate-500">HN: {item.hn}</div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-900">
                                {item.patientName || '-'}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 text-slate-700">
                                {item.sex || '-'}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 text-slate-700">
                                {item.age ? `${item.age} ปี` : '-'}
                              </td>
                              <td className="p-2 text-center border-r border-slate-200">
                                <span
                                  className={`w-full inline-block text-center px-2 py-0.5 rounded-sm text-[11px] font-semibold border ${getWardBadgeClass(
                                    item.wardName
                                  )}`}
                                >
                                  {item.wardName || 'ไม่ระบุหอผู้ป่วย'}
                                </span>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-slate-900">{formatThaiDate(item.admitDate)}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Clock size={11} />
                                  <span>{formatThaiTime(item.admitTime)}</span>
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-slate-900">{formatThaiDate(item.dischargeDate)}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Clock size={11} />
                                  <span>{formatThaiTime(item.dischargeTime)}</span>
                                </div>
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 font-bold text-blue-900 bg-blue-50/40">
                                {item.lengthOfStay} วัน
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-blue-900">{item.pdx || '-'}</div>
                                <div className="text-[11px] text-slate-600 truncate max-w-xs" title={item.diagnosisName}>
                                  {item.diagnosisName || '-'}
                                </div>
                              </td>
                              <td className="p-2.5 text-slate-700 text-[11px]">
                                {item.pttypeName || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: BATCH HISTORY ── */}
      {activeTab === 'history' && (
        <Card className="border border-slate-200 shadow-xs bg-white overflow-hidden">
          <CardHeader className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History size={16} className="text-blue-900" />
                <span>ประวัติการสุ่มตรวจเวชระเบียนผู้ป่วยใน ({filteredHistoryBatches.length} ชุด)</span>
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ติดตามความก้าวหน้า เปิดตรวจ หรือจัดการการสุ่มที่เคยสร้างไว้
              </p>
            </div>

            {/* In-table search and status */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหารหัสชุด, ชื่อ, หอผู้ป่วย..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-sm text-[11px]">
                {(['all', 'active', 'completed', 'cancelled'] as const).map((st) => {
                  const labels = {
                    all: 'ทั้งหมด',
                    active: 'ใช้งาน',
                    completed: 'เสร็จสิ้น',
                    cancelled: 'ยกเลิก',
                  };
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setHistoryStatusFilter(st)}
                      className={`px-2 py-0.5 rounded-sm font-semibold transition-colors ${historyStatusFilter === st
                        ? 'bg-blue-900 text-white'
                        : 'text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      {labels[st]}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={loadHistory}
                disabled={historyLoading}
                className="p-1.5 text-slate-600 bg-white border border-slate-300 rounded-sm hover:bg-slate-50"
                title="รีเฟรชประวัติ"
              >
                <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {historyLoading ? (
              <div className="py-16 text-center space-y-2">
                <RefreshCw size={24} className="animate-spin text-blue-900 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">กำลังโหลดประวัติการสุ่มตรวจ IPD...</p>
              </div>
            ) : filteredHistoryBatches.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-12 h-12 rounded-sm bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <History size={20} />
                </div>
                <p className="text-xs font-semibold text-slate-700">ไม่พบประวัติการสุ่มตรวจตามเงื่อนไข</p>
              </div>
            ) : (
              <div>
                {/* Top Horizontal Scrollbar */}
                <div
                  ref={topHistoryScrollRef}
                  onScroll={handleHistoryTopScroll}
                  className="overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-50/70 py-1"
                  title="เลื่อนเพื่อดูคอลัมน์ของตาราง"
                >
                  <div style={{ width: `${historyScrollWidth}px`, height: '1px' }} />
                </div>

                {/* Main History Table */}
                <div
                  ref={bottomHistoryScrollRef}
                  onScroll={handleHistoryBottomScroll}
                  className="table-responsive overflow-x-auto max-h-[60vh]"
                >
                  <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 text-nowrap whitespace-nowrap">
                        <th className="p-2.5 text-center w-10 border-r border-slate-200">#</th>
                        <th className="p-2.5 text-center w-28 border-r border-slate-200">เวชระเบียน</th>
                        <th className="p-2.5 text-center w-32 min-w-[125px] border-r border-slate-200">จัดการ</th>
                        <th className="p-2.5 border-r border-slate-200 min-w-[200px]">รหัส / ชื่อการสุ่ม</th>
                        <th className="p-2.5 border-r border-slate-200 w-36">วันที่ทำการสุ่ม</th>
                        <th className="p-2.5 border-r border-slate-200 min-w-[120px]">ประเภทเคส</th>
                        <th className="p-2.5 border-r border-slate-200 min-w-[140px]">หอผู้ป่วย</th>
                        <th className="p-2.5 border-r border-slate-200 min-w-[160px]">ช่วงวันที่จำหน่าย</th>
                        <th className="p-2.5 text-center border-r border-slate-200 w-24">ขนาดตัวอย่าง</th>
                        <th className="p-2.5 border-r border-slate-200 min-w-[160px]">ความก้าวหน้า</th>
                        <th className="p-2.5 text-center w-28 border-r border-slate-200">สถานะ</th>
                        <th className="p-2.5 text-center text-nowrap whitespace-nowrap">ผู้ดำเนินการสุ่ม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredHistoryBatches.map((b, idx) => {
                        const progressPct =
                          b.sampleSize > 0 ? Math.round(((b.auditedCount || 0) / b.sampleSize) * 100) : 0;
                        const isCancelled = b.status === 'cancelled';
                        const isCompleted = b.status === 'completed' || progressPct === 100;

                        return (
                          <tr
                            key={b.batchId}
                            className={`hover:bg-slate-50 transition-colors text-nowrap whitespace-nowrap ${isCancelled ? 'opacity-60 bg-slate-50/50' : ''
                              }`}
                          >
                            {/* # */}
                            <td className="p-2 text-center text-slate-500 font-semibold border-r border-slate-200">
                              {idx + 1}
                            </td>
                            {/* เวชระเบียน (เปิด) */}
                            <td className="p-1.5 text-center border-r border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleOpenBatchFromHistory(b)}
                                disabled={isCancelled}
                                className="w-full py-1 px-2 rounded-sm text-[11px] font-semibold bg-blue-900 hover:bg-blue-950 text-white shadow-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                              >
                                <span>เปิด</span>
                                <ExternalLink size={11} />
                              </button>
                            </td>
                            {/* จัดการ — standardized icon buttons */}
                            <td className="p-2 text-center border-r border-slate-200 w-36 min-w-[140px]">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSummaryModalBatchId(b.batchId)}
                                  className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-blue-700 hover:text-blue-900 hover:bg-blue-50/80 hover:border-blue-300 shadow-xs transition-all cursor-pointer"
                                  title="ดูสรุปผลคะแนนชุดสุ่มนี้ (Batch Summary Report)"
                                >
                                  <Trophy size={16} />
                                </button>
                                {/* แก้ไข */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBatch(b);
                                    setEditBatchName(b.batchName || '');
                                    setEditCreatedBy(b.createdBy || user?.fullName || '');
                                    setEditStatus(b.status || 'active');
                                    setEditNote(b.note || '');
                                  }}
                                  disabled={!RBAC.isAdmin(user?.role)}
                                  className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-slate-500 hover:text-blue-900 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-500 shadow-xs transition-all"
                                  title="แก้ไขข้อมูลการสุ่ม"
                                >
                                  <Edit3 size={16} />
                                </button>

                                {/* ยกเลิก / คืนสถานะ */}
                                {b.status === 'cancelled' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleBatchStatusAction(b.batchId, 'reactivate')}
                                    disabled={!RBAC.canDeleteBatch(user?.role)}
                                    className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-emerald-600 shadow-xs transition-all"
                                    title="คืนสถานะให้เปิดใช้งานการสุ่มนี้อีกครั้ง"
                                  >
                                    <RotateCcw size={16} />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleBatchStatusAction(b.batchId, 'cancel')}
                                    disabled={!RBAC.canDeleteBatch(user?.role)}
                                    className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-amber-600 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-amber-600 shadow-xs transition-all"
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
                                  className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-rose-500 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-rose-500 shadow-xs transition-all"
                                  title="ลบข้อมูลการสุ่ม"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                            {/* รหัส / ชื่อการสุ่ม */}
                            <td className="p-2.5 border-r border-slate-200">
                              <div className="font-bold text-blue-950">{b.batchName || b.batchId}</div>
                              <div className="text-[10px] text-slate-400">{b.batchId}</div>
                              {b.note && <div className="text-[10px] text-slate-500 truncate max-w-xs">{b.note}</div>}
                            </td>
                            {/* วันที่ทำการสุ่ม */}
                            <td className="p-2.5 border-r border-slate-200 text-slate-700">
                              {formatThaiDate(b.samplingDate)}
                            </td>
                            {/* ประเภทเคส */}
                            <td className="p-2 border-r border-slate-200 min-w-[120px]">
                              {(() => {
                                const badge = getIpdCaseTypeBadge(b.caseType);
                                return (
                                  <span
                                    className={`w-full block text-center px-2 py-0.5 rounded-sm text-[11px] font-semibold border ${badge.className}`}
                                    title={`ประเภทเคส: ${badge.label}`}
                                  >
                                    {badge.label}
                                  </span>
                                );
                              })()}
                            </td>
                            {/* หอผู้ป่วย — full-width badge */}
                            <td className="p-2 border-r border-slate-200">
                              <span
                                className={`w-full block text-center px-2 py-0.5 rounded-sm text-[11px] font-semibold border ${getWardBadgeClass(
                                  b.wardName || ''
                                )}`}
                              >
                                {b.wardName || 'ทุกหอผู้ป่วย'}
                              </span>
                            </td>
                            {/* ช่วงวันที่จำหน่าย */}
                            <td className="p-2.5 border-r border-slate-200 text-slate-700 text-[11px]">
                              {formatThaiDate(b.dateFrom)} - {formatThaiDate(b.dateTo)}
                            </td>
                            {/* ขนาดตัวอย่าง */}
                            <td className="p-2.5 text-center border-r border-slate-200 font-bold text-slate-800">
                              {b.sampleSize}{' '}
                              <span className="text-[10px] font-normal text-slate-500">
                                / {(b.totalAvailable || 0).toLocaleString()}
                              </span>
                            </td>
                            {/* ความก้าวหน้า */}
                            <td className="p-2.5 border-r border-slate-200 min-w-[160px]">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-bold text-slate-800">
                                  {b.auditedCount || 0}/{b.sampleSize} เคส
                                </span>
                                <span className="font-semibold text-slate-600">{progressPct}%</span>
                              </div>
                              <div className="w-full bg-slate-200 h-1.5 rounded-sm overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${progressPct === 100
                                    ? 'bg-emerald-600'
                                    : progressPct > 0
                                      ? 'bg-blue-600'
                                      : 'bg-slate-300'
                                    }`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </td>
                            {/* สถานะ */}
                            <td className="p-2 text-center border-r border-slate-200 w-28">
                              {isCancelled ? (
                                <span className="w-full block text-center px-2.5 py-0.5 rounded-sm text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  ยกเลิกแล้ว
                                </span>
                              ) : isCompleted ? (
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

                            {/* ผู้ดำเนินการสุ่ม */}
                            <td className="p-2.5 text-center text-slate-600 text-nowrap whitespace-nowrap min-w-[120px]">
                              {b.createdBy || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Modal: Edit Batch ── */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-sm border border-slate-200 shadow-xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">แก้ไขข้อมูลการสุ่มตรวจ IPD</h3>
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">รหัสการสุ่มตรวจ</label>
                <input
                  type="text"
                  disabled
                  value={editingBatch.batchId}
                  className="w-full p-2 bg-slate-100 border border-slate-200 rounded-sm text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">ชื่อการสุ่มตรวจ</label>
                <Input
                  type="text"
                  value={editBatchName}
                  onChange={(e) => setEditBatchName(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">สถานะชุด</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-sm text-xs focus:ring-1 focus:ring-blue-900"
                >
                  <option value="active">เปิดใช้งาน (Active)</option>
                  <option value="completed">เสร็จสิ้น (Completed)</option>
                  <option value="cancelled">ยกเลิก (Cancelled)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">บันทึกเพิ่มเติม</label>
                <textarea
                  rows={3}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-sm text-xs focus:ring-1 focus:ring-blue-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-sm text-xs text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsSavingEdit(true);
                    const res = await fetch('/api/mra/ipd-batches', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        batchId: editingBatch.batchId,
                        action: 'update',
                        batchName: editBatchName,
                        status: editStatus,
                        note: editNote,
                      }),
                    });
                    const json = await res.json();
                    if (!res.ok || !json.success) throw new Error(json.error || 'บันทึกไม่สำเร็จ');
                    alertSuccess('สำเร็จ', 'บันทึกการแก้ไขข้อมูลการสุ่มตรวจเรียบร้อยแล้ว');
                    setEditingBatch(null);
                    loadHistory();
                  } catch (err) {
                    alertError({
                      title: 'เกิดข้อผิดพลาด',
                      text: err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ',
                    });
                  } finally {
                    setIsSavingEdit(false);
                  }
                }}
                disabled={isSavingEdit}
                className="px-4 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-sm text-xs shadow-xs"
              >
                {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IPD Batch Summary Report Modal */}
      <BatchSummaryModal
        isOpen={Boolean(summaryModalBatchId)}
        onClose={() => setSummaryModalBatchId(null)}
        batchId={summaryModalBatchId || ''}
        serviceType="IPD"
      />

      {/* Manual Sampling Modal */}
      <ManualSamplingModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        mode="ipd"
        onSuccess={async (newBatchId) => {
          await loadBatchById(newBatchId, false);
          loadHistory();
          setActiveTab('sampling');
        }}
      />
    </div>
  );
}
