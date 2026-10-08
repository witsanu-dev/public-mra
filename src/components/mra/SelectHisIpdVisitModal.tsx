'use client';

import { apiUrl } from '@/lib/constants';
import React, { useState, useEffect, useCallback, useMemo, useTransition, useRef } from 'react';
import {
  Search,
  Calendar,
  X,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  DatabaseArrowDown,
  Layers,
  Filter,
} from 'lucide-react';
import { useIpdAuditStore } from '@/store/useIpdAuditStore';
import { alertSuccess, alertError } from '@/lib/mra-alert';
import { SearchableSelect, SearchableOption } from '@/components/ui/SearchableSelect';

interface HisIpdCase {
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
  diagnosisDisplay: string;
  pttypeName: string;
  lengthOfStay: number;
  dischargeStatus: string;
  dischargeType: string;
}

interface IpdBatchOption {
  batchId: string;
  batchName?: string;
  samplingDate: string;
  caseType: string;
  sampleSize: number;
  totalAvailable: number;
  wardName?: string;
  auditedCount: number;
  status?: string;
}

interface IpdSampleItem {
  itemId: string;
  batchId: string;
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

interface SelectHisIpdVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Format YYYY-MM-DD to Thai Buddhist Era date: DD/MM/25XX */
function formatThaiDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr || '-';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parts[1];
  const d = parts[2];
  const thaiYear = y < 2400 ? y + 543 : y;
  return `${d}/${m}/${thaiYear}`;
}

function formatThaiDateTime(dateTimeStr: string): string {
  if (!dateTimeStr) return '-';
  const [d, t] = dateTimeStr.split(' ');
  return `${formatThaiDate(d)} ${t ? t + ' น.' : ''}`.trim();
}

export function SelectHisIpdVisitModal({ isOpen, onClose }: SelectHisIpdVisitModalProps) {
  // Tab: 'sampling_batch' | 'direct_his'
  const [activeTab, setActiveTab] = useState<'sampling_batch' | 'direct_his'>('sampling_batch');

  // Direct HIS Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [cases, setCases] = useState<HisIpdCase[]>([]);
  const [hospitalInfo, setHospitalInfo] = useState<{ hcode: string; hname: string }>({
    hcode: '',
    hname: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sampling Batch states
  const [batches, setBatches] = useState<IpdBatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchItems, setBatchItems] = useState<IpdSampleItem[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [batchStatusFilter, setBatchStatusFilter] = useState<'all' | 'pending' | 'audited'>('all');
  const [batchSearchQuery, setBatchSearchQuery] = useState('');

  const [, startTransition] = useTransition();

  const loadSampledIpdVisit = useIpdAuditStore((s) => s.loadSampledIpdVisit);
  const currentAn = useIpdAuditStore((s) => s.currentAn);

  // Dual scrollbar refs for Direct HIS
  const topDirectHisScrollRef = useRef<HTMLDivElement>(null);
  const bottomDirectHisScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingDirectHisScroll = useRef(false);
  const [directHisScrollWidth, setDirectHisScrollWidth] = useState(1300);

  // Dual scrollbar refs for Sampling Batch
  const topBatchScrollRef = useRef<HTMLDivElement>(null);
  const bottomBatchScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingBatchScroll = useRef(false);
  const [batchScrollWidth, setBatchScrollWidth] = useState(1300);

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

  // 1. Fetch HIS visits directly
  const fetchIpdCases = useCallback(
    async (q = '', date = '') => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (q.trim()) params.append('q', q.trim());
        if (date.trim()) params.append('date', date.trim());
        params.append('limit', '30');

        const res = await fetch(apiUrl(`/api/his/ipd-search?${params.toString()}`));
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'ไม่สามารถดึงข้อมูลผู้ป่วยในจาก HIS ได้');
        }

        startTransition(() => {
          setCases(json.data.visits || []);
          if (json.data.hospital) {
            setHospitalInfo(json.data.hospital);
          }
        });
      } catch (err) {
        console.error('Fetch IPD error:', err);
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ HIS');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // 2. Load IPD Sampling Batches
  const loadBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      const res = await fetch(apiUrl('/api/mra/ipd-batches'));
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const activeOnly = json.data.filter((b: IpdBatchOption) => b.status !== 'cancelled');
        setBatches(activeOnly);
        if (activeOnly.length > 0 && !selectedBatchId) {
          setSelectedBatchId(activeOnly[0].batchId);
          loadBatchItems(activeOnly[0].batchId);
        }
      }
    } catch (err) {
      console.error('Error fetching IPD batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  }, [selectedBatchId]);

  // Load items of a specific IPD batch
  const loadBatchItems = async (batchId: string) => {
    if (!batchId) return;
    setIsLoadingItems(true);
    try {
      const res = await fetch(apiUrl(`/api/mra/ipd-batches?batchId=${batchId}`));
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBatchItems(json.data);
      } else {
        setBatchItems([]);
      }
    } catch (err) {
      console.error('Error fetching IPD batch items:', err);
      setBatchItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Convert batches to SearchableSelect options
  const batchSelectOptions: SearchableOption[] = useMemo(() => {
    return batches.map((b) => ({
      value: b.batchId,
      label: `${b.batchId} — ${b.batchName || 'สุ่มตรวจ IPD'} (${formatThaiDateTime(b.samplingDate)})`,
      badge: `${b.auditedCount || 0}/${b.sampleSize} ชาร์ต`,
    }));
  }, [batches]);

  // Filtered batch items by search query and status
  const filteredBatchItems = useMemo(() => {
    return batchItems.filter((item) => {
      // Status filter
      if (batchStatusFilter !== 'all' && item.auditStatus !== batchStatusFilter) {
        return false;
      }
      // Text search
      const q = batchSearchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        item.hn.toLowerCase().includes(q) ||
        item.an.toLowerCase().includes(q) ||
        (item.patientName || '').toLowerCase().includes(q) ||
        (item.cid || '').toLowerCase().includes(q) ||
        (item.wardName || '').toLowerCase().includes(q) ||
        (item.pdx || '').toLowerCase().includes(q) ||
        (item.diagnosisName || '').toLowerCase().includes(q)
      );
    });
  }, [batchItems, batchStatusFilter, batchSearchQuery]);

  // Synchronize dual scrollbars: Direct HIS
  const handleDirectHisTopScroll = () => {
    if (isSyncingDirectHisScroll.current) return;
    if (topDirectHisScrollRef.current && bottomDirectHisScrollRef.current) {
      isSyncingDirectHisScroll.current = true;
      bottomDirectHisScrollRef.current.scrollLeft = topDirectHisScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingDirectHisScroll.current = false;
      });
    }
  };

  const handleDirectHisBottomScroll = () => {
    if (isSyncingDirectHisScroll.current) return;
    if (topDirectHisScrollRef.current && bottomDirectHisScrollRef.current) {
      isSyncingDirectHisScroll.current = true;
      topDirectHisScrollRef.current.scrollLeft = bottomDirectHisScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingDirectHisScroll.current = false;
      });
    }
  };

  // Synchronize dual scrollbars: Sampling Batch
  const handleBatchTopScroll = () => {
    if (isSyncingBatchScroll.current) return;
    if (topBatchScrollRef.current && bottomBatchScrollRef.current) {
      isSyncingBatchScroll.current = true;
      bottomBatchScrollRef.current.scrollLeft = topBatchScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingBatchScroll.current = false;
      });
    }
  };

  const handleBatchBottomScroll = () => {
    if (isSyncingBatchScroll.current) return;
    if (topBatchScrollRef.current && bottomBatchScrollRef.current) {
      isSyncingBatchScroll.current = true;
      topBatchScrollRef.current.scrollLeft = bottomBatchScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingBatchScroll.current = false;
      });
    }
  };

  useEffect(() => {
    if (bottomDirectHisScrollRef.current) {
      const sw = bottomDirectHisScrollRef.current.scrollWidth;
      if (sw > 0) setDirectHisScrollWidth(sw);
    }
  }, [cases]);

  useEffect(() => {
    if (bottomBatchScrollRef.current) {
      const sw = bottomBatchScrollRef.current.scrollWidth;
      if (sw > 0) setBatchScrollWidth(sw);
    }
  }, [filteredBatchItems]);

  useEffect(() => {
    if (isOpen) {
      fetchIpdCases(searchTerm, dateFilter);
      loadBatches();
    }
  }, [isOpen, fetchIpdCases, loadBatches, searchTerm, dateFilter]);

  // Handle Select from Direct HIS
  const handleSelectCase = async (item: HisIpdCase) => {
    try {
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
        hcode: hospitalInfo.hcode,
        hname: hospitalInfo.hname,
      });

      alertSuccess(
        'โหลดข้อมูลผู้ป่วยในสำเร็จ',
        `ดึงข้อมูล AN: ${item.an} (${item.patientName || 'ผู้ป่วย'}) เรียบร้อยแล้ว พร้อมทำการประเมิน`
      );
      onClose();
    } catch (err) {
      alertError({
        title: 'เกิดข้อผิดพลาด',
        text: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลเคสนี้ได้',
      });
    }
  };

  // Handle Select from Sampling Batch
  const handleSelectBatchItem = (item: IpdSampleItem) => {
    try {
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
        itemId: item.itemId,
        hcode: hospitalInfo.hcode,
        hname: hospitalInfo.hname,
      });

      alertSuccess(
        'โหลดข้อมูลเคสสุ่มตรวจสำเร็จ',
        `ดึงข้อมูล AN: ${item.an} (${item.patientName || 'ผู้ป่วย'}) จากข้อมูลการสุ่มตรวจเรียบร้อยแล้ว`
      );
      onClose();
    } catch (err) {
      alertError({
        title: 'เกิดข้อผิดพลาด',
        text: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลเคสนี้ได้',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-sm border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-sm bg-blue-900 text-white flex items-center justify-center shrink-0">
              <DatabaseArrowDown size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-blue-950">
                เลือกเคสตรวจเวชระเบียนผู้ป่วยใน (IPD)
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <Building2 size={12} className="text-slate-400" />
                  <span>
                    {hospitalInfo.hname || 'หน่วยบริการสุขภาพ'} {hospitalInfo.hcode ? `(${hospitalInfo.hcode})` : ''}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <div className="bg-slate-200/70 p-1 rounded-sm flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('sampling_batch')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors ${
                  activeTab === 'sampling_batch'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'
                }`}
              >
                <Layers size={13} />
                <span>รายการสุ่มเวชระเบียน</span>
                {batches.length > 0 && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-sm font-bold ${
                      activeTab === 'sampling_batch'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    {batches.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('direct_his')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors ${
                  activeTab === 'direct_his'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'
                }`}
              >
                <Search size={13} />
                <span>ค้นหาจาก HIS</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-sm transition-colors"
              title="ปิดหน้าต่าง"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── TAB 1: SAMPLING BATCH ── */}
        {activeTab === 'sampling_batch' && (
          <>
            <div className="p-3 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <div className="w-full sm:w-80">
                  <SearchableSelect
                    options={batchSelectOptions}
                    value={selectedBatchId}
                    onChange={(val) => {
                      setSelectedBatchId(val);
                      loadBatchItems(val);
                    }}
                    placeholder="-- เลือกข้อมูลการสุ่มตรวจ IPD --"
                    disabled={isLoadingBatches}
                  />
                </div>

                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="กรองในชุด: AN, HN, ชื่อ, โรค..."
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900"
                  />
                  {batchSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBatchSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-sm p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setBatchStatusFilter('all')}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${
                    batchStatusFilter === 'all'
                      ? 'bg-blue-900 text-white font-bold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  ทั้งหมด ({batchItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBatchStatusFilter('pending')}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${
                    batchStatusFilter === 'pending'
                      ? 'bg-amber-600 text-white font-bold'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  ยังไม่ตรวจ ({batchItems.filter((i) => i.auditStatus === 'pending').length})
                </button>
                <button
                  type="button"
                  onClick={() => setBatchStatusFilter('audited')}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${
                    batchStatusFilter === 'audited'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  ตรวจแล้ว ({batchItems.filter((i) => i.auditStatus === 'audited').length})
                </button>
              </div>
            </div>

            {/* Table Content for Batch */}
            <div className="flex-1 overflow-auto p-3">
              {isLoadingBatches || isLoadingItems ? (
                <div className="py-16 text-center space-y-2">
                  <RefreshCw size={24} className="animate-spin text-blue-900 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">กำลังโหลดข้อมูลการสุ่มตรวจ IPD...</p>
                </div>
              ) : batches.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <div className="w-12 h-12 rounded-sm bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Layers size={20} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">ยังไม่มีข้อมูลการสุ่มตรวจเวชระเบียนผู้ป่วยใน</p>
                  <p className="text-[11px] text-slate-400">
                    สามารถสร้างการสุ่มตรวจใหม่ได้ที่เมนู <strong>&quot;สุ่มตรวจผู้ป่วยใน (IPD)&quot;</strong>
                  </p>
                </div>
              ) : filteredBatchItems.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-700">ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหาในชุดนี้</p>
                  <p className="text-[11px] text-slate-400">ลองล้างคำค้นหาหรือเปลี่ยนตัวกรองสถานะ</p>
                </div>
              ) : (
                <div className="flex flex-col rounded-sm border border-slate-200 overflow-hidden bg-white">
                  {/* Top Horizontal Scrollbar */}
                  <div
                    ref={topBatchScrollRef}
                    onScroll={handleBatchTopScroll}
                    className="overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-50/70 py-1"
                    title="เลื่อนเพื่อดูคอลัมน์ของตาราง"
                  >
                    <div style={{ width: `${batchScrollWidth}px`, height: '1px' }} />
                  </div>

                  {/* Main Table with Bottom Scrollbar */}
                  <div
                    ref={bottomBatchScrollRef}
                    onScroll={handleBatchBottomScroll}
                    className="table-responsive overflow-x-auto max-h-[60vh]"
                  >
                    <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 text-nowrap whitespace-nowrap">
                          <th className="p-2.5 text-center w-10 border-r border-slate-200">#</th>
                          <th className="p-2.5 text-center w-28 min-w-[100px] border-r border-slate-200">ดำเนินการ</th>
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
                        {filteredBatchItems.map((item, idx) => {
                          const isCurrentActive = currentAn === item.an;
                          const isAudited = item.auditStatus === 'audited';

                          return (
                            <tr
                              key={`${item.itemId || item.an}-${idx}`}
                              className={`hover:bg-slate-50 transition-colors text-nowrap whitespace-nowrap ${
                                isCurrentActive ? 'bg-blue-50/50' : ''
                              }`}
                            >
                              <td className="p-2 text-center text-slate-500 font-semibold border-r border-slate-200">
                                {idx + 1}
                              </td>
                              <td className="p-1.5 text-center border-r border-slate-200 w-28">
                                <button
                                  type="button"
                                  onClick={() => handleSelectBatchItem(item)}
                                  className={`w-full py-1.5 px-2.5 rounded-sm text-[11px] font-semibold shadow-xs transition-colors cursor-pointer ${
                                    isCurrentActive
                                      ? 'bg-slate-700 text-white'
                                      : isAudited
                                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                      : 'bg-blue-900 hover:bg-blue-950 text-white'
                                  }`}
                                >
                                  {isCurrentActive ? 'เคสปัจจุบัน' : isAudited ? 'ทบทวน' : 'เลือกเคสนี้'}
                                </button>
                              </td>
                              <td className="p-2 text-center border-r border-slate-200">
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
                                  <span>{item.admitTime} น.</span>
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-slate-900">{formatThaiDate(item.dischargeDate)}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Clock size={11} />
                                  <span>{item.dischargeTime} น.</span>
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
                </div>
              )}
            </div>
          </>
        )}

        {/* ── TAB 2: DIRECT HIS SEARCH ── */}
        {activeTab === 'direct_his' && (
          <>
            {/* Search & Filter Controls */}
            <div className="p-3 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาด้วย AN, HN, เลขบัตร ปชช. หรือชื่อ-สกุล..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchIpdCases(searchTerm, dateFilter)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900"
                    title="กรองตามวันที่จำหน่ายหรือรับตัว"
                  />
                </div>

                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter('')}
                    className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-300 rounded-sm hover:bg-slate-100"
                    title="ล้างตัวกรองวันที่"
                  >
                    <X size={13} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fetchIpdCases(searchTerm, dateFilter)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-sm flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                  <span>ค้นหา</span>
                </button>
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto p-3">
              {error && (
                <div className="p-3 mb-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-sm flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {isLoading ? (
                <div className="py-16 text-center space-y-2">
                  <RefreshCw size={24} className="animate-spin text-blue-900 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">กำลังโหลดข้อมูลผู้ป่วยในจากระบบ HIS...</p>
                </div>
              ) : cases.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <div className="w-12 h-12 rounded-sm bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Search size={20} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">ไม่พบรายการผู้ป่วยในตามเงื่อนไขที่ระบุ</p>
                  <p className="text-[11px] text-slate-400">ลองเปลี่ยนคำค้นหา หรือเว้นว่างเพื่อแสดงข้อมูลย้อนหลัง 30 วัน</p>
                </div>
              ) : (
                <div className="flex flex-col rounded-sm border border-slate-200 overflow-hidden bg-white">
                  {/* Top Horizontal Scrollbar */}
                  <div
                    ref={topDirectHisScrollRef}
                    onScroll={handleDirectHisTopScroll}
                    className="overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-50/70 py-1"
                    title="เลื่อนเพื่อดูคอลัมน์ของตาราง"
                  >
                    <div style={{ width: `${directHisScrollWidth}px`, height: '1px' }} />
                  </div>

                  {/* Main Table with Bottom Scrollbar */}
                  <div
                    ref={bottomDirectHisScrollRef}
                    onScroll={handleDirectHisBottomScroll}
                    className="table-responsive overflow-x-auto max-h-[60vh]"
                  >
                    <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 text-nowrap whitespace-nowrap">
                          <th className="p-2.5 text-center w-10 border-r border-slate-200">#</th>
                          <th className="p-2.5 text-center w-28 min-w-[100px] border-r border-slate-200">ดำเนินการ</th>
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
                        {cases.map((c, idx) => {
                          const isCurrentActive = currentAn === c.an;
                          return (
                            <tr
                              key={c.an}
                              className={`hover:bg-slate-50 transition-colors text-nowrap whitespace-nowrap ${
                                isCurrentActive ? 'bg-blue-50/50' : ''
                              }`}
                            >
                              <td className="p-2 text-center text-slate-500 font-semibold border-r border-slate-200">
                                {idx + 1}
                              </td>
                              <td className="p-1.5 text-center border-r border-slate-200 w-28">
                                <button
                                  type="button"
                                  onClick={() => handleSelectCase(c)}
                                  className={`w-full py-1.5 px-2.5 rounded-sm text-[11px] font-semibold shadow-xs transition-colors cursor-pointer ${
                                    isCurrentActive
                                      ? 'bg-slate-700 text-white'
                                      : 'bg-blue-900 hover:bg-blue-950 text-white'
                                  }`}
                                >
                                  {isCurrentActive ? 'เคสปัจจุบัน' : 'เลือกเคสนี้'}
                                </button>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-bold text-blue-950">AN: {c.an}</div>
                                <div className="text-[10px] text-slate-500">HN: {c.hn}</div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-900">
                                {c.patientName || '-'}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 text-slate-700">
                                {c.sex || '-'}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 text-slate-700">
                                {c.age ? `${c.age} ปี` : '-'}
                              </td>
                              <td className="p-2 text-center border-r border-slate-200">
                                <span
                                  className={`w-full inline-block text-center px-2 py-0.5 rounded-sm text-[11px] font-semibold border ${getWardBadgeClass(
                                    c.wardName
                                  )}`}
                                >
                                  {c.wardName || 'ไม่ระบุหอผู้ป่วย'}
                                </span>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-slate-900">{formatThaiDate(c.admitDate)}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Clock size={11} />
                                  <span>{c.admitTime} น.</span>
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-slate-900">{formatThaiDate(c.dischargeDate)}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Clock size={11} />
                                  <span>{c.dischargeTime} น.</span>
                                </div>
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 font-bold text-blue-900 bg-blue-50/40">
                                {c.lengthOfStay} วัน
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-blue-900">{c.pdx || '-'}</div>
                                <div className="text-[11px] text-slate-600 truncate max-w-xs" title={c.diagnosisName || c.diagnosisDisplay}>
                                  {c.diagnosisName || c.diagnosisDisplay || '-'}
                                </div>
                              </td>
                              <td className="p-2.5 text-slate-700 text-[11px]">
                                {c.pttypeName || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Footer ── */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            {activeTab === 'sampling_batch'
              ? `แสดง ${filteredBatchItems.length} รายการในการสุ่ม`
              : `แสดง ${cases.length} รายการล่าสุดจาก HIS`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-sm hover:bg-slate-100 font-medium text-slate-700"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
