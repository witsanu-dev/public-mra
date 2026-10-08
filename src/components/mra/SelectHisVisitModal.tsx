'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DatabaseArrowDown, Building2, Layers, Search } from 'lucide-react';
import { useUnifiedAuditStore } from '@/store/useUnifiedAuditStore';
import { SearchableSelect, SearchableOption } from '@/components/ui/SearchableSelect';
import { alertSuccess } from '@/lib/mra-alert';

interface HisVisit {
  vn: string;
  hn: string;
  cid: string;
  patientName: string;
  sex: string;
  age: number;
  vstdate: string;
  vsttime: string;
  pdx: string;
  diagnosisName: string;
  diagnosisDisplay: string;
  pttypeName: string;
  department: string;
  doctorName: string;
  chiefComplaint: string;
  isChronic: boolean;
  isPsychiatric?: boolean;
  caseType: 'general' | 'chronic' | 'psychiatric';
}

interface BatchOption {
  batchId: string;
  batchName?: string;
  samplingDate: string;
  caseType: string;
  sampleSize: number;
  auditedCount: number;
  status: string;
}

interface SampleItem {
  itemId: string;
  batchId: string;
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

interface SelectHisVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CASE_TYPE_OPTIONS: SearchableOption[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'general', label: 'โรคทั่วไป / ฉุกเฉิน' },
  { value: 'chronic', label: 'โรคเรื้อรัง' },
  { value: 'psychiatric', label: 'จิตเวช' },
];

/**
 * Format date to Thai Buddhist Era format.
 * Example: 04/10/2569
 */
function formatThaiDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    const parts = cleanDate.includes('-') ? cleanDate.split('-') : cleanDate.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const [yearStr, monthStr, dayStr] = parts;
        const christianYear = parseInt(yearStr, 10);
        const thaiYear = christianYear > 2400 ? christianYear : christianYear + 543;
        return `${dayStr.padStart(2, '0')}/${monthStr.padStart(2, '0')}/${thaiYear}`;
      } else if (parts[2].length === 4) {
        // DD/MM/YYYY
        const [dayStr, monthStr, yearStr] = parts;
        const christianYear = parseInt(yearStr, 10);
        const thaiYear = christianYear > 2400 ? christianYear : christianYear + 543;
        return `${dayStr.padStart(2, '0')}/${monthStr.padStart(2, '0')}/${thaiYear}`;
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Format time to Thai format with 'น.'
 * Example: 20:51 น.
 */
function formatThaiTime(timeStr?: string, fallbackDateStr?: string): string {
  let time = timeStr;
  if (!time || time === '-' || time === '00:00:00' || time === '00:00') {
    if (fallbackDateStr && (fallbackDateStr.includes('T') || fallbackDateStr.includes(' '))) {
      const parts = fallbackDateStr.split(/[T ]/);
      if (parts[1]) time = parts[1].slice(0, 5);
    }
  }
  if (!time || time === '-' || time === '00:00:00' || time === '00:00') return '-';
  try {
    const cleanTime = time.includes(':') ? time.slice(0, 5) : time;
    return `${cleanTime} น.`;
  } catch {
    return `${time} น.`;
  }
}

/**
 * Format date & time into Thai Buddhist Era format.
 * Example: 04/10/2569 21:56 น.
 */
function formatThaiDateTime(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return '-';

  try {
    const formattedDate = formatThaiDate(dateStr);
    let cleanTime = timeStr || '';

    if (!cleanTime && (dateStr.includes('T') || dateStr.includes(' '))) {
      const parts = dateStr.split(/[T ]/);
      if (parts[1]) cleanTime = parts[1].slice(0, 5);
    }

    if (cleanTime && cleanTime !== '-' && cleanTime !== '00:00:00' && cleanTime !== '00:00') {
      const shortTime = cleanTime.slice(0, 5);
      return `${formattedDate} ${shortTime} น.`;
    }

    return formattedDate;
  } catch {
    return dateStr;
  }
}

export function SelectHisVisitModal({ isOpen, onClose }: SelectHisVisitModalProps) {
  const { loadSampledVisit, currentVn } = useUnifiedAuditStore();

  // Tab: 'direct_his' | 'sampling_batch'
  const [activeTab, setActiveTab] = useState<'direct_his' | 'sampling_batch'>('direct_his');

  // Direct HIS State
  const [searchQuery, setSearchQuery] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [caseTypeFilter, setCaseTypeFilter] = useState<'all' | 'general' | 'chronic' | 'psychiatric'>('all');
  const [hisVisits, setHisVisits] = useState<HisVisit[]>([]);
  const [hisHospital, setHisHospital] = useState<{ hcode: string; hname: string }>({
    hcode: '',
    hname: '',
  });
  const [isLoadingHis, setIsLoadingHis] = useState(false);

  // Sampling Batch State
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchItems, setBatchItems] = useState<SampleItem[]>([]);
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

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

  // Handlers for Direct HIS scroll
  const handleTopDirectHisScroll = () => {
    if (isSyncingDirectHisScroll.current) return;
    if (topDirectHisScrollRef.current && bottomDirectHisScrollRef.current) {
      isSyncingDirectHisScroll.current = true;
      bottomDirectHisScrollRef.current.scrollLeft = topDirectHisScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingDirectHisScroll.current = false;
      });
    }
  };

  const handleBottomDirectHisScroll = () => {
    if (isSyncingDirectHisScroll.current) return;
    if (topDirectHisScrollRef.current && bottomDirectHisScrollRef.current) {
      isSyncingDirectHisScroll.current = true;
      topDirectHisScrollRef.current.scrollLeft = bottomDirectHisScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingDirectHisScroll.current = false;
      });
    }
  };

  // Handlers for Batch scroll
  const handleTopBatchScroll = () => {
    if (isSyncingBatchScroll.current) return;
    if (topBatchScrollRef.current && bottomBatchScrollRef.current) {
      isSyncingBatchScroll.current = true;
      bottomBatchScrollRef.current.scrollLeft = topBatchScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingBatchScroll.current = false;
      });
    }
  };

  const handleBottomBatchScroll = () => {
    if (isSyncingBatchScroll.current) return;
    if (topBatchScrollRef.current && bottomBatchScrollRef.current) {
      isSyncingBatchScroll.current = true;
      topBatchScrollRef.current.scrollLeft = bottomBatchScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingBatchScroll.current = false;
      });
    }
  };


  // 1. Fetch HIS Visits
  const fetchHisVisits = useCallback(async (overrideCaseType?: 'all' | 'general' | 'chronic' | 'psychiatric') => {
    setIsLoadingHis(true);
    try {
      const activeCaseType = overrideCaseType !== undefined ? overrideCaseType : caseTypeFilter;
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (visitDate) params.set('date', visitDate);
      if (activeCaseType !== 'all') params.set('caseType', activeCaseType);
      params.set('limit', '30');

      const res = await fetch(`/api/his/search?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setHisVisits(json.data.visits || []);
        if (json.data.hospital) {
          setHisHospital(json.data.hospital);
        }
      } else {
        setHisVisits([]);
      }
    } catch (err) {
      console.error('Error fetching HIS visits:', err);
      setHisVisits([]);
    } finally {
      setIsLoadingHis(false);
    }
  }, [searchQuery, visitDate, caseTypeFilter]);

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchHisVisits();
      loadBatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 2. Load Sampling Batches
  const loadBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const res = await fetch('/api/mra/batches');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const activeOnly = json.data.filter((b: BatchOption) => b.status !== 'cancelled');
        setBatches(activeOnly);
        if (activeOnly.length > 0 && !selectedBatchId) {
          setSelectedBatchId(activeOnly[0].batchId);
          loadBatchItems(activeOnly[0].batchId);
        }
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  // Load items of a specific batch
  const loadBatchItems = async (batchId: string) => {
    if (!batchId) return;
    setIsLoadingItems(true);
    try {
      const res = await fetch(`/api/mra/batches?batchId=${batchId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBatchItems(json.data);
      } else {
        setBatchItems([]);
      }
    } catch (err) {
      console.error('Error fetching batch items:', err);
      setBatchItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Convert batches to SearchableSelect options
  const batchSelectOptions: SearchableOption[] = useMemo(() => {
    return batches.map((b) => ({
      value: b.batchId,
      label: `${b.batchId} — ${b.batchName || 'สุ่มตรวจ'} (${formatThaiDateTime(b.samplingDate)})`,
      badge: `${b.auditedCount || 0}/${b.sampleSize} ชาร์ต`,
    }));
  }, [batches]);

  // Filtered batch items by search query
  const filteredBatchItems = useMemo(() => {
    const q = batchSearchQuery.trim().toLowerCase();
    if (!q) return batchItems;
    return batchItems.filter((item) => {
      return (
        item.hn.toLowerCase().includes(q) ||
        item.vn.toLowerCase().includes(q) ||
        (item.patientName || '').toLowerCase().includes(q) ||
        (item.cid || '').toLowerCase().includes(q) ||
        (item.pdx || '').toLowerCase().includes(q) ||
        (item.diagnosisName || '').toLowerCase().includes(q)
      );
    });
  }, [batchItems, batchSearchQuery]);

  useEffect(() => {
    if (bottomDirectHisScrollRef.current) {
      const sw = bottomDirectHisScrollRef.current.scrollWidth;
      if (sw > 0) setDirectHisScrollWidth(sw);
    }
  }, [hisVisits]);

  useEffect(() => {
    if (bottomBatchScrollRef.current) {
      const sw = bottomBatchScrollRef.current.scrollWidth;
      if (sw > 0) setBatchScrollWidth(sw);
    }
  }, [filteredBatchItems]);

  // Handle Select from Direct HIS
  const handleSelectHisVisit = (visit: HisVisit) => {
    const diag = visit.pdx
      ? `${visit.pdx} : ${visit.diagnosisName}`
      : visit.diagnosisName || '';

    const isPsy = Boolean(
      visit.isPsychiatric ||
      visit.caseType === 'psychiatric' ||
      (visit.pdx && /^F\d/i.test(visit.pdx)) ||
      (visit.diagnosisName && /จิตเวช|psychiatric/i.test(visit.diagnosisName)) ||
      (visit.department && /จิตเวช|สุขภาพจิต|ยาเสพติด/i.test(visit.department))
    );

    loadSampledVisit({
      vn: visit.vn,
      hn: visit.hn,
      cid: visit.cid,
      patientName: visit.patientName,
      diagnosis: diag,
      pdx: visit.pdx,
      vstdate: visit.vstdate,
      caseType: visit.isChronic ? 'chronic' : 'general',
      isPsychiatric: isPsy,
      hcode: hisHospital.hcode,
      hname: hisHospital.hname,
      itemId: undefined,
    });

    alertSuccess(
      'ดึงข้อมูลเคสสำเร็จ',
      `เลือกเคสของ ${visit.patientName || 'ผู้ป่วย'} (HN: ${visit.hn}) เรียบร้อยแล้ว`
    );
    onClose();
  };

  // Handle Select from Sampling Batch
  const handleSelectBatchItem = (item: SampleItem) => {
    const isPsy = Boolean(
      (item.pdx && /^F\d/i.test(item.pdx)) ||
      (item.diagnosisName && /จิตเวช|psychiatric/i.test(item.diagnosisName)) ||
      (item.department && /จิตเวช|สุขภาพจิต|ยาเสพติด/i.test(item.department))
    );

    const isChronic =
      item.department?.includes('เรื้อรัง') ||
      item.department?.includes('NCD') ||
      item.department?.includes('เบาหวาน') ||
      item.department?.includes('ความดัน') ||
      /^(E1[0-4]|I1[0-5]|J4[4-5]|N18|I6[0-9])/.test(item.pdx || '');

    const diag = item.pdx
      ? `${item.pdx} : ${item.diagnosisName}`
      : item.diagnosisName || '';

    loadSampledVisit({
      vn: item.vn,
      hn: item.hn,
      cid: item.cid,
      patientName: item.patientName,
      diagnosis: diag,
      pdx: item.pdx,
      vstdate: item.vstdate,
      caseType: isChronic ? 'chronic' : 'general',
      isPsychiatric: isPsy,
      hcode: hisHospital.hcode,
      hname: hisHospital.hname,
      itemId: item.itemId,
    });

    alertSuccess(
      'ดึงข้อมูลจากรอบการสุ่มสำเร็จ',
      `เลือกชาร์ต ${item.patientName || 'ผู้ป่วย'} (HN: ${item.hn}) จากรอบ ${item.batchId} เรียบร้อยแล้ว`
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-sm border border-slate-200 shadow-2xl max-w-5xl w-full h-[94vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* ── Modal Header: Responsive Flex ── */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/90 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-sm bg-blue-900 text-white flex items-center justify-center shrink-0">
              <DatabaseArrowDown size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-blue-950">
                เลือกเคสตรวจเวชระเบียนผู้ป่วยนอก (OPD/ER)
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <Building2 size={12} className="text-slate-400" />
                  <span>
                    {hisHospital.hname || 'โรงพยาบาล'} ({hisHospital.hcode || '-'})
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full md:w-auto">
            {/* Tab switchers */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-sm border border-slate-200 text-xs flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setActiveTab('sampling_batch')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'sampling_batch'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                <Layers size={13} />
                <span>รายการสุ่มเวชระเบียน</span>
                {batches.length > 0 && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-sm font-bold ${activeTab === 'sampling_batch' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                  >
                    {batches.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('direct_his')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'direct_his'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                <Search size={13} />
                <span>ค้นหาจาก HIS</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 px-3 py-1.5 text-xs font-semibold rounded-sm border border-slate-200 bg-white hover:bg-slate-100 transition-colors shrink-0"
            >
              ปิด
            </button>
          </div>
        </div>

        {/* ── Tab 1: Direct HIS Search ── */}
        {activeTab === 'direct_his' && (
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* Filters Toolbar: SearchableSelect with High Z-Index so it never sinks under cards */}
            <div className="p-3 bg-white border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end shrink-0 relative z-30 overflow-visible">

              {/* 1. Keyword search (HN, VN, CID, Name) */}
              <div className="sm:col-span-2 lg:col-span-5">
                <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                  ค้นหาข้อมูล
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchHisVisits();
                    }}
                    placeholder="กรอกข้อมูลผู้รับบริการ (HN, VN, เลขบัตรประชาชน, ชื่อ-สกุล)..."
                    className="w-full h-10 sm:h-9 px-3 text-xs rounded-sm border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        fetchHisVisits();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Visit Date Picker */}
              <div className="sm:col-span-1 lg:col-span-3">
                <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                  วันที่รับบริการ (14 วันล่าสุดหากไม่ระบุ)
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setVisitDate(newDate);
                  }}
                  className="w-full h-10 sm:h-9 px-2.5 text-xs rounded-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </div>

              {/* 3. SearchableSelect for Case Type (Exact same height h-10 sm:h-9, immediate filter) */}
              <div className="sm:col-span-1 lg:col-span-2 relative z-40">
                <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                  ประเภทเคส
                </label>
                <SearchableSelect
                  options={CASE_TYPE_OPTIONS}
                  value={caseTypeFilter}
                  triggerClassName="h-10 sm:h-9"
                  onChange={(v) => {
                    const nextType = (v || 'all') as 'all' | 'general' | 'chronic' | 'psychiatric';
                    setCaseTypeFilter(nextType);
                    fetchHisVisits(nextType);
                  }}
                  placeholder="เลือกประเภทเคส..."
                  searchPlaceholder="ค้นหาประเภท..."
                />
              </div>

              {/* 4. Action Button */}
              <div className="sm:col-span-2 lg:col-span-2">
                <button
                  type="button"
                  onClick={() => fetchHisVisits()}
                  disabled={isLoadingHis}
                  className="w-full h-10 sm:h-9 bg-blue-900 hover:bg-blue-950 disabled:bg-slate-300 text-white text-xs font-semibold rounded-sm shadow-xs transition-colors flex items-center justify-center cursor-pointer"
                >
                  {isLoadingHis ? 'กำลังค้นหา...' : 'ค้นหา'}
                </button>
              </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-0 relative z-10">
              {isLoadingHis ? (
                <div className="py-16 text-center text-slate-500">
                  <p className="text-xs font-medium">กำลังดึงข้อมูลเวชระเบียนจาก HIS...</p>
                </div>
              ) : hisVisits.length > 0 ? (
                <>
                  {/* Desktop Table View (md+) with Dual Scrollbar */}
                  <div className="hidden md:flex flex-col border-b border-slate-200 bg-white">
                    {/* Top Horizontal Scrollbar */}
                    <div
                      ref={topDirectHisScrollRef}
                      onScroll={handleTopDirectHisScroll}
                      className="overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-50/70 py-1"
                      title="เลื่อนเพื่อดูคอลัมน์ของตาราง"
                    >
                      <div style={{ width: `${directHisScrollWidth}px`, height: '1px' }} />
                    </div>

                    {/* Main Table with Bottom Scrollbar */}
                    <div
                      ref={bottomDirectHisScrollRef}
                      onScroll={handleBottomDirectHisScroll}
                      className="table-responsive overflow-x-auto max-h-[60vh]"
                    >
                      <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 text-nowrap whitespace-nowrap">
                            <th className="p-2.5 text-center w-10 border-r border-slate-200">#</th>
                            <th className="p-2.5 text-center w-28 min-w-[100px] border-r border-slate-200">ดำเนินการ</th>
                            <th className="p-2.5 text-center w-28 border-r border-slate-200">ประเภทเคส</th>
                            <th className="p-2.5 border-r border-slate-200 w-36 min-w-[145px]">วันที่-เวลา</th>
                            <th className="p-2.5 border-r border-slate-200 w-28">VN / HN</th>
                            <th className="p-2.5 border-r border-slate-200 min-w-[180px]">ชื่อ-สกุล ผู้ป่วย</th>
                            <th className="p-2.5 text-center border-r border-slate-200 w-16">เพศ</th>
                            <th className="p-2.5 text-center border-r border-slate-200 w-16">อายุ</th>
                            <th className="p-2.5 border-r border-slate-200 min-w-[220px]">การวินิจฉัยโรค (ICD-10)</th>
                            <th className="p-2.5 border-r border-slate-200 min-w-[140px]">แผนก/จุดบริการ</th>
                            <th className="p-2.5 min-w-[140px]">แพทย์ผู้ตรวจ</th>
                          </tr>
                        </thead>
                      <tbody className="divide-y divide-slate-100">
                        {hisVisits.map((v, idx) => {
                          const isCurrentActive = currentVn === v.vn;
                          return (
                            <tr
                              key={v.vn}
                              className={`hover:bg-slate-50 transition-colors text-nowrap whitespace-nowrap ${isCurrentActive ? 'bg-blue-50/50' : ''
                                }`}
                            >
                              <td className="p-2 text-center text-slate-500 font-semibold border-r border-slate-200">
                                {idx + 1}
                              </td>
                              <td className="p-1.5 text-center border-r border-slate-200 w-28">
                                <button
                                  type="button"
                                  onClick={() => handleSelectHisVisit(v)}
                                  className={`w-full py-1.5 px-2.5 rounded-sm text-[11px] font-semibold shadow-xs transition-colors cursor-pointer ${isCurrentActive
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-blue-900 hover:bg-blue-950 text-white'
                                    }`}
                                >
                                  {isCurrentActive ? 'เคสปัจจุบัน' : 'เลือกเคสนี้'}
                                </button>
                              </td>
                              <td className="p-2 text-center border-r border-slate-200">
                                {v.isPsychiatric || v.caseType === 'psychiatric' ? (
                                  <span className="w-full inline-block text-center px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                    จิตเวช
                                  </span>
                                ) : v.isChronic ? (
                                  <span className="w-full inline-block text-center px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    โรคเรื้อรัง
                                  </span>
                                ) : (
                                  <span className="w-full inline-block text-center px-2 py-0.5 rounded-sm text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                    โรคทั่วไป/ฉุกเฉิน
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-slate-900">{formatThaiDate(v.vstdate)}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{formatThaiTime(v.vsttime, v.vstdate)}</div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-bold text-blue-950">{v.hn}</div>
                                <div className="text-[10px] text-slate-500">VN: {v.vn}</div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-slate-900">{v.patientName}</div>
                                {v.cid && <div className="text-[10px] text-slate-500">CID: {v.cid}</div>}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 text-slate-700">
                                {v.sex || '-'}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 text-slate-700">
                                {v.age !== undefined && v.age !== null ? `${v.age} ปี` : '-'}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-blue-900">{v.pdx || '-'}</div>
                                <div className="text-[11px] text-slate-600 truncate max-w-xs" title={v.diagnosisName}>
                                  {v.diagnosisName || '-'}
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200 text-slate-700 text-[11px]">
                                {v.department || '-'}
                              </td>
                              <td className="p-2.5 text-slate-700 text-[11px]">
                                {v.doctorName || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                  {/* Mobile & Tablet Card View (< md) */}
                  <div className="block md:hidden space-y-2.5 p-2">
                    {hisVisits.map((v, idx) => {
                      const isCurrentActive = currentVn === v.vn;
                      return (
                        <div
                          key={v.vn}
                          className={`p-3 bg-white rounded-sm border transition-colors shadow-xs ${isCurrentActive
                            ? 'border-blue-900 ring-1 ring-blue-900 bg-blue-50/20'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                                <span>#{idx + 1}</span>
                                <span>{v.patientName}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                เพศ {v.sex || '-'} • อายุ {v.age} ปี {v.cid ? `• CID: ${v.cid}` : ''}
                              </div>
                            </div>
                            {v.isPsychiatric || v.caseType === 'psychiatric' ? (
                              <span className="shrink-0 px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                จิตเวช
                              </span>
                            ) : v.isChronic ? (
                              <span className="shrink-0 px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                โรคเรื้อรัง
                              </span>
                            ) : (
                              <span className="shrink-0 px-2 py-0.5 rounded-sm text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                ทั่วไป/ฉุกเฉิน
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-b border-slate-100 mb-2.5">
                            <div>
                              <span className="text-[10px] text-slate-400 block">วันที่รับบริการ</span>
                              <span className="font-semibold text-slate-800 block">{formatThaiDate(v.vstdate)}</span>
                              <span className="text-[11px] text-slate-500 block">{formatThaiTime(v.vsttime, v.vstdate)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">HN / VN</span>
                              <span className="font-semibold text-blue-900">HN: {v.hn}</span>
                              <span className="text-[10px] text-slate-500 block">VN: {v.vn}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-[10px] text-slate-400 block">การวินิจฉัยโรค (ICD-10)</span>
                              <span className="font-medium text-blue-950">{v.diagnosisDisplay}</span>
                            </div>
                            {v.department && (
                              <div>
                                <span className="text-[10px] text-slate-400 block">แผนก</span>
                                <span className="text-slate-700 text-[11px]">{v.department}</span>
                              </div>
                            )}
                            {v.doctorName && (
                              <div>
                                <span className="text-[10px] text-slate-400 block">แพทย์</span>
                                <span className="text-slate-700 text-[11px]">{v.doctorName}</span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectHisVisit(v)}
                            className={`w-full h-10 text-xs font-semibold rounded-sm shadow-xs transition-colors flex items-center justify-center ${isCurrentActive
                              ? 'bg-slate-700 text-white'
                              : 'bg-blue-900 hover:bg-blue-950 text-white'
                              }`}
                          >
                            {isCurrentActive ? 'เคสปัจจุบันที่กำลังตรวจ' : 'เลือกเคสนี้ลงแบบประเมิน'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-slate-400">
                  <p className="text-xs">ไม่พบรายการประวัติการรับบริการตามเงื่อนไขที่ระบุ</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    ลองพิมพ์คำค้นหาใหม่ หรือล้างคำค้นหาเพื่อดูเคส 30 วันล่าสุด
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 2: Choose from Sampling Batches ── */}
        {activeTab === 'sampling_batch' && (
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* Batch Selector Bar: SearchableSelect with High Z-Index so it never sinks under cards */}
            <div className="p-3 bg-white border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end shrink-0 relative z-30 overflow-visible">
              <div className="sm:col-span-7 relative z-40">
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  ค้นหาและเลือกรอบการสุ่ม
                </label>
                <SearchableSelect
                  options={batchSelectOptions}
                  value={selectedBatchId}
                  triggerClassName="h-10 sm:h-9"
                  onChange={(val) => {
                    setSelectedBatchId(val);
                    loadBatchItems(val);
                  }}
                  placeholder="พิมพ์ค้นหารอบการสุ่ม..."
                  searchPlaceholder="ค้นหาด้วยรหัสรอบ, วันที่ หรือชื่อรอบ..."
                  emptyMessage="ไม่พบรอบการสุ่มที่ตรงกับการค้นหา"
                />
              </div>

              {/* Instant Search in Sampled Items */}
              <div className="sm:col-span-5">
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  ค้นหาในรอบนี้ ({filteredBatchItems.length}/{batchItems.length} ชาร์ต)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    placeholder="ค้นหา HN, VN, ชื่อผู้ป่วย, ICD-10..."
                    className="w-full h-10 sm:h-9 px-3 text-xs rounded-sm border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500"
                  />
                  {batchSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBatchSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Batch Items Area */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-0 relative z-10">
              {isLoadingItems ? (
                <div className="py-16 text-center text-slate-500">
                  <p className="text-xs font-medium">กำลังโหลดรายการชาร์ตในรอบการสุ่ม...</p>
                </div>
              ) : filteredBatchItems.length > 0 ? (
                <>
                  {/* Desktop Table View (md+) with Dual Scrollbar */}
                  <div className="hidden md:flex flex-col border-b border-slate-200 bg-white">
                    {/* Top Horizontal Scrollbar */}
                    <div
                      ref={topBatchScrollRef}
                      onScroll={handleTopBatchScroll}
                      className="overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-50/70 py-1"
                      title="เลื่อนเพื่อดูคอลัมน์ของตาราง"
                    >
                      <div style={{ width: `${batchScrollWidth}px`, height: '1px' }} />
                    </div>

                    {/* Main Table with Bottom Scrollbar */}
                    <div
                      ref={bottomBatchScrollRef}
                      onScroll={handleBottomBatchScroll}
                      className="table-responsive overflow-x-auto max-h-[60vh]"
                    >
                      <table className="w-full text-xs text-left border-collapse text-nowrap whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 text-nowrap whitespace-nowrap">
                            <th className="p-2.5 text-center w-10 border-r border-slate-200">#</th>
                            <th className="p-2.5 text-center w-28 min-w-[100px] border-r border-slate-200">ดำเนินการ</th>
                            <th className="p-2.5 text-center w-24 border-r border-slate-200">สถานะ</th>
                            <th className="p-2.5 border-r border-slate-200 w-36 min-w-[145px]">วันที่-เวลา</th>
                            <th className="p-2.5 border-r border-slate-200 w-28">VN / HN</th>
                            <th className="p-2.5 border-r border-slate-200 min-w-[180px]">ชื่อ-สกุล ผู้ป่วย</th>
                            <th className="p-2.5 text-center border-r border-slate-200 w-16">เพศ</th>
                            <th className="p-2.5 text-center border-r border-slate-200 w-16">อายุ</th>
                            <th className="p-2.5 border-r border-slate-200 min-w-[220px]">การวินิจฉัยโรค (ICD-10)</th>
                            <th className="p-2.5 border-r border-slate-200 min-w-[140px]">แผนก/จุดบริการ</th>
                            <th className="p-2.5 min-w-[140px]">แพทย์ผู้ตรวจ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {filteredBatchItems.map((item, idx) => {
                          const isAudited = item.auditStatus === 'audited';
                          const isCurrentActive = currentVn === item.vn;
                          return (
                            <tr
                              key={item.itemId || item.vn}
                              className={`hover:bg-slate-50 transition-colors text-nowrap whitespace-nowrap ${isCurrentActive ? 'bg-blue-50/50' : isAudited ? 'bg-emerald-50/30' : ''
                                }`}
                            >
                              <td className="p-2 text-center text-slate-500 font-semibold border-r border-slate-200">
                                {idx + 1}
                              </td>
                              <td className="p-1.5 text-center border-r border-slate-200 w-28">
                                <button
                                  type="button"
                                  onClick={() => handleSelectBatchItem(item)}
                                  className={`w-full py-1.5 px-2.5 rounded-sm text-[11px] font-semibold shadow-xs transition-colors cursor-pointer ${isCurrentActive
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-blue-900 hover:bg-blue-950 text-white'
                                    }`}
                                >
                                  {isCurrentActive ? 'เคสปัจจุบัน' : isAudited ? 'ทบทวน' : 'เลือกเคสนี้'}
                                </button>
                              </td>
                              <td className="p-2 text-center border-r border-slate-200">
                                {isAudited ? (
                                  <span className="w-full inline-block text-center px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ตรวจแล้ว
                                  </span>
                                ) : (
                                  <span className="w-full inline-block text-center px-2 py-0.5 rounded-sm text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                    รอตรวจ
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-slate-900">{formatThaiDate(item.vstdate)}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{formatThaiTime(item.vsttime, item.vstdate)}</div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-bold text-blue-950">{item.hn}</div>
                                <div className="text-[10px] text-slate-500">VN: {item.vn}</div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-slate-900">{item.patientName}</div>
                                {item.cid && <div className="text-[10px] text-slate-500">CID: {item.cid}</div>}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 text-slate-700">
                                {item.sex || '-'}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 text-slate-700">
                                {item.age !== undefined && item.age !== null ? `${item.age} ปี` : '-'}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-semibold text-blue-900">{item.pdx || '-'}</div>
                                <div className="text-[11px] text-slate-600 truncate max-w-xs" title={item.diagnosisName}>
                                  {item.diagnosisName || '-'}
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200 text-slate-700 text-[11px]">
                                {item.department || '-'}
                              </td>
                              <td className="p-2.5 text-slate-700 text-[11px]">
                                {item.doctorName || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                  {/* Mobile & Tablet Card View (< md) */}
                  <div className="block md:hidden space-y-2.5 p-2">
                    {filteredBatchItems.map((item, idx) => {
                      const isAudited = item.auditStatus === 'audited';
                      const isCurrentActive = currentVn === item.vn;
                      return (
                        <div
                          key={item.itemId || item.vn}
                          className={`p-3 bg-white rounded-sm border transition-colors shadow-xs ${isCurrentActive
                            ? 'border-blue-900 ring-1 ring-blue-900 bg-blue-50/20'
                            : isAudited
                              ? 'border-emerald-200 bg-emerald-50/10'
                              : 'border-slate-200'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                                <span>#{idx + 1}</span>
                                <span>{item.patientName}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                เพศ {item.sex || '-'} • อายุ {item.age} ปี {item.cid ? `• CID: ${item.cid}` : ''}
                              </div>
                            </div>
                            {isAudited ? (
                              <span className="shrink-0 px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ตรวจแล้ว
                              </span>
                            ) : (
                              <span className="shrink-0 px-2 py-0.5 rounded-sm text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                รอตรวจ
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-b border-slate-100 mb-2.5">
                            <div>
                              <span className="text-[10px] text-slate-400 block">วันที่รับบริการ</span>
                              <span className="font-semibold text-slate-800 block">{formatThaiDate(item.vstdate)}</span>
                              <span className="text-[11px] text-slate-500 block">{formatThaiTime(item.vsttime, item.vstdate)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">HN / VN</span>
                              <span className="font-semibold text-blue-900">HN: {item.hn}</span>
                              <span className="text-[10px] text-slate-500 block">VN: {item.vn}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-[10px] text-slate-400 block">การวินิจฉัยโรค (ICD-10)</span>
                              <span className="font-medium text-blue-950">{item.pdx ? `${item.pdx} : ${item.diagnosisName}` : item.diagnosisName || '-'}</span>
                            </div>
                            {item.department && (
                              <div>
                                <span className="text-[10px] text-slate-400 block">แผนก</span>
                                <span className="text-slate-700 text-[11px]">{item.department}</span>
                              </div>
                            )}
                            {item.doctorName && (
                              <div>
                                <span className="text-[10px] text-slate-400 block">แพทย์</span>
                                <span className="text-slate-700 text-[11px]">{item.doctorName}</span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectBatchItem(item)}
                            className={`w-full h-10 text-xs font-semibold rounded-sm shadow-xs transition-colors flex items-center justify-center ${isCurrentActive
                              ? 'bg-slate-700 text-white'
                              : isAudited
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                : 'bg-blue-900 hover:bg-blue-950 text-white'
                              }`}
                          >
                            {isCurrentActive ? 'เคสปัจจุบันที่กำลังตรวจ' : isAudited ? 'ทบทวน' : 'เลือกเคสนี้ลงแบบประเมิน'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-slate-400">
                  <p className="text-xs">
                    {batchSearchQuery
                      ? `ไม่พบรายการชาร์ตที่ตรงกับคำค้นหา "${batchSearchQuery}"`
                      : 'ยังไม่มีรายการชาร์ตในรอบการสุ่มนี้'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Modal Footer ── */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            {activeTab === 'direct_his'
              ? `แสดง ${hisVisits.length} รายการล่าสุด`
              : `แสดง ${filteredBatchItems.length} รายการ`}
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
