'use client';

import { apiUrl } from '@/lib/constants';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SearchableSelect, SearchableOption } from '@/components/ui/SearchableSelect';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Calendar,
  User,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  FileSpreadsheet,
  Clock,
  Laptop,
  Building2,
  RotateCcw,
  Copy,
  Check,
  Download,
  Globe,
  Database,
  ArrowUpDown,
  Tag,
  Monitor,
  Smartphone,
  Server,
  KeyRound,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { alertError, alertSuccess } from '@/lib/mra-alert';

// ── Types ───────────────────────────────────────────────────────────────────

interface AuditLogItem {
  id: number;
  eventTime: string;
  category: string;
  action: string;
  status: 'success' | 'failed' | 'denied';
  severity: 'info' | 'warning' | 'critical';
  actorLoginname: string | null;
  actorFullname: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  details: string | null;
  ipAddress: string | null;
  userAgent?: string | null;
  requestMethod: string | null;
  requestPath: string | null;
}

interface AuditStats {
  totalAll: number;
  todayCount: number;
  failedCount: number;
  deniedCount: number;
  criticalCount: number;
}

// ── Helper Utilities ────────────────────────────────────────────────────────

/** Calculate human-friendly relative time in Thai */
function getRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr.replace(' ', 'T'));
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 5) return 'เมื่อสักครู่';
    if (diffSec < 60) return `${diffSec} วินาทีที่แล้ว`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ชม. ที่แล้ว`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return 'เมื่อวานนี้';
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    return dateStr.split(' ')[0] || dateStr;
  } catch {
    return dateStr;
  }
}

/** Parse human-friendly Browser & OS from User-Agent */
function parseUserAgent(ua?: string | null): { browser: string; os: string } {
  if (!ua) return { browser: 'ไม่ระบุ', os: 'ไม่ระบุ' };

  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown Browser';
  if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua)) browser = 'Apple Safari';
  else if (/postman/i.test(ua)) browser = 'Postman API Client';
  else if (/curl/i.test(ua)) browser = 'cURL';

  return { browser, os };
}

/** Human-friendly action titles */
const ACTION_TRANSLATIONS: Record<string, string> = {
  login: 'เข้าสู่ระบบ',
  logout: 'ออกจากระบบ',
  login_failed: 'เข้าสู่ระบบไม่สำเร็จ',
  login_denied: 'ถูกปฏิเสธการเข้าสู่ระบบ',
  save_audit: 'บันทึกผลตรวจประเมิน',
  revoke_audit: 'เพิกถอนผลตรวจประเมิน',
  sampling_create: 'สุ่มตัวอย่างเวชระเบียน',
  batch_finalize: 'ปิดรอบการสุ่มเวชระเบียน',
  batch_unlock: 'ปลดล็อกรอบการสุ่ม',
  db_config_update: 'บันทึกการตั้งค่าฐานข้อมูล',
  db_test_connection: 'ทดสอบเชื่อมต่อฐานข้อมูล',
  backup_create: 'สำรองฐานข้อมูล',
  backup_restore: 'กู้คืนฐานข้อมูล',
  sec_key_generate: 'สร้างกุญแจความปลอดภัย',
  audit_trail_export: 'ส่งออกบันทึก Audit Logs',
  export_excel: 'ส่งออกรายงาน Excel',
  export_data: 'ส่งออกข้อมูลจากระบบ',
  view_medical_record: 'เข้าดูเวชระเบียนผู้ป่วย',
};

export default function AuditLogsPage() {
  const { user } = useAuthStore();

  // Core Data States
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const [stats, setStats] = useState<AuditStats | null>(null);

  // Pagination States (High-volume safety: capped at 100 max)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Search & Filter states
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string>('all');

  // UI Interactive States
  const [selectedItem, setSelectedItem] = useState<AuditLogItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  // Debounce search input (300ms) to safeguard database queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Category options for SearchableSelect
  const categoryOptions: SearchableOption[] = [
    { value: '', label: 'ทุกหมวดหมู่', badge: 'ALL' },
    { value: 'AUTH', label: 'เข้า/ออกจากระบบ', badge: 'AUTH' },
    { value: 'AUDIT', label: 'บันทึก/เพิกถอนผลตรวจประเมิน', badge: 'AUDIT' },
    { value: 'SAMPLING', label: 'การสุ่มเวชระเบียน', badge: 'SAMPLING' },
    { value: 'BATCH', label: 'จัดการรอบการสุ่ม', badge: 'BATCH' },
    { value: 'SETTINGS', label: 'การตั้งค่าระบบ & DB', badge: 'SETTINGS' },
    { value: 'BACKUP', label: 'การสำรองฐานข้อมูล', badge: 'BACKUP' },
    { value: 'SECURITY', label: 'กุญแจความปลอดภัย', badge: 'SECURITY' },
    { value: 'EXPORT', label: 'การส่งออกรายงานและข้อมูล', badge: 'EXPORT' },
    { value: 'ACCESS', label: 'การเข้าดูเวชระเบียน', badge: 'ACCESS' },
    { value: 'SYSTEM', label: 'เหตุการณ์ระบบ', badge: 'SYSTEM' },
  ];

  // Status options for SearchableSelect
  const statusOptions: SearchableOption[] = [
    { value: '', label: 'ทุกสถานะ', badge: 'ALL' },
    { value: 'success', label: 'สำเร็จ', badge: 'SUCCESS' },
    { value: 'failed', label: 'ไม่สำเร็จ', badge: 'FAILED' },
    { value: 'denied', label: 'ถูกปฏิเสธสิทธิ์', badge: 'DENIED' },
  ];

  // Severity options for SearchableSelect
  const severityOptions: SearchableOption[] = [
    { value: '', label: 'ทุกระดับความสำคัญ', badge: 'ALL' },
    { value: 'info', label: 'ทั่วไป', badge: 'INFO' },
    { value: 'warning', label: 'แจ้งเตือน', badge: 'WARNING' },
    { value: 'critical', label: 'สำคัญมาก', badge: 'CRITICAL' },
  ];

  // Page size options
  const pageSizeOptions: SearchableOption[] = [
    { value: '25', label: '25 รายการ', badge: '' },
    { value: '50', label: '50 รายการ', badge: '' },
    { value: '100', label: '100 รายการ', badge: '' },
  ];

  // Fetch Logs with server-side pagination and filters
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
      if (category) params.set('category', category);
      if (status) params.set('status', status);
      if (severity) params.set('severity', severity);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(apiUrl(`/api/settings/audit-trail?${params.toString()}`));
      const json = await res.json();

      if (json.success && json.data) {
        setItems(json.data.items || []);
        setTotal(json.data.total || 0);
        if (json.data.stats) {
          setStats(json.data.stats);
        }
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      alertError('เกิดข้อผิดพลาดในการโหลดข้อมูล Audit Logs');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, category, status, severity, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Copy to clipboard helper
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
  };

  // Quick Preset Filters
  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    setPage(1);

    const today = new Date().toISOString().split('T')[0];

    switch (preset) {
      case 'today': {
        setDateFrom(today);
        setDateTo(today);
        setCategory('');
        setStatus('');
        setSeverity('');
        break;
      }
      case '7d': {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        setDateFrom(d.toISOString().split('T')[0]);
        setDateTo(today);
        setCategory('');
        setStatus('');
        setSeverity('');
        break;
      }
      case '30d': {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        setDateFrom(d.toISOString().split('T')[0]);
        setDateTo(today);
        setCategory('');
        setStatus('');
        setSeverity('');
        break;
      }
      case 'failed': {
        setDateFrom('');
        setDateTo('');
        setCategory('');
        setStatus('failed');
        setSeverity('');
        break;
      }
      case 'denied': {
        setDateFrom('');
        setDateTo('');
        setCategory('');
        setStatus('denied');
        setSeverity('');
        break;
      }
      case 'audit': {
        setDateFrom('');
        setDateTo('');
        setCategory('AUDIT');
        setStatus('');
        setSeverity('');
        break;
      }
      case 'security': {
        setDateFrom('');
        setDateTo('');
        setCategory('SECURITY');
        setStatus('');
        setSeverity('');
        break;
      }
      case 'all':
      default: {
        setDateFrom('');
        setDateTo('');
        setCategory('');
        setStatus('');
        setSeverity('');
        break;
      }
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCategory('');
    setStatus('');
    setSeverity('');
    setDateFrom('');
    setDateTo('');
    setActivePreset('all');
    setPage(1);
  };

  // Safe Export to CSV/Excel with UTF-8 BOM
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('export', 'true');
      params.set('exportLimit', '1500'); // Safe server-side cap
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
      if (category) params.set('category', category);
      if (status) params.set('status', status);
      if (severity) params.set('severity', severity);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(apiUrl(`/api/settings/audit-trail?${params.toString()}`));
      const json = await res.json();

      if (!json.success || !json.data?.items?.length) {
        alertError('ไม่พบข้อมูลสำหรับส่งออกตามเงื่อนไขที่เลือก');
        return;
      }

      const rows: AuditLogItem[] = json.data.items;

      // Construct CSV content with UTF-8 BOM (\uFEFF) for Excel compatibility
      const headers = [
        'ID',
        'วันเวลา (Event Time)',
        'หมวดหมู่ (Category)',
        'การกระทำ (Action)',
        'สถานะ (Status)',
        'ระดับ (Severity)',
        'ผู้กระทำ (Username)',
        'ชื่อผู้กระทำ (Full Name)',
        'บทบาท (Role)',
        'ประเภทเป้าหมาย (Target Type)',
        'รหัสเป้าหมาย (Target ID)',
        'คำอธิบาย (Summary)',
        'IP Address',
        'Method',
        'Path',
        'User Agent',
      ];

      const csvRows = [headers.join(',')];

      rows.forEach((r) => {
        const clean = (val: unknown) => {
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        };

        csvRows.push(
          [
            clean(r.id),
            clean(r.eventTime),
            clean(r.category),
            clean(r.action),
            clean(r.status),
            clean(r.severity),
            clean(r.actorLoginname),
            clean(r.actorFullname),
            clean(r.actorRole),
            clean(r.targetType),
            clean(r.targetId),
            clean(r.summary),
            clean(r.ipAddress),
            clean(r.requestMethod),
            clean(r.requestPath),
            clean(r.userAgent),
          ].join(',')
        );
      });

      const csvContent = '\uFEFF' + csvRows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
      link.setAttribute('href', url);
      link.setAttribute('download', `mra_audit_logs_${stamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alertSuccess(`ส่งออกประวัติการใช้งาน ${rows.length} รายการสำเร็จ`);
    } catch (err) {
      console.error('Export error:', err);
      alertError('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  // Category badge styles
  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'AUTH':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'AUDIT':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'SAMPLING':
      case 'BATCH':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'SETTINGS':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'BACKUP':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'SECURITY':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'EXPORT':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'ACCESS':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Severity badge & icon
  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return {
          icon: <ShieldAlert size={12} className="text-rose-600" />,
          label: 'CRITICAL',
          classes: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={12} className="text-amber-600" />,
          label: 'WARNING',
          classes: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'info':
      default:
        return {
          icon: <Info size={12} className="text-blue-600" />,
          label: 'INFO',
          classes: 'bg-blue-50/70 text-blue-700 border-blue-200',
        };
    }
  };

  // Status badge styles
  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'success':
        return {
          icon: <CheckCircle2 size={12} className="text-emerald-500" />,
          label: 'สำเร็จ (Success)',
          shortLabel: 'สำเร็จ',
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'denied':
        return {
          icon: <ShieldAlert size={12} className="text-amber-500" />,
          label: 'ปฏิเสธสิทธิ์ (Denied)',
          shortLabel: 'ปฏิเสธสิทธิ์',
          classes: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'failed':
      default:
        return {
          icon: <XCircle size={12} className="text-rose-500" />,
          label: 'ไม่สำเร็จ (Failed)',
          shortLabel: 'ไม่สำเร็จ',
          classes: 'bg-rose-50 text-rose-700 border-rose-200',
        };
    }
  };

  // User Role badge styles (Consistent with Profile Info in Topbar)
  const getRoleBadgeClass = (role?: string | null) => {
    if (!role) return 'bg-slate-100 text-slate-700 border-slate-300';
    const r = role.toLowerCase();
    if (r.includes('admin')) {
      return 'bg-sky-50 text-sky-700 border border-sky-300';
    }
    if (r.includes('audit')) {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-300';
    }
    return 'bg-slate-100 text-slate-700 border border-slate-300';
  };

  return (
    <div className="section-gap">
      {/* ── 1. Page Header (Standardized White Header Card) ── */}
      <div className="bg-white p-4 md:p-5 rounded-sm border border-slate-200 shadow-xs space-y-3">
        <div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-sm bg-blue-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                <History size={22} strokeWidth={2.2} className="text-white shrink-0" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-blue-950 leading-snug">
                  ประวัติการใช้งานระบบ
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  บันทึกกิจกรรมและประวัติความปลอดภัยของระบบเวชระเบียน (Audit Trail Log & Security Events)
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={exporting || loading}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-sm text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                title="ส่งออกประวัติการใช้งานเป็นไฟล์ CSV สำหรับ Excel"
              >
                <Download size={13} className={exporting ? 'animate-bounce text-pink-600' : 'text-slate-500'} />
                <span>{exporting ? 'กำลังส่งออก...' : 'ส่งออกประวัติ'}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchLogs()}
                disabled={loading}
                className="h-8 w-8 inline-flex items-center justify-center rounded-sm text-xs font-medium border border-blue-900 bg-blue-900 hover:bg-blue-950 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                title="รีเฟรชข้อมูลประวัติการใช้งาน"
                aria-label="รีเฟรชข้อมูล"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Overview Stats Metric Cards (High-volume visibility) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Logs */}
        <div
          onClick={() => applyPreset('all')}
          className="bg-white p-3.5 rounded-sm border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">บันทึกทั้งหมด</span>
            <div className="p-1.5 rounded-sm bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
              <Database size={15} />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-bold font-mono text-slate-800">
              {stats?.totalAll?.toLocaleString() ?? total.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">รายการ</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">รวมทุกกิจกรรมในระบบ</p>
        </div>

        {/* Today's Events */}
        <div
          onClick={() => applyPreset('today')}
          className="bg-white p-3.5 rounded-sm border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">กิจกรรมวันนี้</span>
            <div className="p-1.5 rounded-sm bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
              <Clock size={15} />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-bold font-mono text-emerald-700">
              {stats?.todayCount?.toLocaleString() ?? '-'}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">รายการ</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">กิจกรรมตั้งแต่วันนี้ 00:00</p>
        </div>

        {/* Failed / Denied */}
        <div
          onClick={() => applyPreset('failed')}
          className="bg-white p-3.5 rounded-sm border border-slate-200 shadow-xs hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ไม่สำเร็จ / ปฏิเสธ</span>
            <div className="p-1.5 rounded-sm bg-rose-50 text-rose-600 group-hover:bg-rose-100 transition-colors">
              <XCircle size={15} />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-bold font-mono text-rose-600">
              {((stats?.failedCount || 0) + (stats?.deniedCount || 0)).toLocaleString()}
            </span>
            <span className="text-[11px] text-rose-500 font-medium">เหตุการณ์</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            ล้มเหลว {stats?.failedCount || 0} / ปฏิเสธ {stats?.deniedCount || 0}
          </p>
        </div>

        {/* Critical / Warnings */}
        <div
          onClick={() => {
            setSeverity('critical');
            setPage(1);
          }}
          className="bg-white p-3.5 rounded-sm border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">เหตุการณ์สำคัญ</span>
            <div className="p-1.5 rounded-sm bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-bold font-mono text-amber-700">
              {stats?.criticalCount?.toLocaleString() ?? 0}
            </span>
            <span className="text-[11px] text-amber-600 font-medium">ระดับวิกฤต</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">ควรตรวจสอบและเฝ้าระวัง</p>
        </div>
      </div>

      {/* ── 3. Filter Toolbar Card (SearchableSelect with overflow-visible to prevent clipping) ── */}
      <Card className="rounded-sm border-slate-200 shadow-xs overflow-visible relative z-30">
        <CardHeader className="p-3.5 md:p-4 border-b border-slate-100 bg-slate-50/70 rounded-t-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Filter size={14} className="text-blue-900" />
              <span>ตัวกรองและค้นหาข้อมูลประวัติการใช้งาน</span>
            </CardTitle>

            {/* Quick Preset Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'today', label: 'วันนี้' },
                { id: '7d', label: '7 วันล่าสุด' },
                { id: 'failed', label: 'ไม่สำเร็จ/ปฏิเสธ' },
                { id: 'audit', label: 'ผลตรวจประเมิน' },
                { id: 'security', label: 'ความปลอดภัย' },
              ].map((chip) => {
                const isActive = activePreset === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => applyPreset(chip.id)}
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-medium border transition-colors cursor-pointer ${isActive
                      ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    {chip.label}
                  </button>
                );
              })}

              {(search || category || status || severity || dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer transition-colors"
                >
                  <RotateCcw size={11} />
                  <span>ล้างตัวกรอง</span>
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3 overflow-visible">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search Keyword */}
            <div className="sm:col-span-2 relative">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">ค้นหาประวัติ</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="กรอกคำค้นหา..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-7 h-9 text-xs rounded-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 bg-white text-slate-800 placeholder-slate-400 shadow-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Category SearchableSelect */}
            <div className="relative z-20">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">หมวดหมู่</label>
              <SearchableSelect
                options={categoryOptions}
                value={category}
                onChange={(val) => {
                  setCategory(val);
                  setActivePreset('');
                  setPage(1);
                }}
                placeholder="เลือกหมวดหมู่..."
                searchPlaceholder="ค้นหาหมวดหมู่..."
                allOptionLabel="ทุกหมวดหมู่"
                triggerClassName="h-9"
              />
            </div>

            {/* Status SearchableSelect */}
            <div className="relative z-10">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">สถานะ</label>
              <SearchableSelect
                options={statusOptions}
                value={status}
                onChange={(val) => {
                  setStatus(val);
                  setActivePreset('');
                  setPage(1);
                }}
                placeholder="เลือกสถานะ..."
                searchPlaceholder="ค้นหาสถานะ..."
                allOptionLabel="ทุกสถานะ"
                triggerClassName="h-9"
              />
            </div>

            {/* Severity SearchableSelect */}
            <div className="relative z-30">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">ระดับความสำคัญ</label>
              <SearchableSelect
                options={severityOptions}
                value={severity}
                onChange={(val) => {
                  setSeverity(val);
                  setActivePreset('');
                  setPage(1);
                }}
                placeholder="เลือกระดับ..."
                searchPlaceholder="ค้นหาระดับ..."
                allOptionLabel="ทุกระดับ"
                triggerClassName="h-9"
              />
            </div>

            {/* Page Size Selector (Safeguard) */}
            <div className="relative z-20">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">แถวต่อหน้า</label>
              <SearchableSelect
                options={pageSizeOptions}
                value={String(pageSize)}
                onChange={(val) => {
                  setPageSize(Number(val) || 25);
                  setPage(1);
                }}
                placeholder="25 แถว"
                searchPlaceholder="ค้นหาจำนวน..."
                triggerClassName="h-9"
              />
            </div>

            {/* Date Range: From */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">ตั้งแต่วันที่</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setActivePreset('');
                  setPage(1);
                }}
                className="w-full px-2.5 h-9 text-xs rounded-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 bg-white text-slate-800 shadow-xs"
              />
            </div>

            {/* Date Range: To */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">ถึงวันที่</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setActivePreset('');
                  setPage(1);
                }}
                className="w-full px-2.5 h-9 text-xs rounded-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 bg-white text-slate-800 shadow-xs"
              />
            </div>
          </div>

          {/* Quick summary below filters */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 gap-2">
            <span className="flex items-center gap-1.5">
              <span>พบข้อมูลตามเงื่อนไข</span>
              <strong className="text-slate-800 font-semibold font-mono">{total.toLocaleString()}</strong>
              <span>รายการ (แสดงหน้า {page} จาก {totalPages})</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Table Card (Standardized Enterprise MRA Table with rounded-sm) ── */}
      <Card className="rounded-sm border-slate-200 shadow-xs overflow-hidden relative z-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 w-44 whitespace-nowrap">Timestamp</th>
                <th className="py-2.5 px-2.5 w-24 text-center">Severity</th>
                <th className="py-2.5 px-3 w-28 text-center">Category</th>
                <th className="py-2.5 px-3 w-40">Action</th>
                <th className="py-2.5 px-3 w-44">Actor</th>
                <th className="py-2.5 px-3.5 min-w-[200px]">Summary</th>
                <th className="py-2.5 px-3 w-32 whitespace-nowrap">IP Address</th>
                <th className="py-2.5 px-3 w-28 text-center">Status</th>
                <th className="py-2.5 px-3 w-16 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-900" />
                    <span className="font-medium text-xs">กำลังประมวลผลและดึงข้อมูล Audit Logs...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-slate-400">
                    <History size={28} className="mx-auto mb-2 text-slate-300" />
                    <span className="font-medium text-xs">ไม่พบประวัติการใช้งานตามเงื่อนไขที่กำหนด</span>
                    <p className="text-[11px] text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองเพื่อค้นหาอีกครั้ง</p>
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const st = getStatusBadge(it.status);
                  const sev = getSeverityBadge(it.severity);
                  const rowNumber = (page - 1) * pageSize + idx + 1;
                  const friendlyAction = ACTION_TRANSLATIONS[it.action] || it.action;
                  const relativeTime = getRelativeTime(it.eventTime);

                  return (
                    <tr
                      key={it.id}
                      className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedItem(it)}
                    >
                      {/* ID / Row Number */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        <span title={`Log ID: #${it.id}`}>{rowNumber}</span>
                      </td>

                      {/* Event Time */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono text-[11px] font-semibold text-slate-700">
                          {it.eventTime}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          <span>{relativeTime}</span>
                        </div>
                      </td>

                      {/* Severity */}
                      <td className="py-2.5 px-2.5 text-center">
                        <span
                          className={`w-100 inline-flex items-center justify-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-sm border uppercase ${sev.classes}`}
                          title={`ความสำคัญ: ${sev.label}`}
                        >
                          {sev.icon}
                          <span>{sev.label}</span>
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`w-100 inline-block text-center text-[10px] font-bold px-2 py-0.5 rounded-sm border uppercase tracking-wider ${getCategoryBadge(
                            it.category
                          )}`}
                        >
                          {it.category}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 text-xs truncate max-w-[150px]" title={it.action}>
                          {friendlyAction}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 block truncate max-w-[150px]" title={it.action}>
                          {it.action}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="py-2.5 px-3">
                        <div className="truncate max-w-[160px]">
                          <span
                            className="font-semibold text-slate-800 text-xs block truncate"
                            title={it.actorFullname || it.actorLoginname || 'ระบบ (System)'}
                          >
                            {it.actorFullname || it.actorLoginname || 'ระบบ (System)'}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {it.actorLoginname && (
                              <span className="font-mono text-[10px] text-slate-400">
                                @{it.actorLoginname}
                              </span>
                            )}
                            {it.actorRole && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm border uppercase tracking-wider ${getRoleBadgeClass(
                                  it.actorRole
                                )}`}
                              >
                                {it.actorRole}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Summary & Target */}
                      <td className="py-2.5 px-3.5 text-slate-600">
                        <div className="line-clamp-1 font-medium text-slate-700" title={it.summary}>
                          {it.summary}
                        </div>
                        {it.targetId && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 mt-0.5">
                            <span className="text-slate-400 font-sans">เป้าหมาย:</span>
                            <span className="bg-slate-100 px-1 py-0.2 rounded-sm text-slate-700 border border-slate-200 truncate max-w-[160px]">
                              {it.targetType ? `${it.targetType}: ` : ''}{it.targetId}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(it.targetId || '', `target_${it.id}`);
                              }}
                              className="text-slate-400 hover:text-blue-900 p-0.5 transition-colors cursor-pointer"
                              title="คัดลอกรหัสเป้าหมาย"
                            >
                              {copiedKey === `target_${it.id}` ? (
                                <Check size={11} className="text-emerald-600" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* IP Address */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                          <span>{it.ipAddress || '-'}</span>
                          {it.ipAddress && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(it.ipAddress || '', `ip_${it.id}`);
                              }}
                              className="text-slate-400 hover:text-blue-900 p-0.5 transition-colors cursor-pointer"
                              title="คัดลอก IP Address"
                            >
                              {copiedKey === `ip_${it.id}` ? (
                                <Check size={11} className="text-emerald-600" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          )}
                        </div>
                        {it.requestMethod && (
                          <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                            {it.requestMethod} {it.requestPath ? it.requestPath.slice(0, 18) : ''}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`w-100 inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-sm border ${st.classes}`}
                        >
                          {st.icon}
                          <span>{st.shortLabel}</span>
                        </span>
                      </td>

                      {/* View Action */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(it);
                          }}
                          className="p-1.5 rounded-sm text-slate-400 hover:text-blue-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="ดูรายละเอียดการตรวจสอบเชิงลึก"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-2">
            <span>
              แสดง {items.length > 0 ? (page - 1) * pageSize + 1 : 0} ถึง{' '}
              {Math.min(page * pageSize, total)} จาก {total.toLocaleString()} รายการ
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              className="px-2 py-1 rounded-sm border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors text-[11px]"
              title="หน้าแรก"
            >
              หน้าแรก
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-sm border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="หน้าก่อนหน้า"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="font-semibold text-slate-700 px-2 font-mono">
              หน้า {page} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-sm border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="หน้าถัดไป"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
              className="px-2 py-1 rounded-sm border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors text-[11px]"
              title="หน้าสุดท้าย"
            >
              หน้าสุดท้าย
            </button>
          </div>
        </div>
      </Card>

      {/* ── 5. Detail Modal (Enterprise Standard Audit Inspection Modal) ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-sm shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden animate-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between rounded-t-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-sm bg-blue-900 text-white">
                  <History size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800">
                      รายละเอียดบันทึกเหตุการณ์
                    </h3>
                    <span className="font-mono text-xs px-2 py-0.2 rounded-sm bg-slate-200 text-slate-700 font-semibold">
                      #{selectedItem.id}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {selectedItem.eventTime} ({getRelativeTime(selectedItem.eventTime)})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
              {/* Top Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-sm bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">หมวดหมู่</span>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-sm border uppercase ${getCategoryBadge(selectedItem.category)}`}>
                    {selectedItem.category}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">สถานะ</span>
                  <div className="mt-1 flex items-center gap-1 font-semibold text-slate-700">
                    {getStatusBadge(selectedItem.status).icon}
                    <span>{getStatusBadge(selectedItem.status).label}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">ระดับความสำคัญ</span>
                  <div className="mt-1 flex items-center gap-1 font-semibold text-slate-700">
                    {getSeverityBadge(selectedItem.severity).icon}
                    <span className="uppercase">{selectedItem.severity}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">การกระทำ</span>
                  <span className="font-mono font-semibold text-slate-800 block mt-1 truncate" title={selectedItem.action}>
                    {selectedItem.action}
                  </span>
                </div>
              </div>

              {/* Summary Description Box */}
              <div>
                <span className="text-slate-600 font-bold block mb-1 text-xs">
                  รายละเอียดเพิ่มเติม
                </span>
                <div className="p-3 rounded-sm bg-blue-50/60 border border-blue-100 text-slate-800 leading-relaxed font-medium">
                  {selectedItem.summary}
                </div>
              </div>

              {/* Actor & Client Context */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Actor Box */}
                <div className="p-3.5 rounded-sm bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 border-b border-slate-100 pb-1.5">
                    <User size={14} className="text-blue-900" />
                    <span>ข้อมูลผู้กระทำรายการ</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">ชื่อ-นามสกุล</span>
                      <span className="font-semibold text-slate-800">{selectedItem.actorFullname || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">ชื่อผู้ใช้งาน</span>
                      <span className="font-mono text-slate-700">@{selectedItem.actorLoginname || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">บทบาทสิทธิ์</span>
                      <span
                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded-sm border uppercase tracking-wider ${getRoleBadgeClass(
                          selectedItem.actorRole
                        )}`}
                      >
                        {selectedItem.actorRole || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Network & Device Context */}
                <div className="p-3.5 rounded-sm bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 border-b border-slate-100 pb-1.5">
                    <Globe size={14} className="text-blue-900" />
                    <span>ข้อมูลเครือข่ายและการเรียกใช้งาน</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">IP Address</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-semibold text-slate-800">{selectedItem.ipAddress || '-'}</span>
                        {selectedItem.ipAddress && (
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedItem.ipAddress || '', 'modal_ip')}
                            className="text-slate-400 hover:text-blue-900 p-0.5 cursor-pointer"
                            title="คัดลอก IP"
                          >
                            {copiedKey === 'modal_ip' ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">HTTP Method / Path</span>
                      <span className="font-mono text-slate-700">
                        {selectedItem.requestMethod || '-'} {selectedItem.requestPath || ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">เบราว์เซอร์ / ระบบ</span>
                      <span className="text-slate-700 font-medium">
                        {parseUserAgent(selectedItem.userAgent).browser} ({parseUserAgent(selectedItem.userAgent).os})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Target Entity Box */}
              {selectedItem.targetId && (
                <div className="p-3.5 rounded-sm bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 border-b border-slate-100 pb-1.5">
                    <Tag size={14} className="text-blue-900" />
                    <span>เป้าหมายของรายการ</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">ประเภทเป้าหมาย</span>
                      <span className="font-semibold text-slate-800">{selectedItem.targetType || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">รหัสเป้าหมาย</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-mono font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200">
                          {selectedItem.targetId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedItem.targetId || '', 'modal_target')}
                          className="text-slate-400 hover:text-blue-900 p-1 cursor-pointer"
                          title="คัดลอกรหัสเป้าหมาย"
                        >
                          {copiedKey === 'modal_target' ? (
                            <Check size={12} className="text-emerald-600" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Details & JSON Viewer */}
              {selectedItem.details && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 font-bold flex items-center gap-1.5 text-xs">
                      <FileText size={14} className="text-blue-900" />
                      <span>ข้อมูลเชิงลึก</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedItem.details || '', 'modal_json')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-900 hover:text-blue-950 p-1 cursor-pointer"
                    >
                      {copiedKey === 'modal_json' ? (
                        <>
                          <Check size={12} className="text-emerald-600" />
                          <span className="text-emerald-600">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>คัดลอก JSON</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-3.5 rounded-sm bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-56 border border-slate-800 shadow-inner leading-relaxed">
                    {(() => {
                      try {
                        const parsed = typeof selectedItem.details === 'string' ? JSON.parse(selectedItem.details) : selectedItem.details;
                        return JSON.stringify(parsed, null, 2);
                      } catch {
                        return selectedItem.details;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-sm">
              <span className="text-[11px] text-slate-400 font-mono">
                MRA Audit Trail Log ID: #{selectedItem.id}
              </span>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-1.5 rounded-sm text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer transition-colors shadow-xs"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
