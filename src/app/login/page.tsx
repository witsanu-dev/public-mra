'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  SquareCheckBig,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Terminal,
  X,
  Download,
  BookOpen,
  FileText,
  Database,
  Smartphone,
  KeyRound,
  ArrowLeft,
  ShieldCheck,
  UserLock,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { alertInput, alertSuccess } from '@/lib/mra-alert';
import { APP_VERSION, APP_YEAR, apiUrl, assetUrl, BASE_PATH, DEVELOPER_NAME, DEVELOPER_POSITION, DEVELOPER_ORGANIZATION } from '@/lib/constants';
import { HisStatusBadge } from '@/components/ui/HisStatusBadge';
import { DatabaseConnectionModal } from '@/components/settings/DatabaseConnectionModal';
import { EulaModal } from '@/components/mra/EulaModal';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isEulaModalOpen, setIsEulaModalOpen] = useState(false);

  // MFA state
  const [authStep, setAuthStep] = useState<'credentials' | '2fa'>('credentials');
  const [tempToken, setTempToken] = useState<string>('');
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [otpCode, setOtpCode] = useState<string>('');
  const [isBackupMode, setIsBackupMode] = useState<boolean>(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Focus OTP input when transitioning to MFA step
  useEffect(() => {
    if (authStep === '2fa') {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    }
  }, [authStep, isBackupMode]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
        setIsLoading(false);
        return;
      }

      // Check if user requires Step 2 (Google Authenticator MFA)
      if (data.require2FA) {
        setTempToken(data.tempToken);
        setPendingUser(data.user);
        setAuthStep('2fa');
        setOtpCode('');
        setIsBackupMode(false);
        setIsLoading(false);
        return;
      }

      // Standard login success without MFA
      proceedLoginSuccess(data.user);
    } catch (err) {
      console.error(err);
      setErrorMsg('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
      setIsLoading(false);
    }
  };

  const handle2FaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.trim();
    if (!cleanCode) {
      setErrorMsg(isBackupMode ? 'กรุณากรอกรหัสสำรอง' : 'กรุณากรอกรหัส OTP 6 หลัก');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(apiUrl('/api/auth/login/2fa'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempToken,
          code: cleanCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'รหัสยืนยันไม่ถูกต้อง');
        setIsLoading(false);
        return;
      }

      proceedLoginSuccess(data.user);
    } catch (err) {
      console.error(err);
      setErrorMsg('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
      setIsLoading(false);
    }
  };

  const proceedLoginSuccess = (userData: any) => {
    setSuccessMsg(`ยินดีต้อนรับ ${userData?.fullName || userData?.loginname}`);
    setUser(userData);

    // Smooth transition to destination or executive reports dashboard
    let targetPath = `${BASE_PATH}/dashboard`;
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const cb = searchParams.get('callbackUrl');
      if (cb && cb.startsWith('/') && !cb.startsWith('//')) {
        targetPath = cb.startsWith(BASE_PATH) ? cb : `${BASE_PATH}${cb}`;
      }
    }

    setTimeout(() => {
      window.location.href = targetPath;
    }, 450);
  };

  const handleBackToCredentials = () => {
    setAuthStep('credentials');
    setTempToken('');
    setPendingUser(null);
    setOtpCode('');
    setIsBackupMode(false);
    setErrorMsg('');
  };

  const handleDownloadManual = async () => {
    const defaultName = 'คู่มือการประเมินคุณภาพการบันทึกเวชระเบียน_สปสช.pdf';
    const inputFilename = await alertInput({
      title: 'ดาวน์โหลดคู่มือเวชระเบียน สปสช.',
      placeholder: 'ตั้งชื่อไฟล์ PDF ที่ต้องการบันทึก...',
      defaultValue: defaultName,
      confirmText: 'ดาวน์โหลด',
    });

    if (inputFilename === null) return;

    let finalName = inputFilename.trim() || defaultName;
    if (!finalName.toLowerCase().endsWith('.pdf')) {
      finalName += '.pdf';
    }

    const downloadUrl = apiUrl(`/api/docs/manual?filename=${encodeURIComponent(finalName)}`);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alertSuccess('เริ่มดาวน์โหลดไฟล์แล้ว', finalName);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200/80 relative overflow-hidden select-none">
      {/* Decorative ambient background accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-400/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-sm border border-slate-200/90 shadow-2xl shadow-blue-950/15 overflow-hidden">

          {/* ── Brand Header Card (Sidebar Identity with Dark Background) ── */}
          <div className="relative px-6 py-5 bg-blue-950 text-white flex items-center gap-3.5 border-b border-blue-900/80 shrink-0">
            {/* Top accent gradient line (enhanced thickness and modern glow) */}
            <div className="absolute top-0 left-0 right-0 h-[3.5px] bg-gradient-to-r from-pink-400 via-pink-500 to-transparent" />

            {/* Animated Jewel Icon (Identical to Sidebar) */}
            <div className="relative w-11 h-11 rounded-md bg-gradient-to-br from-pink-500 via-pink-600 to-pink-800 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-inset ring-pink-300/60 shadow-lg shadow-pink-500/25">
              <div className="absolute -inset-1 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-90 animate-[pulse_2s_ease-in-out_infinite]" />
              <SquareCheckBig className="text-white w-6 h-6 relative z-10" strokeWidth={2.5} />
            </div>

            {/* Brand Title (Identical to Sidebar) */}
            <div className="flex flex-col flex-1 min-w-0 justify-center">
              <span className="font-extrabold text-[22px] leading-none tracking-tight flex items-center gap-1.5 truncate">
                <span className="bg-gradient-to-r from-pink-400 to-pink-100 bg-clip-text text-transparent">
                  e-MR
                </span>
                <span className="text-white uppercase font-bold text-xs">Medical Record</span>
                <span className="text-white font-bold">Audit</span>
              </span>
              <span className="text-[11px] text-white/90 truncate font-medium tracking-[0.08em] mt-1.5">
                ระบบประเมินคุณภาพการบันทึกเวชระเบียน
              </span>
            </div>
          </div>

          {/* ── Form Section ── */}
          {authStep === 'credentials' ? (
            /* STEP 1: Standard Username & Password */
            <form onSubmit={handleCredentialsSubmit} className="p-6 sm:p-7 space-y-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div>
                  <h2 className="text-sm font-bold text-pink-600">เข้าสู่ระบบ e-MRA</h2>
                  <p className="text-xs text-slate-500 mt-0.5">กรุณากรอกชื่อผู้ใช้งานและรหัสผ่านเพื่อเข้าใช้งาน</p>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <img
                    src={assetUrl('/moph-logo.png')}
                    alt="รพ.กมลาไสย"
                    className="w-8 h-8 object-contain rounded-xs drop-shadow-2xs"
                  />
                  <span className="text-[9.5px] font-bold text-slate-600 tracking-tight mt-0.5 whitespace-nowrap">
                    รพ.กมลาไสย
                  </span>
                </div>
              </div>

              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-sm text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-600 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-sm text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-600 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 active:scale-[0.99] text-white text-xs font-bold rounded-sm shadow-md shadow-pink-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>กำลังตรวจสอบข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    <span>เข้าสู่ระบบ</span>
                  </>
                )}
              </button>

              {/* Alert Notifications */}
              {errorMsg && (
                <div className="p-2.5 rounded-sm bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle size={16} className="shrink-0 text-rose-600" />
                    <span className="font-medium truncate">{errorMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMsg('')}
                    className="p-1 text-rose-400 hover:text-rose-700 hover:bg-rose-100 rounded-sm transition-colors cursor-pointer shrink-0"
                    aria-label="ปิดการแจ้งเตือน"
                    title="ปิด"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    <span className="font-medium truncate">{successMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuccessMsg('')}
                    className="p-1 text-emerald-400 hover:text-emerald-700 hover:bg-emerald-100 rounded-sm transition-colors cursor-pointer shrink-0"
                    aria-label="ปิดการแจ้งเตือน"
                    title="ปิด"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Note & MRA Logo Banner inside Card */}
              <div className="pt-2 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-[11px] text-blue-950 font-semibold leading-relaxed px-1">
                  มาตรฐานตามคู่มือการประเมินคุณภาพการบันทึกเวชระเบียน สปสช.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadManual}
                  title="คลิกเพื่อดาวน์โหลดคู่มือการประเมินคุณภาพการบันทึกเวชระเบียน สปสช. (PDF)"
                  aria-label="ดาวน์โหลดคู่มือการประเมินคุณภาพการบันทึกเวชระเบียน สปสช."
                  className="group relative cursor-pointer block rounded-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  <img
                    src={assetUrl('/logo-mra.png')}
                    alt="โลโก้คู่มือ MRA - คลิกเพื่อดาวน์โหลด"
                    className="w-full max-w-[310px] h-auto object-contain rounded-sm drop-shadow-2xs group-hover:brightness-105 transition-all"
                  />
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: Multi-Factor Authentication (MFA TOTP / Backup Code) */
            <form onSubmit={handle2FaSubmit} className="p-6 sm:p-7 space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* User Identity Pill & Back Navigation */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-pink-600 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>เปลี่ยนบัญชี</span>
                </button>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-pink-50 text-pink-700 border border-pink-200 rounded-sm text-xs font-semibold">
                  <UserLock size={13} className="text-pink-600 font-sem" />
                  <span>MFA ป้องกันการเข้าสู่ระบบโดยไม่ได้รับอนุญาต</span>
                </div>
              </div>

              {/* User Avatar & Info Highlight */}
              <div className="text-center pt-1 pb-1">
                <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-pink-500 to-pink-700 text-white flex items-center justify-center shadow-md shadow-pink-500/20 ring-4 ring-pink-100 mb-2">
                  <Smartphone size={22} strokeWidth={2.2} />
                </div>
                <h2 className="text-sm font-bold text-slate-900">
                  {isBackupMode ? 'ยืนยันด้วยรหัสสำรอง' : 'ยืนยันรหัสความปลอดภัย MFA'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  <strong className="text-slate-800">{pendingUser?.fullName || pendingUser?.loginname}</strong> @{pendingUser?.loginname}
                </p>
                <p className="text-[11.5px] text-slate-400 mt-0.5">
                  {isBackupMode
                    ? 'กรอกรหัสกู้คืนสำรอง 8 ตัวอักษร เช่น EMRA-2026'
                    : 'กรอกรหัส 6 หลักจากแอปพลิเคชัน Google Authenticator'}
                </p>
              </div>

              {/* Code Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block text-center">
                  {isBackupMode ? 'รหัสกู้คืนสำรอง (Backup Code)' : 'รหัส OTP 6 หลัก'}
                </label>
                <div className="relative max-w-[280px] mx-auto">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {isBackupMode ? <KeyRound size={16} /> : <Smartphone size={16} />}
                  </div>
                  <input
                    ref={otpInputRef}
                    type="text"
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    value={otpCode}
                    maxLength={isBackupMode ? 9 : 6}
                    onChange={(e) => {
                      const val = isBackupMode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '');
                      setOtpCode(val);
                    }}
                    placeholder={isBackupMode ? 'XXXX-XXXX' : '••••••'}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-sm text-center font-mono text-base font-black tracking-[0.25em] text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-600 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 active:scale-[0.99] text-white text-xs font-bold rounded-sm shadow-md shadow-pink-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>กำลังตรวจสอบรหัสความปลอดภัย...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    <span>ยืนยันเพื่อเข้าสู่ระบบ</span>
                  </>
                )}
              </button>

              {/* Toggle between OTP and Backup Code */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsBackupMode(!isBackupMode);
                    setOtpCode('');
                    setErrorMsg('');
                  }}
                  className="text-xs font-medium text-pink-600 hover:text-pink-700 hover:underline transition-colors cursor-pointer"
                >
                  {isBackupMode
                    ? 'สลับไปใช้รหัสจาก Google Authenticator'
                    : 'อุปกรณ์สูญหาย? ใช้รหัสกู้คืนสำรอง (Backup Code)'}
                </button>
              </div>

              {/* Alert Notifications */}
              {errorMsg && (
                <div className="p-2.5 rounded-sm bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle size={16} className="shrink-0 text-rose-600" />
                    <span className="font-medium truncate">{errorMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMsg('')}
                    className="p-1 text-rose-400 hover:text-rose-700 hover:bg-rose-100 rounded-sm transition-colors cursor-pointer shrink-0"
                    aria-label="ปิดการแจ้งเตือน"
                    title="ปิด"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    <span className="font-medium truncate">{successMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuccessMsg('')}
                    className="p-1 text-emerald-400 hover:text-emerald-700 hover:bg-emerald-100 rounded-sm transition-colors cursor-pointer shrink-0"
                    aria-label="ปิดการแจ้งเตือน"
                    title="ปิด"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Cancel Button */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  ยกเลิกและกลับไปหน้าล็อกอิน
                </button>
              </div>
            </form>
          )}

          {/* ── Footer Card ── */}
          <div className="px-6 py-4 bg-white border-t border-slate-200/80 text-center">
            {/* Header: Icon Terminal (thick, sky blue fill gradient) + DEVELOPMENT BY */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-slate-700">
              <div className="w-5 h-5 rounded-sm bg-gradient-to-br from-sky-500 via-sky-600 to-sky-700 text-white flex items-center justify-center shadow-xs shrink-0 ring-1 ring-inset ring-sky-300/50">
                <Terminal size={12} strokeWidth={3.5} />
              </div>
              <span className="bg-gradient-to-r from-sky-700 to-slate-800 bg-clip-text text-transparent font-black">
                DEVELOPMENT BY
              </span>
            </div>

            {/* Developer Details */}
            <p className="text-xs font-semibold text-slate-800 mt-1.5 leading-snug">
              {DEVELOPER_NAME} <span className="text-slate-300 mx-1">|</span> {DEVELOPER_POSITION}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              {DEVELOPER_ORGANIZATION}
            </p>

            {/* License Agreement & EULA Button */}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setIsEulaModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 hover:bg-slate-100 text-[10.5px] font-semibold text-slate-700 hover:text-blue-900 border border-slate-200 transition-all cursor-pointer group shadow-2xs"
              >
                <ShieldCheck size={12} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>ข้อตกลงและสัญญาอนุญาต (License Agreement)</span>
              </button>
            </div>

            {/* Divider */}
            <hr className="my-2.5 border-slate-200" />

            {/* Copyright & Version & HIS Connection Badge */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                © {APP_YEAR} • VERSION {APP_VERSION}
              </span>

              <div className="inline-flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => setIsDbModalOpen(true)}
                  title="ตั้งค่าการเชื่อมต่อฐานข้อมูล HIS และ MRA"
                  aria-label="ตั้งค่าการเชื่อมต่อฐานข้อมูล"
                  className="inline-flex items-center justify-center px-1.5 rounded-xs bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-500 hover:text-slate-800 border border-slate-200/90 shadow-2xs transition-all cursor-pointer group"
                >
                  <Database size={10} className="group-hover:text-blue-900 transition-colors" />
                </button>
                <HisStatusBadge />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Floating Manual Widget at Bottom Right (Zero Impact on Login Form) ── */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button
          type="button"
          onClick={handleDownloadManual}
          title="คลิกเพื่อดาวน์โหลดคู่มือการประเมินคุณภาพการบันทึกเวชระเบียน สปสช. (PDF)"
          aria-label="ดาวน์โหลดคู่มือการประเมินคุณภาพการบันทึกเวชระเบียน สปสช."
          className="group relative cursor-pointer block bg-white/95 backdrop-blur-sm border border-slate-200/90 hover:border-pink-300 rounded-sm p-1.5 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 active:scale-95 text-center focus:outline-none focus:ring-2 focus:ring-pink-500/50"
        >
          {/* Top-right Floating Badge */}
          <div className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-xs bg-gradient-to-r from-pink-500 to-pink-600 text-white text-[9.5px] font-black shadow-md tracking-wider uppercase flex items-center gap-0.5 z-20 pointer-events-none ring-1.5 ring-white">
            <FileText size={9} strokeWidth={2.5} /> PDF
          </div>

          {/* Manual Cover Image Preview */}
          <div className="relative overflow-hidden rounded-sm border border-slate-100 bg-slate-50 w-20 sm:w-24 shadow-2xs">
            <img
              src={assetUrl('/manual.png')}
              alt="คู่มือการประเมินคุณภาพการบันทึกเวชระเบียน สปสช."
              className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {/* Hover Download Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1 z-10">
              <span className="text-[9px] font-bold text-white flex items-center gap-1 drop-shadow-sm">
                <Download size={10} strokeWidth={2.5} /> ดาวน์โหลด
              </span>
            </div>
          </div>

          {/* Label below cover */}
          <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold text-slate-700 group-hover:text-pink-600 transition-colors">
            <BookOpen size={11} strokeWidth={2.75} className="text-pink-500 shrink-0" />
            <span>คู่มือการประเมิน</span>
          </div>
        </button>
      </div>

      {/* ── Emergency Database Connection Modal (Pre-Login) ── */}
      <DatabaseConnectionModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
      />

      {/* ── Software License Agreement Modal (EULA) ── */}
      <EulaModal
        isOpen={isEulaModalOpen}
        onClose={() => setIsEulaModalOpen(false)}
      />
    </div>
  );
}
