'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Server,
  Zap,
  Lock,
  X,
  Layers,
  Sparkles,
  MonitorCog,
} from 'lucide-react';
import { alertConfirm, alertSuccess, alertError, alertWarning } from '@/lib/mra-alert';
import { apiUrl } from '@/lib/constants';

export interface DatabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

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

export function DatabaseConnectionModal({ isOpen, onClose, onSaved }: DatabaseConnectionModalProps) {
  const [adminKey, setAdminKey] = useState('mra@admin2026');
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Connection form state
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

  // Password change states (strictly never reveal plaintext password)
  const [isChangingHisPass, setIsChangingHisPass] = useState(false);
  const [isChangingMraPass, setIsChangingMraPass] = useState(false);

  // Test connection feedback
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

  // Load current settings using admin key
  const loadSettingsWithKey = useCallback(async (keyToUse: string) => {
    setIsLoadingSettings(true);
    try {
      const res = await fetch(apiUrl(`/api/settings/db?adminKey=${encodeURIComponent(keyToUse)}`), {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setIsUnlocked(true);
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
      } else {
        setIsUnlocked(false);
      }
    } catch {
      setIsUnlocked(false);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  // When modal opens, auto-attempt loading with default/stored key
  useEffect(() => {
    if (isOpen) {
      loadSettingsWithKey(adminKey);
    }
  }, [isOpen, loadSettingsWithKey, adminKey]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Test HIS Connection
  const handleTestHis = async () => {
    if (!adminKey.trim()) {
      await alertWarning('ต้องระบุรหัสความปลอดภัย', 'กรุณาระบุ Admin Security Key เพื่อทดสอบการเชื่อมต่อ');
      return;
    }

    setHisTest({ tested: false, loading: true, success: false });
    try {
      const res = await fetch(apiUrl('/api/settings/db/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'his',
          config: hisConfig,
          adminKey: adminKey.trim(),
        }),
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
          message: json.error || 'การเชื่อมต่อ HIS ล้มเหลว',
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

  // Test MRA Connection
  const handleTestMra = async () => {
    if (!adminKey.trim()) {
      await alertWarning('ต้องระบุรหัสความปลอดภัย', 'กรุณาระบุ Admin Security Key เพื่อทดสอบการเชื่อมต่อ');
      return;
    }

    setMraTest({ tested: false, loading: true, success: false });
    try {
      const res = await fetch(apiUrl('/api/settings/db/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'mra',
          config: mraConfig,
          adminKey: adminKey.trim(),
        }),
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
          message: json.error || 'การเชื่อมต่อ MRA ล้มเหลว',
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

  // Save Settings & Hot-Reload Pools
  const handleSave = async () => {
    if (!adminKey.trim()) {
      await alertWarning('ต้องระบุรหัสความปลอดภัย', 'กรุณาระบุ Security Key เพื่อบันทึกการตั้งค่า');
      return;
    }

    // Recommendation if tests haven't been run
    if (!hisTest.tested || !mraTest.tested) {
      const confirmed = await alertConfirm({
        title: 'ยังไม่ได้ทดสอบการเชื่อมต่อ',
        text: 'ขอแนะนำให้กดทดสอบการเชื่อมต่อก่อนทำการบันทึก เพื่อยืนยันว่า Host/IP และรหัสผ่านถูกต้อง ท่านต้องการบันทึกและปรับใช้ทันทีหรือไม่?',
        confirmText: 'บันทึกทันที',
        cancelText: 'กลับไปทดสอบก่อน',
      });
      if (!confirmed) return;
    } else {
      const confirmed = await alertConfirm({
        title: 'ยืนยันการบันทึกการตั้งค่าฐานข้อมูล',
        text: 'ระบบจะบันทึกการตั้งค่าและทำการ Hot-Reload Connection Pool ในหน่วยความจำทันทีเพื่อให้ระบบพร้อมใช้งานโดยไม่ต้อง Restart',
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
          adminKey: adminKey.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        // Trigger event so HisStatusBadge updates instantly across the app!
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mra:his-status-refresh'));
        }

        await alertSuccess(
          'บันทึกและปรับใช้สำเร็จ',
          json.message || 'ระบบได้เชื่อมต่อฐานข้อมูลใหม่แบบ Real-Time เรียบร้อยแล้ว พร้อมเข้าใช้งานระบบทันที'
        );

        if (onSaved) onSaved();
        onClose();
      } else {
        await alertError('เกิดข้อผิดพลาดในการบันทึก', json.error || 'ไม่สามารถบันทึกการตั้งค่าได้');
      }
    } catch (err: any) {
      await alertError('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถติดต่อระบบได้');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="db-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-4xl bg-white rounded-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header (Matches Login Card Header Standard) ── */}
        <div className="relative flex items-center justify-between px-5 py-3.5 bg-blue-950 text-white shrink-0 border-b border-blue-900/80">
          {/* Top accent gradient line matching Login card header */}
          <div className="absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r from-blue-900 via-blue-950 to-transparent" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-blue-900/60 border border-blue-800/80 text-blue-200 flex items-center justify-center shrink-0">
              <MonitorCog size={24} />
            </div>
            <div>
              <h2 id="db-modal-title" className="text-sm sm:text-base font-bold text-white tracking-wide">
                ตั้งค่าการเชื่อมต่อฐานข้อมูล
              </h2>
              <p className="text-[11px] text-blue-200/80">
                ตั้งค่าการเชื่อมต่อฐานข้อมูล HIS และ MRA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-1.5 rounded-sm text-blue-300 hover:text-white hover:bg-blue-900/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Modal Body (Scrollable) ── */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-700">
          {/* Admin Security Key Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0 text-blue-900">
                <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-800 block leading-tight">
                  การรักษาความปลอดภัย (Security Key)
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  ต้องระบุรหัสความปลอดภัยผู้ดูแลระบบเพื่อตั้งค่าฐานข้อมูล
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <input
                  type={showAdminKey ? 'text' : 'password'}
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="รหัสผ่าน Admin Key"
                  className="w-48 sm:w-56 px-2.5 py-1.5 pr-8 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAdminKey((prev) => !prev);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer z-10"
                  title={showAdminKey ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-label={showAdminKey ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showAdminKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => loadSettingsWithKey(adminKey)}
                disabled={isLoadingSettings}
                className="px-2.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-medium rounded-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isLoadingSettings ? 'กำลังโหลด...' : isUnlocked ? 'โหลดใหม่' : 'ปลดล็อก'}
              </button>
            </div>
          </div>

          {/* Database Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ── CARD 1: HIS Database (Hospital HIS - Teal Color) ── */}
            <div className="bg-white border-2 border-teal-500/70 rounded-sm shadow-xs overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-3 bg-teal-50/80 border-b border-teal-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-sm bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Hospital size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-teal-950">
                      ฐานข้อมูลโรงพยาบาล HIS
                    </h3>
                    <p className="text-[10px] text-teal-700">
                      ดึงข้อมูลระบบสารสนเทศโรงพยาบาล
                    </p>
                  </div>
                </div>
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-xs bg-teal-100/90 text-teal-800 border border-teal-300">
                  Read-Only
                </span>
              </div>

              {/* Form Content */}
              <div className="p-3.5 space-y-2.5 text-xs flex-1">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Host IP / Domain <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={hisConfig.host}
                      onChange={(e) => setHisConfig({ ...hisConfig, host: e.target.value })}
                      placeholder="เช่น 192.168.1.100 หรือ localhost"
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Port <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={hisConfig.port}
                      onChange={(e) => setHisConfig({ ...hisConfig, port: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Database Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={hisConfig.database}
                    onChange={(e) => setHisConfig({ ...hisConfig, database: e.target.value })}
                    placeholder="เช่น hos"
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={hisConfig.user}
                      onChange={(e) => setHisConfig({ ...hisConfig, user: e.target.value })}
                      placeholder="เช่น his_user หรือ root"
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Password
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
                          เปลี่ยนรหัส
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={hisConfig.password}
                        onChange={(e) => setHisConfig({ ...hisConfig, password: e.target.value })}
                        placeholder={isChangingHisPass ? 'พิมพ์รหัสผ่านใหม่' : '•••••••••••• (คงเดิม)'}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Test Feedback Box */}
                {hisTest.tested && (
                  <div
                    className={`p-2.5 rounded-xs border text-[11px] leading-relaxed transition-all ${hisTest.success
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-800'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-0.5">
                      {hisTest.success ? (
                        <>
                          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                          <span>เชื่อมต่อ HIS สำเร็จ</span>
                          {hisTest.latencyMs !== undefined && (
                            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/80 px-1 py-0.2 rounded-xs ml-auto">
                              {hisTest.latencyMs} ms
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                          <span>เชื่อมต่อ HIS ไม่สำเร็จ</span>
                        </>
                      )}
                    </div>
                    {hisTest.hospitalName && (
                      <p className="text-[10.5px] text-emerald-800 font-medium">
                        {hisTest.hospitalName} {hisTest.hospitalCode ? `(${hisTest.hospitalCode})` : ''}
                      </p>
                    )}
                    {hisTest.serverVersion && (
                      <p className="text-[10px] text-slate-500 font-mono">
                        {hisTest.serverVersion}
                      </p>
                    )}
                    {hisTest.message && !hisTest.success && (
                      <p className="text-[10.5px] text-rose-700 mt-0.5">{hisTest.message}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 mt-auto">
                <button
                  type="button"
                  onClick={handleTestHis}
                  disabled={hisTest.loading}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {hisTest.loading ? (
                    <RefreshCw size={12} className="animate-spin shrink-0" />
                  ) : (
                    <Zap size={12} className="shrink-0" />
                  )}
                  <span>{hisTest.loading ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
                </button>
              </div>
            </div>

            {/* ── CARD 2: MRA Database (Localhost - Sky/Blue Color) ── */}
            <div className="bg-white border-2 border-sky-500/70 rounded-sm shadow-xs overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-3 bg-sky-50/80 border-b border-sky-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-sm bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Database size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-sky-950">
                      ฐานข้อมูลระบบประเมิน MRA
                    </h3>
                    <p className="text-[10px] text-sky-700">
                      จัดเก็บข้อมูลการประเมินคุณภาพการบันทึกเวชระเบียน
                    </p>
                  </div>
                </div>
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-xs bg-sky-100/90 text-sky-800 border border-sky-300">
                  Full Access
                </span>
              </div>

              {/* Form Content */}
              <div className="p-3.5 space-y-2.5 text-xs flex-1">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Host IP / Domain <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={mraConfig.host}
                      onChange={(e) => setMraConfig({ ...mraConfig, host: e.target.value })}
                      placeholder="127.0.0.1"
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Port <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={mraConfig.port}
                      onChange={(e) => setMraConfig({ ...mraConfig, port: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Database Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mraConfig.database}
                    onChange={(e) => setMraConfig({ ...mraConfig, database: e.target.value })}
                    placeholder="db_mra"
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={mraConfig.user}
                      onChange={(e) => setMraConfig({ ...mraConfig, user: e.target.value })}
                      placeholder="root"
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Password
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
                          เปลี่ยนรหัส
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={mraConfig.password}
                        onChange={(e) => setMraConfig({ ...mraConfig, password: e.target.value })}
                        placeholder={isChangingMraPass ? 'พิมพ์รหัสผ่านใหม่' : '•••••••••••• (คงเดิม)'}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xs focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Test Feedback Box */}
                {mraTest.tested && (
                  <div
                    className={`p-2.5 rounded-xs border text-[11px] leading-relaxed transition-all ${mraTest.success
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-800'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-0.5">
                      {mraTest.success ? (
                        <>
                          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                          <span>เชื่อมต่อ MRA สำเร็จ</span>
                          {mraTest.latencyMs !== undefined && (
                            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/80 px-1 py-0.2 rounded-xs ml-auto">
                              {mraTest.latencyMs} ms
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                          <span>เชื่อมต่อ MRA ไม่สำเร็จ</span>
                        </>
                      )}
                    </div>
                    {mraTest.tableCount !== undefined && (
                      <p className="text-[10.5px] text-emerald-800 font-medium">
                        พบตารางระบบ {mraTest.tableCount} ตาราง
                      </p>
                    )}
                    {mraTest.serverVersion && (
                      <p className="text-[10px] text-slate-500 font-mono">
                        {mraTest.serverVersion}
                      </p>
                    )}
                    {mraTest.message && !mraTest.success && (
                      <p className="text-[10.5px] text-rose-700 mt-0.5">{mraTest.message}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 mt-auto">
                <button
                  type="button"
                  onClick={handleTestMra}
                  disabled={mraTest.loading}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs rounded-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {mraTest.loading ? (
                    <RefreshCw size={12} className="animate-spin shrink-0" />
                  ) : (
                    <Zap size={12} className="shrink-0" />
                  )}
                  <span>{mraTest.loading ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Modal Footer (Right-aligned Action Buttons) ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xs shadow-2xs hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
          >
            ปิด
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>กำลังบันทึกและปรับใช้...</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>บันทึกการเชื่อมต่อ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DatabaseConnectionModal;
