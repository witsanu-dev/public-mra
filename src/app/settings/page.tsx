'use client';

import { apiUrl } from '@/lib/constants';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Settings,
  Database,
  Hospital,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowLeft,
  Server,
  Zap,
  ShieldAlert,
  Clock,
  Sparkles,
  Layers,
  Check,
  Download,
  HardDrive,
  Smartphone,
  KeyRound,
  RotateCcw,
  UserCheck,
  ShieldLock,
  ShieldOff,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { RBAC } from '@/lib/rbac';
import { alertConfirm, alertSuccess, alertError, alertWarning } from '@/lib/mra-alert';
import { TwoFactorModal } from '@/components/settings/TwoFactorModal';

interface DbFormState {
  host: string;
  port: number | string;
  database: string;
  user: string;
  password: string;
}

interface TestStatus {
  tested: boolean;
  loading: boolean;
  success: boolean;
  latencyMs?: number;
  serverVersion?: string;
  hospitalCode?: string;
  hospitalName?: string;
  tableCount?: number;
  message?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, initialized } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Forms
  const [hisConfig, setHisConfig] = useState<DbFormState>({
    host: '192.168.1.100',
    port: 3306,
    database: 'hos',
    user: 'his_user',
    password: '',
  });

  const [mraConfig, setMraConfig] = useState<DbFormState>({
    host: '127.0.0.1',
    port: 3306,
    database: 'db_mra',
    user: 'root',
    password: '',
  });

  // Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isBackupInfoLoading, setIsBackupInfoLoading] = useState(true);
  const [backupInfoError, setBackupInfoError] = useState<string | null>(null);
  const [backupMode, setBackupMode] = useState<'structure_data' | 'structure_only'>('structure_data');
  const [backupInfo, setBackupInfo] = useState<{
    database: string;
    host: string;
    port?: number;
    charset?: string;
    collation?: string;
    baseTableCount: number;
    viewCount: number;
    totalRows: number;
    totalBytes: number;
    totalSizeFormatted: string;
    serverVersion: string;
    navicatVersionNum?: string;
  } | null>(null);

  // Password states: securely masked by default, user inputs only when changing
  const [isChangingHisPass, setIsChangingHisPass] = useState(false);
  const [isChangingMraPass, setIsChangingMraPass] = useState(false);

  // Test status states
  const [hisTest, setHisTest] = useState<TestStatus>({
    tested: false,
    loading: false,
    success: false,
  });

  const [mraTest, setMraTest] = useState<TestStatus>({
    tested: false,
    loading: false,
    success: false,
  });

  // MFA state
  const [is2FaModalOpen, setIs2FaModalOpen] = useState(false);
  const [my2FaEnabled, setMy2FaEnabled] = useState(false);
  const [admin2FaUsers, setAdmin2FaUsers] = useState<
    Array<{
      loginname: string;
      userFullname: string | null;
      isEnabled: boolean;
      enrolledAt: string | null;
      backupRemaining: number;
      lockedUntil: string | null;
    }>
  >([]);
  const [isAdmin2FaLoading, setIsAdmin2FaLoading] = useState(false);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(0);
  useEffect(() => {
    setCurrentTimestamp(Date.now());
  }, [admin2FaUsers]);

  // Load MFA status
  const load2FaStatus = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/status'));
      const json = await res.json();
      if (json.success) {
        setMy2FaEnabled(json.isEnabled);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load MFA Admin list
  const loadAdmin2FaList = useCallback(async () => {
    setIsAdmin2FaLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/admin'));
      const json = await res.json();
      if (json.success && json.users) {
        setAdmin2FaUsers(json.users);
      }
    } catch {
      // ignore
    } finally {
      setIsAdmin2FaLoading(false);
    }
  }, []);

  // Admin reset MFA for a user
  const handleAdminReset2Fa = async (targetLoginname: string, targetName: string | null) => {
    const ok = await alertConfirm({
      title: 'รีเซ็ต MFA ผู้ใช้งาน?',
      text: `คุณต้องการรีเซ็ตและปิด MFA ของผู้ใช้ ${targetName || targetLoginname} (@${targetLoginname}) หรือไม่?\n(ผู้ใช้จะสามารถล็อกอินได้ตามปกติโดยไม่ต้องใช้รหัส 6 หลัก)`,
      confirmText: 'รีเซ็ต MFA',
      cancelText: 'ยกเลิก',
      icon: 'warning',
    });

    if (!ok) return;

    try {
      const res = await fetch(apiUrl('/api/auth/2fa/admin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLoginname, action: 'reset' }),
      });
      const json = await res.json();
      if (json.success) {
        alertSuccess('รีเซ็ตสำเร็จ', json.message);
        loadAdmin2FaList();
      } else {
        alertError('รีเซ็ตไม่สำเร็จ', json.error);
      }
    } catch {
      alertError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  // Admin bulk sync users from HIS
  const handleSyncUsersFromHis = async () => {
    const ok = await alertConfirm({
      title: 'ซิงค์ข้อมูลผู้ใช้งานจาก HIS?',
      text: 'ระบบจะคัดลอกรายชื่อบุคลากรและสิทธิ์การใช้งานจาก HIS เพื่อรองรับการเข้าสู่ระบบแบบออฟไลน์อย่างปลอดภัย',
      confirmText: 'เริ่มซิงค์ข้อมูล',
      cancelText: 'ยกเลิก',
      icon: 'question',
    });

    if (!ok) return;

    setIsSyncingUsers(true);
    try {
      const res = await fetch(apiUrl('/api/users/sync'), { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alertSuccess('ซิงค์ข้อมูลสำเร็จ', json.message);
        loadAdmin2FaList();
      } else {
        alertError('ซิงค์ข้อมูลไม่สำเร็จ', json.error);
      }
    } catch {
      alertError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSyncingUsers(false);
    }
  };

  // Enforce Administrator role
  useEffect(() => {
    if (initialized && !RBAC.canManageSettings(user?.role)) {
      router.replace('/dashboard?unauthorized=settings');
    }
  }, [initialized, user?.role, router]);

  // Load active database settings from server
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/settings/db'));
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.his) {
          setHisConfig({
            host: json.data.his.host || '',
            port: json.data.his.port || 3306,
            database: json.data.his.database || 'hos',
            user: json.data.his.user || '',
            password: json.data.his.password || '',
          });
        }
        if (json.data.mra) {
          setMraConfig({
            host: json.data.mra.host || '127.0.0.1',
            port: json.data.mra.port || 3306,
            database: json.data.mra.database || 'db_mra',
            user: json.data.mra.user || 'root',
            password: json.data.mra.password || '',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load database metadata for backup and verify live readiness
  const loadBackupInfo = useCallback(async () => {
    setIsBackupInfoLoading(true);
    setBackupInfoError(null);
    try {
      const res = await fetch(apiUrl('/api/settings/db/backup?info=true'));
      const json = await res.json();
      if (json.success && json.data) {
        setBackupInfo(json.data);
      } else {
        setBackupInfo(null);
        setBackupInfoError(json.error || 'ไม่สามารถตรวจสอบสถานะฐานข้อมูลได้');
      }
    } catch (err: any) {
      setBackupInfo(null);
      setBackupInfoError(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsBackupInfoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialized && RBAC.canManageSettings(user?.role)) {
      loadSettings();
      loadBackupInfo();
      load2FaStatus();
      loadAdmin2FaList();
    }
  }, [initialized, user?.role, loadSettings, loadBackupInfo, load2FaStatus, loadAdmin2FaList]);

  // Handler: Test HIS Connection
  const handleTestHis = async () => {
    setHisTest({ tested: false, loading: true, success: false });
    try {
      const res = await fetch(apiUrl('/api/settings/db/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'his', config: hisConfig }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setHisTest({
          tested: true,
          loading: false,
          success: true,
          latencyMs: json.data.latencyMs,
          serverVersion: json.data.serverVersion,
          hospitalCode: json.data.hospitalCode,
          hospitalName: json.data.hospitalName,
          message: json.data.message,
        });
      } else {
        setHisTest({
          tested: true,
          loading: false,
          success: false,
          message: json.error || 'การเชื่อมต่อล้มเหลว',
        });
      }
    } catch (err: any) {
      setHisTest({
        tested: true,
        loading: false,
        success: false,
        message: err.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่อทดสอบได้',
      });
    }
  };

  // Handler: Test MRA Connection
  const handleTestMra = async () => {
    setMraTest({ tested: false, loading: true, success: false });
    try {
      const res = await fetch(apiUrl('/api/settings/db/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mra', config: mraConfig }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setMraTest({
          tested: true,
          loading: false,
          success: true,
          latencyMs: json.data.latencyMs,
          serverVersion: json.data.serverVersion,
          tableCount: json.data.tableCount,
          message: json.data.message,
        });
      } else {
        setMraTest({
          tested: true,
          loading: false,
          success: false,
          message: json.error || 'การเชื่อมต่อล้มเหลว',
        });
      }
    } catch (err: any) {
      setMraTest({
        tested: true,
        loading: false,
        success: false,
        message: err.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่อทดสอบได้',
      });
    }
  };

  // Handler: Save and Real-time Hot-Reload
  const handleSave = async () => {
    // Safety check: recommend testing first if not tested
    if (!hisTest.tested || !mraTest.tested) {
      const confirmed = await alertConfirm({
        title: 'ยังไม่ได้ทดสอบครบทั้ง 2 ฐานข้อมูล',
        text: 'ขอแนะนำให้กดทดสอบการเชื่อมต่อก่อนทำการบันทึก เพื่อยืนยันว่าการตั้งค่าถูกต้อง ท่านต้องการบันทึกและปรับใช้ทันทีหรือไม่?',
        confirmText: 'บันทึกทันที',
        cancelText: 'กลับไปทดสอบก่อน',
      });
      if (!confirmed) return;
    } else {
      const confirmed = await alertConfirm({
        title: 'ยืนยันการบันทึกการเชื่อมต่อฐานข้อมูล',
        text: 'ระบบจะบันทึกการตั้งค่าลงในไฟล์การทำงาน และปรับใช้ Connection Pool ใหม่ในหน่วยความจำทันที (Hot-Reloaded) โดยไม่กระทบการทำงานอื่น',
        confirmText: 'บันทึกการเชื่อมต่อ',
        cancelText: 'ยกเลิก',
      });
      if (!confirmed) return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(apiUrl('/api/settings/db'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          his: hisConfig,
          mra: mraConfig,
        }),
      });

      const json = await res.json();
      if (json.success) {
        // Broadcast event for real-time reactivity in Footer/Login badges
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mra:his-status-refresh'));
        }
        await alertSuccess(
          'บันทึกและปรับใช้สำเร็จ',
          json.message || 'ระบบได้เชื่อมต่อฐานข้อมูลใหม่แบบ Real-Time เรียบร้อยแล้ว'
        );
        // Refresh settings and backup readiness
        loadSettings();
        loadBackupInfo();
      } else {
        await alertError('เกิดข้อผิดพลาดในการบันทึก', json.error || 'ไม่สามารถบันทึกการตั้งค่าได้');
      }
    } catch (err: any) {
      await alertError('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถติดต่อระบบได้');
    } finally {
      setIsSaving(false);
    }
  };

  // Handler: Download Standard MRA Database SQL Backup (Navicat Premium Format)
  const handleDownloadBackup = async (overrideMode?: 'structure_data' | 'structure_only') => {
    const selectedMode = overrideMode || backupMode;
    const isStructureAndData = selectedMode === 'structure_data';
    const modeLabel = isStructureAndData ? 'Structure and Data (โครงสร้าง + ข้อมูล)' : 'Structure Only (เฉพาะโครงสร้าง)';

    const confirmed = await alertConfirm({
      title: 'สำรองข้อมูล MRA',
      text: `ระบบจะสร้างไฟล์ SQL Dump มาตรฐานของฐานข้อมูล db_mra ในรูปแบบ "${modeLabel}" ซึ่งพร้อมนำเข้าในระบบจัดการฐานข้อมูลได้ทันที โดยไม่กระทบต่อฐานข้อมูลโรงพยาบาลและไม่รบกวนการทำงานหลัก`,
      confirmText: `ดาวน์โหลด ${isStructureAndData ? 'Structure & Data' : 'Structure Only'}`,
      cancelText: 'ยกเลิก',
    });
    if (!confirmed) return;

    setIsBackingUp(true);
    try {
      const res = await fetch(apiUrl(`/api/settings/db/backup?mode=${selectedMode}`));
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'ไม่สามารถสร้างไฟล์สำรองข้อมูลได้');
      }

      // Extract filename from Content-Disposition header
      const disposition = res.headers.get('content-disposition');
      let filename = isStructureAndData
        ? 'db_mra_dump_structure_and_data.sql'
        : 'db_mra_dump_structure_only.sql';
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      await alertSuccess(
        'สำรองข้อมูลสำเร็จ',
        `ดาวน์โหลดไฟล์ ${filename} (${(blob.size / 1024).toFixed(1)} KB) เรียบร้อยแล้ว`
      );
      loadBackupInfo();
    } catch (err: any) {
      await alertError('เกิดข้อผิดพลาดในการสำรองข้อมูล', err.message || 'ไม่สามารถดาวน์โหลดไฟล์ได้');
    } finally {
      setIsBackingUp(false);
    }
  };

  if (initialized && !RBAC.canManageSettings(user?.role)) {
    return (
      <div className="p-8 text-center bg-white border border-rose-200 rounded-sm">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800">ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
        <p className="text-xs text-slate-500 mt-1">เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น</p>
      </div>
    );
  }

  return (
    <div className="section-gap">
      {/* ── 1. Page Header Banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-sm border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-blue-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Settings size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-blue-950">
                ตั้งค่าระบบและการเชื่อมต่อฐานข้อมูล
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              กำหนดค่าการเชื่อมต่อฐานข้อมูล HIS และ MRA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSettings}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-sm transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            title="รีเฟรชค่าการตั้งค่า"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-950 bg-slate-100 hover:bg-slate-200 rounded-sm transition-colors w-fit shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>กลับหน้าหลัก</span>
          </Link>
        </div>
      </div>

      {/* ── 2. Dual Database Cards (HIS vs MRA) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── CARD 1: HIS Database Settings ── */}
        <Card className="border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <CardHeader className="bg-gradient-to-r from-slate-50 via-teal-50/30 to-transparent border-b border-slate-200/90 py-3.5 px-4 sm:px-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200/80 text-teal-600 flex items-center justify-center shrink-0 shadow-2xs">
                    <Hospital size={19} strokeWidth={2.2} />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-blue-950 flex items-center gap-2">
                      <span>ฐานข้อมูลโรงพยาบาล</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-xs">
                        Read-Only
                      </span>
                    </CardTitle>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ดึงข้อมูลระบบสารสนเทศโรงพยาบาล (HIS)
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-3.5">
              {/* Host & Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <span>Host / IP Address</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={hisConfig.host}
                    onChange={(e) => setHisConfig({ ...hisConfig, host: e.target.value })}
                    placeholder="เช่น 192.168.1.100 หรือ localhost"
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <span>Port</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={hisConfig.port}
                    onChange={(e) => setHisConfig({ ...hisConfig, port: e.target.value })}
                    placeholder="3306"
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>

              {/* Database Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <span>Database Name</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={hisConfig.database}
                  onChange={(e) => setHisConfig({ ...hisConfig, database: e.target.value })}
                  placeholder="เช่น hos"
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                />
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <span>Username</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={hisConfig.user}
                    onChange={(e) => setHisConfig({ ...hisConfig, user: e.target.value })}
                    placeholder="เช่น his_user หรือ root"
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <span>Password</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    {hisConfig.password && !isChangingHisPass && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingHisPass(true);
                          setHisConfig({ ...hisConfig, password: '' });
                        }}
                        className="text-[10px] text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer"
                      >
                        เปลี่ยนรหัสผ่าน
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={hisConfig.password}
                      onChange={(e) => setHisConfig({ ...hisConfig, password: e.target.value })}
                      placeholder={isChangingHisPass ? 'พิมพ์รหัสผ่านใหม่' : '•••••••••••• (คงเดิม)'}
                      className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Live Test Status Banner */}
              <div className="pt-2">
                {hisTest.loading && (
                  <div className="flex items-center gap-2 p-2.5 rounded-sm bg-sky-50 border border-sky-200 text-sky-800 text-xs">
                    <RefreshCw size={14} className="animate-spin text-sky-600 shrink-0" />
                    <span>กำลังทดสอบการเชื่อมต่อฐานข้อมูล HIS...</span>
                  </div>
                )}

                {hisTest.tested && hisTest.success && (
                  <div className="p-3 rounded-sm bg-emerald-50/90 border border-emerald-200 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>การเชื่อมต่อสำเร็จ</span>
                      </div>
                      <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-xs">
                        Latency: {hisTest.latencyMs} ms
                      </span>
                    </div>

                    {hisTest.hospitalName && (
                      <p className="text-xs text-emerald-900 font-medium leading-snug flex items-center gap-1.5 flex-wrap">
                        <Hospital size={14} className="text-emerald-700 shrink-0" />
                        <span>หน่วยบริการ:</span>
                        <strong className="font-bold">{hisTest.hospitalName}</strong>
                        {hisTest.hospitalCode && (
                          <span className="text-[11px] text-emerald-700 font-mono">
                            (HCODE: {hisTest.hospitalCode})
                          </span>
                        )}
                      </p>
                    )}

                    {hisTest.serverVersion && (
                      <p className="text-[10.5px] text-emerald-700 font-mono">
                        Server: {hisTest.serverVersion}
                      </p>
                    )}
                  </div>
                )}

                {hisTest.tested && !hisTest.success && (
                  <div className="p-3 rounded-sm bg-rose-50 border border-rose-200 text-rose-800 space-y-1 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900">
                      <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                      <span>การเชื่อมต่อล้มเหลว</span>
                    </div>
                    <p className="text-[11.5px] text-rose-700 leading-relaxed">
                      {hisTest.message}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </div>

          {/* Test Button Footer */}
          <div className="p-4 sm:p-5 pt-0 bg-white">
            <button
              type="button"
              onClick={handleTestHis}
              disabled={hisTest.loading}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-sm transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <Zap size={14} className="text-teal-600" />
              <span>{hisTest.loading ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ HIS'}</span>
            </button>
          </div>
        </Card>

        {/* ── CARD 2: MRA Database Settings ── */}
        <Card className="border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <CardHeader className="bg-gradient-to-r from-slate-50 via-sky-50/20 to-transparent border-b border-slate-200/90 py-3.5 px-4 sm:px-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200/80 text-sky-600 flex items-center justify-center shrink-0 shadow-2xs">
                    <Database size={19} strokeWidth={2.2} />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-blue-950 flex items-center gap-2">
                      <span>ฐานข้อมูลระบบ MRA</span>
                      <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded-xs">
                        Full Access
                      </span>
                    </CardTitle>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      จัดเก็บข้อมูลการประเมินคุณภาพการบันทึกเวชระเบียน (MRA)
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-3.5">
              {/* Host & Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <span>Host / IP Address</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mraConfig.host}
                    onChange={(e) => setMraConfig({ ...mraConfig, host: e.target.value })}
                    placeholder="เช่น 127.0.0.1 หรือ localhost"
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <span>Port</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={mraConfig.port}
                    onChange={(e) => setMraConfig({ ...mraConfig, port: e.target.value })}
                    placeholder="3306"
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              {/* Database Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <span>Database Name</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={mraConfig.database}
                  onChange={(e) => setMraConfig({ ...mraConfig, database: e.target.value })}
                  placeholder="เช่น db_mra"
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                />
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <span>Username</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mraConfig.user}
                    onChange={(e) => setMraConfig({ ...mraConfig, user: e.target.value })}
                    placeholder="เช่น root"
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <span>Password</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    {mraConfig.password && !isChangingMraPass && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingMraPass(true);
                          setMraConfig({ ...mraConfig, password: '' });
                        }}
                        className="text-[10px] text-sky-700 hover:text-sky-900 font-semibold underline cursor-pointer"
                      >
                        เปลี่ยนรหัสผ่าน
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={mraConfig.password}
                      onChange={(e) => setMraConfig({ ...mraConfig, password: e.target.value })}
                      placeholder={isChangingMraPass ? 'พิมพ์รหัสผ่านใหม่' : '•••••••••••• (คงเดิม)'}
                      className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Live Test Status Banner */}
              <div className="pt-2">
                {mraTest.loading && (
                  <div className="flex items-center gap-2 p-2.5 rounded-sm bg-sky-50 border border-sky-200 text-sky-800 text-xs">
                    <RefreshCw size={14} className="animate-spin text-sky-600 shrink-0" />
                    <span>กำลังทดสอบการเชื่อมต่อฐานข้อมูล MRA...</span>
                  </div>
                )}

                {mraTest.tested && mraTest.success && (
                  <div className="p-3 rounded-sm bg-emerald-50/90 border border-emerald-200 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>การเชื่อมต่อสำเร็จ</span>
                      </div>
                      <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-xs">
                        Latency: {mraTest.latencyMs} ms
                      </span>
                    </div>

                    <p className="text-xs text-emerald-900 font-medium leading-snug flex items-center gap-1.5 flex-wrap">
                      <Database size={14} className="text-emerald-700 shrink-0" />
                      <span>ตรวจพบตารางในฐานข้อมูล:</span>
                      <strong className="font-bold">{mraTest.tableCount ?? 'พบตาราง'}</strong>
                      <span>ตาราง</span>
                    </p>

                    {mraTest.serverVersion && (
                      <p className="text-[10.5px] text-emerald-700 font-mono">
                        Server: {mraTest.serverVersion}
                      </p>
                    )}
                  </div>
                )}

                {mraTest.tested && !mraTest.success && (
                  <div className="p-3 rounded-sm bg-rose-50 border border-rose-200 text-rose-800 space-y-1 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900">
                      <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                      <span>การเชื่อมต่อล้มเหลว</span>
                    </div>
                    <p className="text-[11.5px] text-rose-700 leading-relaxed">
                      {mraTest.message}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </div>

          {/* Test Button Footer */}
          <div className="p-4 sm:p-5 pt-0 bg-white">
            <button
              type="button"
              onClick={handleTestMra}
              disabled={mraTest.loading}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-sm transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <Zap size={14} className="text-sky-600" />
              <span>{mraTest.loading ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ MRA'}</span>
            </button>
          </div>
        </Card>

      </div>

      {/* ── 3. Bottom Execution Bar (Save & Apply Live) ── */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3 text-slate-600">
            <div className="w-9 h-9 rounded-sm bg-blue-50 text-blue-900 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <Server size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-blue-950 mt-1">
                อัปเดตการเชื่อมต่อแบบ Real-time
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-2xl">
                บันทึกและเริ่มใช้งานฐานข้อมูลใหม่ได้ทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-950 rounded-sm transition-colors shadow-xs cursor-pointer disabled:opacity-50 min-h-[var(--touch-min)]"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>กำลังบันทึกและปรับใช้...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>บันทึกการเชื่อมต่อ</span>
                </>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. MRA Database Backup Card (Navicat Dump SQL File Standard) ── */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 via-sky-50/30 to-blue-50/20 border-b border-slate-200/90 py-3.5 px-4 sm:px-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-gradient-to-br from-blue-700 to-indigo-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                <HardDrive size={20} strokeWidth={2.2} />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-blue-950 flex flex-wrap items-center gap-2">
                  <span>สำรองข้อมูลระบบ e-MRA</span>
                  <span className="text-[10px] font-bold text-sky-800 bg-sky-100/80 border border-sky-300 px-2 py-0.5 rounded-xs tracking-wide">
                    SQL Dump Standard
                  </span>
                </CardTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  สำรองข้อมูลระบบประเมินคุณภาพการบันทึกเวชระเบียน (Backup)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {isBackingUp ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                  <RefreshCw size={11} className="animate-spin text-blue-600" />
                  <span>กำลังสำรองข้อมูล...</span>
                </span>
              ) : isBackupInfoLoading ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>กำลังตรวจสอบ...</span>
                </span>
              ) : backupInfo ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Ready</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => loadBackupInfo()}
                  title={backupInfoError || 'ไม่สามารถติดต่อฐานข้อมูล db_mra ได้ คลิกเพื่อตรวจสอบใหม่'}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-medium transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Unavailable</span>
                </button>
              )}

              {/* Real Database Charset & Collation Badge */}
              {backupInfo?.charset && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px]"
                  title={`Collation: ${backupInfo.collation || backupInfo.charset} (ดึงค่าจริงจาก schema ฐานข้อมูล ${backupInfo.database})`}
                >
                  <span className="text-slate-400 font-sans font-semibold text-[9px] uppercase">Charset:</span>
                  <span className="font-bold text-slate-800">{backupInfo.charset}</span>
                  {backupInfo.collation && (
                    <span className="text-slate-500 font-mono text-[9px] hidden sm:inline">
                      ({backupInfo.collation})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* 1. Database Health & Metric Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-sm bg-slate-50/80 border border-slate-200/90 transition-all hover:bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ฐานข้อมูล</span>
                <Server size={14} className="text-blue-700" />
              </div>
              <div className="text-sm font-bold text-blue-950 font-mono">
                {backupInfo?.database || (isBackupInfoLoading ? 'กำลังตรวจสอบ...' : 'db_mra')}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate font-mono">
                {backupInfo
                  ? `${backupInfo.host}:${backupInfo.port || 3306} (MySQL ${backupInfo.serverVersion || '8.0'})`
                  : isBackupInfoLoading
                    ? 'กำลังตรวจสอบเซิร์ฟเวอร์...'
                    : backupInfoError
                      ? 'ไม่สามารถเชื่อมต่อได้'
                      : '127.0.0.1:3306'}
              </div>
            </div>

            <div className="p-3 rounded-sm bg-slate-50/80 border border-slate-200/90 transition-all hover:bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">โครงสร้างตาราง (DDL)</span>
                <Layers size={14} className="text-indigo-700" />
              </div>
              <div className="text-sm font-bold text-slate-900">
                {backupInfo
                  ? `${backupInfo.baseTableCount} Tables`
                  : isBackupInfoLoading
                    ? 'กำลังตรวจสอบ...'
                    : '0 Tables'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {backupInfo
                  ? `${backupInfo.viewCount} Views (Schema Complete)`
                  : isBackupInfoLoading
                    ? 'ตรวจสอบข้อมูล...'
                    : 'ไม่พบตารางข้อมูล'}
              </div>
            </div>

            <div className="p-3 rounded-sm bg-slate-50/80 border border-slate-200/90 transition-all hover:bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ระเบียนข้อมูล (DML)</span>
                <Database size={14} className="text-sky-700" />
              </div>
              <div className="text-sm font-bold text-slate-900">
                {backupInfo
                  ? `${backupInfo.totalRows.toLocaleString()} Records`
                  : isBackupInfoLoading
                    ? 'กำลังคำนวณ...'
                    : '0 Records'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Transaction Wrapped (BEGIN/COMMIT)
              </div>
            </div>

            <div className="p-3 rounded-sm bg-slate-50/80 border border-slate-200/90 transition-all hover:bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ขนาดไฟล์</span>
                <HardDrive size={14} className="text-emerald-700" />
              </div>
              <div className="text-sm font-bold text-emerald-700 font-mono">
                {backupInfo?.totalSizeFormatted || (isBackupInfoLoading ? 'กำลังคำนวณ...' : '0 MB')}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Clean SQL Text / Instant Import
              </div>
            </div>
          </div>

          {/* 2. Navicat Dump Mode Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>เลือกรูปแบบการส่งออก</span>
              </label>
              <span className="text-[11px] text-slate-500">
                เลือกรูปแบบที่ต้องการดาวน์โหลด
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1: Structure and Data */}
              <div
                onClick={() => setBackupMode('structure_data')}
                className={`p-3.5 rounded-sm border cursor-pointer transition-all ${backupMode === 'structure_data'
                  ? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${backupMode === 'structure_data'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white'
                        }`}
                    >
                      {backupMode === 'structure_data' && <Check size={10} strokeWidth={3} />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span className={backupMode === 'structure_data' ? 'text-emerald-950' : ''}>
                          Structure and Data
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-xs border transition-colors ${backupMode === 'structure_data'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                          Recommended
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block font-medium mt-0.5">
                        โครงสร้างตาราง (DDL) และข้อมูลระบบทั้งหมด (DML)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Option 2: Structure Only */}
              <div
                onClick={() => setBackupMode('structure_only')}
                className={`p-3.5 rounded-sm border cursor-pointer transition-all ${backupMode === 'structure_only'
                  ? 'border-blue-700 bg-blue-50/40 shadow-xs ring-1 ring-blue-700/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${backupMode === 'structure_only'
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-slate-300 bg-white'
                        }`}
                    >
                      {backupMode === 'structure_only' && <Check size={10} strokeWidth={3} />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <span>Structure Only</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-xs bg-slate-100 text-slate-700 border border-slate-200">
                          Schema Only
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block font-medium mt-0.5">
                        เฉพาะโครงสร้างตาราง ดัชนี และมุมมองข้อมูล (ไม่มีข้อมูลในตาราง)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Action Section */}
          <div className="pt-2 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700">หมายเหตุ:</span> การสำรองข้อมูลดำเนินการเฉพาะฐานข้อมูล{' '}
              <span className="font-mono font-semibold text-blue-900">db_mra</span> เท่านั้น{' '}
              โดยไม่ยุ่งเกี่ยวกับฐานข้อมูลโรงพยาบาล (HIS)
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadBackup(backupMode)}
                disabled={isBackingUp || isBackupInfoLoading || !backupInfo}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-950 active:bg-slate-900 rounded-sm transition-all shadow-xs cursor-pointer disabled:opacity-50 min-h-[var(--touch-min)]"
                title={!backupInfo ? 'ฐานข้อมูลไม่พร้อมสำหรับการสำรองข้อมูล' : 'คลิกเพื่อดาวน์โหลดไฟล์สำรองข้อมูล SQL Dump'}
              >
                {isBackingUp ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>กำลังส่งออกไฟล์ SQL ({backupMode === 'structure_data' ? 'Structure & Data' : 'Structure Only'})...</span>
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    <span>
                      ดาวน์โหลด SQL ({backupMode === 'structure_data' ? 'Structure & Data' : 'Structure Only'})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CARD 4: TWO-FACTOR AUTHENTICATION (MFA TOTP) ── */}
      <Card className="rounded-sm border border-slate-200/90 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200/80 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-gradient-to-br from-pink-500 to-pink-700 text-white flex items-center justify-center shadow-xs shrink-0 ring-1 ring-inset ring-pink-300/60">
                <ShieldLock size={20} strokeWidth={2.4} />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-pink-100 text-pink-700 border border-pink-200">
                    MFA
                  </span>
                  <span>การยืนยันตัวตนหลายปัจจัย</span>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-Factor Authentication <span className="text-pink-600">TOTP</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIs2FaModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 rounded-sm shadow-xs transition-all cursor-pointer"
              >
                <Smartphone size={14} />
                <span>{my2FaEnabled ? 'จัดการ MFA' : 'เปิดใช้งาน MFA'}</span>
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* My Status Banner */}
          <div className={`p-4 rounded-sm border flex items-center justify-between gap-4 ${my2FaEnabled
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
            : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${my2FaEnabled ? 'bg-emerald-500 text-white shadow-xs' : 'bg-slate-300 text-slate-700'
                }`}>
                {my2FaEnabled ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">
                    สถานะบัญชี ({user?.fullName || user?.loginname})
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-xs border ${my2FaEnabled
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}>
                    {my2FaEnabled ? 'เปิดใช้งานแล้ว' : 'ยังไม่ได้เปิดใช้งาน'}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  {my2FaEnabled
                    ? 'บัญชีของคุณจำเป็นต้องใช้รหัส OTP 6 หลักหรือรหัสสำรองทุกครั้งที่เข้าสู่ระบบ'
                    : 'แนะนำให้เปิดใช้งานเพื่อยกระดับความปลอดภัยข้อมูลเวชระเบียนผู้ป่วย'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIs2FaModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-sm shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              ตั้งค่า
            </button>
          </div>

          {/* Administrator Overview Table */}
          {RBAC.canManageSettings(user?.role) && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <UserCheck size={14} className="text-pink-600" />
                    <span>รายชื่อผู้ใช้งานที่ลงทะเบียน MFA ในระบบ e-MRA</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ตรวจสอบสถานะและรีเซ็ตกรณีเจ้าหน้าที่ทำโทรศัพท์มือถือสูญหาย
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncUsersFromHis}
                    disabled={isSyncingUsers}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-sm transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    title="คัดลอกข้อมูลผู้ใช้งานจาก HOSxP มายังฐานข้อมูลท้องถิ่น"
                  >
                    <RefreshCw size={12} className={isSyncingUsers ? 'animate-spin text-blue-700' : 'text-blue-700'} />
                    <span>{isSyncingUsers ? 'กำลังซิงค์ผู้ใช้...' : 'ซิงค์ข้อมูลผู้ใช้จาก HIS'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={loadAdmin2FaList}
                    disabled={isAdmin2FaLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-sm transition-colors cursor-pointer"
                    title="รีเฟรชรายชื่อ"
                  >
                    <RefreshCw size={12} className={isAdmin2FaLoading ? 'animate-spin' : ''} />
                    <span>รีเฟรช</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-sm overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">ชื่อผู้ใช้งาน</th>
                      <th className="py-2.5 px-3">ชื่อ-สกุล</th>
                      <th className="py-2.5 px-3 text-center">สถานะ MFA</th>
                      <th className="py-2.5 px-3 text-center">รหัสสำรองคงเหลือ</th>
                      <th className="py-2.5 px-3">วันที่เปิดใช้งาน</th>
                      <th className="py-2.5 px-3 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isAdmin2FaLoading && admin2FaUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <RefreshCw size={16} className="animate-spin inline mr-2 text-pink-600" />
                          <span>กำลังโหลดข้อมูล...</span>
                        </td>
                      </tr>
                    ) : admin2FaUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          ยังไม่มีผู้ใช้งานลงทะเบียน MFA: Multi-Factor Authentication ในระบบ
                        </td>
                      </tr>
                    ) : (
                      admin2FaUsers.map((u) => (
                        <tr key={u.loginname} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            @{u.loginname}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {u.userFullname || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block text-[9.5px] font-bold px-2 py-0.5 rounded-xs border ${u.isEnabled
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                              {u.isEnabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                            </span>
                            {u.lockedUntil && new Date(u.lockedUntil).getTime() > currentTimestamp && (
                              <span className="block text-[9px] font-bold text-rose-600 mt-0.5">
                                ถูกล็อคชั่วคราว
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                            {u.isEnabled ? `${u.backupRemaining} ชุด` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {u.enrolledAt ? new Date(u.enrolledAt).toLocaleDateString('th-TH') : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {u.isEnabled ? (
                              <button
                                type="button"
                                onClick={() => handleAdminReset2Fa(u.loginname, u.userFullname)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-sm transition-colors cursor-pointer"
                                title="รีเซ็ตและปลดล็อค MFA สำหรับผู้ใช้นี้"
                              >
                                <RotateCcw size={11} />
                                <span>รีเซ็ต MFA</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-Factor Authentication Modal */}
      <TwoFactorModal
        isOpen={is2FaModalOpen}
        onClose={() => setIs2FaModalOpen(false)}
        onStatusChange={(enabled) => {
          setMy2FaEnabled(enabled);
          loadAdmin2FaList();
        }}
      />
    </div>
  );
}
