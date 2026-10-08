'use client';

import { apiUrl } from '@/lib/constants';
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  KeyRound,
  Check,
  Copy,
  Download,
  AlertTriangle,
  X,
  RefreshCw,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldOff,
  ShieldUser,
  ShieldLock,
} from 'lucide-react';
import { alertConfirm, alertSuccess, alertError } from '@/lib/mra-alert';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (isEnabled: boolean) => void;
}

export function TwoFactorModal({ isOpen, onClose, onStatusChange }: TwoFactorModalProps) {
  const [loading, setLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState(0);

  // Setup wizard state: 'status' | 'setup_qr' | 'backup_codes' | 'disable_confirm'
  const [wizardStep, setWizardStep] = useState<'status' | 'setup_qr' | 'backup_codes' | 'disable_confirm'>('status');

  // Setup data
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [secretKey, setSecretKey] = useState<string>('');
  const [otpVerifyInput, setOtpVerifyInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string>('');
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState<string[]>([]);
  const [isCopiedSecret, setIsCopiedSecret] = useState(false);
  const [isCopiedBackup, setIsCopiedBackup] = useState(false);
  const [showBackupWarning, setShowBackupWarning] = useState(true);

  // Disable confirmation state
  const [disableMethod, setDisableMethod] = useState<'otp' | 'password'>('otp');
  const [disableInput, setDisableInput] = useState<string>('');
  const [showDisablePass, setShowDisablePass] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState('');

  // Fetch current MFA status when modal opens
  const fetchStatus = async () => {
    setLoading(true);
    setVerifyError('');
    setDisableError('');
    setShowBackupWarning(true);
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/status'));
      const data = await res.json();
      if (res.ok && data.success) {
        setIsEnabled(data.isEnabled);
        setEnrolledAt(data.enrolledAt);
        setBackupCodesRemaining(data.backupCodesRemaining);
        setWizardStep('status');
        if (onStatusChange) onStatusChange(data.isEnabled);
      }
    } catch (err) {
      console.error('[Fetch MFA status error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  // Start enrollment wizard
  const handleStartSetup = async () => {
    setLoading(true);
    setVerifyError('');
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/setup'), { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alertError('ไม่สามารถเริ่มการลงทะเบียนได้', data.error || 'กรุณาลองใหม่อีกครั้ง');
        return;
      }

      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecretKey(data.secret);
      setOtpVerifyInput('');
      setWizardStep('setup_qr');
    } catch (err) {
      console.error('[Start setup error]:', err);
      alertError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  // Confirm OTP to activate MFA
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = otpVerifyInput.trim().replace(/\s+/g, '');
    if (!cleanToken || cleanToken.length !== 6) {
      setVerifyError('กรุณากรอกรหัส OTP 6 หลัก');
      return;
    }

    setIsVerifying(true);
    setVerifyError('');

    try {
      const res = await fetch(apiUrl('/api/auth/2fa/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setVerifyError(data.error || 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        setIsVerifying(false);
        return;
      }

      // MFA successfully activated! Show backup codes
      setIsEnabled(true);
      setGeneratedBackupCodes(data.backupCodes || []);
      setBackupCodesRemaining(data.backupCodes?.length || 8);
      setShowBackupWarning(true);
      setWizardStep('backup_codes');
      if (onStatusChange) onStatusChange(true);
    } catch (err) {
      console.error('[Confirm OTP error]:', err);
      setVerifyError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsVerifying(false);
    }
  };

  // Disable MFA
  const handleDisable2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disableInput.trim()) {
      setDisableError(disableMethod === 'otp' ? 'กรุณากรอกรหัส OTP' : 'กรุณากรอกรหัสผ่าน');
      return;
    }

    setIsDisabling(true);
    setDisableError('');

    try {
      const payload = disableMethod === 'otp' ? { code: disableInput.trim() } : { password: disableInput.trim() };
      const res = await fetch(apiUrl('/api/auth/2fa/disable'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setDisableError(data.error || 'การยืนยันไม่ถูกต้อง ไม่สามารถปิดใช้งานได้');
        setIsDisabling(false);
        return;
      }

      alertSuccess('ปิดใช้งานสำเร็จ', 'การยืนยันตัวตนหลายปัจจัย (MFA) ถูกปิดใช้งานแล้ว');
      setIsEnabled(false);
      setDisableInput('');
      setWizardStep('status');
      if (onStatusChange) onStatusChange(false);
    } catch (err) {
      console.error('[Disable MFA error]:', err);
      setDisableError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsDisabling(false);
    }
  };

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secretKey);
      setIsCopiedSecret(true);
      setTimeout(() => setIsCopiedSecret(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyBackupCodes = async () => {
    try {
      const text = `รหัสกู้คืนสำรอง e-MRA (Backup Recovery Codes):\n${generatedBackupCodes.join('\n')}\n* เก็บรักษารหัสนี้ไว้ในที่ปลอดภัย แต่ละรหัสใช้งานได้เพียงครั้งเดียว`;
      await navigator.clipboard.writeText(text);
      setIsCopiedBackup(true);
      setTimeout(() => setIsCopiedBackup(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadBackupCodes = () => {
    const text = `รหัสกู้คืนสำรอง e-MRA (Backup Recovery Codes)\nวันที่ออกรหัส: ${new Date().toLocaleString('th-TH')}\n----------------------------------------\n${generatedBackupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n----------------------------------------\n* เก็บรักษารหัสนี้ไว้ในที่ปลอดภัย แต่ละรหัสใช้งานได้เพียงครั้งเดียวหากโทรศัพท์มือถือสูญหาย\n`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `e-MRA-Backup-Codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-sm border border-slate-200 shadow-2xl w-full max-w-[480px] overflow-hidden animate-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-pink-500 to-pink-700 text-white flex items-center justify-center shadow-xs">
              <ShieldLock size={18} strokeWidth={2.4} />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">
                MFA - การยืนยันตัวตนหลายปัจจัย
              </h3>
              <p className="text-[11px] text-slate-300">Multi-Factor Authentication (RFC 6238 TOTP)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500">
              <RefreshCw size={24} className="animate-spin text-pink-600" />
              <span className="text-xs font-medium">กำลังตรวจสอบข้อมูลสถานะความปลอดภัย...</span>
            </div>
          ) : wizardStep === 'status' ? (
            /* 1. Status Overview */
            <div className="space-y-4">
              <div
                className={`p-4 rounded-sm border flex items-start gap-3.5 ${isEnabled
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
              >
                <div
                  className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${isEnabled
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-slate-300 text-slate-700'
                    }`}
                >
                  {isEnabled ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold">
                      {isEnabled ? 'เปิดใช้งาน MFA แล้ว' : 'ยังไม่ได้เปิดใช้งาน MFA'}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase ${isEnabled
                        ? 'bg-emerald-200/70 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                        }`}
                    >
                      {isEnabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {isEnabled
                      ? 'บัญชีนี้จะได้รับการป้องกันด้วยรหัส OTP 6 หลัก ทุกครั้งที่มีการเข้าสู่ระบบ'
                      : 'เพิ่มความปลอดภัยให้กับบัญชีของคุณ ด้วยการขอรหัส 6 หลักจากแอปพลิเคชัน Google Authenticator ทุกครั้งที่เข้าสู่ระบบ'}
                  </p>

                  {isEnabled && (
                    <div className="mt-3 pt-2.5 border-t border-emerald-200/70 text-[11px] space-y-1 text-slate-700">
                      {enrolledAt && (
                        <div>
                          <span className="font-semibold">วันที่เปิดใช้งาน:</span>{' '}
                          {new Date(enrolledAt).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold">รหัสสำรองที่เหลืออยู่:</span>{' '}
                        <span className="font-bold text-emerald-700">{backupCodesRemaining} ชุด</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                {isEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDisableMethod('otp');
                      setDisableInput('');
                      setDisableError('');
                      setWizardStep('disable_confirm');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-sm transition-colors cursor-pointer"
                  >
                    <ShieldOff size={14} />
                    <span>ปิดใช้งาน MFA</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartSetup}
                    className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 shadow-md shadow-pink-600/25 rounded-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>เริ่มต้นตั้งค่า MFA</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          ) : wizardStep === 'setup_qr' ? (
            /* 2. Setup Wizard: Scan QR Code & Enter 1st OTP */
            <form onSubmit={handleConfirmOtp} className="space-y-4">
              <div className="text-center space-y-1">
                <span className="text-[11px] font-bold text-pink-600 uppercase tracking-wider">
                  ขั้นตอนที่ 1 จาก 2
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  สแกน QR Code ด้วย <a href="https://support.google.com/accounts/answer/1066447?hl=th&co=GENIE.Platform%3DAndroid" target="_blank" rel="noopener noreferrer" className="text-pink-600 underline">Google Authenticator</a>
                </h4>
                <p className="text-xs text-slate-500">
                  เปิดแอป Google Authenticator บนโทรศัพท์มือถือ แล้วแตะปุ่ม <span className="text-pink-600 text-[14px] font-bold">+</span> เพื่อสแกน QR Code นี้
                </p>
              </div>

              {/* QR Code Container */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm flex flex-col items-center justify-center">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="MFA QR Code"
                    className="w-44 h-44 bg-white p-2 rounded-xs border border-slate-200 shadow-2xs object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 bg-slate-100 flex items-center justify-center text-slate-400">
                    <RefreshCw className="animate-spin" size={24} />
                  </div>
                )}

                {/* Secret Key Text for Manual Entry */}
                <div className="mt-3 w-full bg-white border border-slate-200 p-2 rounded-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                      หรือพิมพ์รหัสกุญแจความลับ
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800 tracking-wider truncate block select-all">
                      {secretKey}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="p-1.5 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-xs transition-colors shrink-0 cursor-pointer"
                    title="คัดลอกรหัสกุญแจ"
                  >
                    {isCopiedSecret ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Step 2: Confirm OTP */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 block text-center">
                  กรอกรหัส 6 หลักจากแอป เพื่อเปิดใช้งาน
                </label>
                <div className="relative max-w-[220px] mx-auto">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Smartphone size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    value={otpVerifyInput}
                    onChange={(e) => setOtpVerifyInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-sm text-center font-mono text-base font-bold tracking-[0.25em] text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-600 transition-all"
                  />
                </div>
              </div>

              {verifyError && (
                <div className="p-2.5 rounded-sm bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                  <span>{verifyError}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep('status')}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || otpVerifyInput.length !== 6}
                  className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 shadow-md shadow-pink-600/25 rounded-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>กำลังยืนยัน...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>ยืนยันและเปิดใช้งาน</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : wizardStep === 'backup_codes' ? (
            /* 3. Setup Wizard: Backup Recovery Codes Display */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                  <Check size={22} strokeWidth={3} />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  เปิดใช้งาน MFA สำเร็จแล้ว
                </h4>
                <p className="text-xs text-slate-500">
                  กรุณาบันทึกรหัสกู้คืนสำรอง (Backup Codes) เหล่านี้ไว้ในที่ปลอดภัย
                </p>
              </div>

              {/* Backup Codes Grid */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {generatedBackupCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 bg-white border border-slate-200 rounded-xs text-center font-mono text-xs font-bold text-slate-800 tracking-wider shadow-2xs select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyBackupCodes}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-sm shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isCopiedBackup ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{isCopiedBackup ? 'คัดลอกแล้ว' : 'คัดลอกรหัสทั้งหมด'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadBackupCodes}
                    className="px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-sm shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>ดาวน์โหลดไฟล์ .txt</span>
                  </button>
                </div>
              </div>

              {showBackupWarning && (
                <div className="p-2.5 rounded-sm bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed flex items-start justify-between gap-2 animate-in fade-in duration-150 shadow-2xs">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                    <div className="leading-snug">
                      <strong className="font-bold text-amber-900">หมายเหตุ</strong> แต่ละรหัสสามารถใช้งานเพื่อล็อกอินได้เพียงครั้งเดียว
                      หากคุณทำโทรศัพท์มือถือสูญหาย สามารถใช้รหัสนี้เข้าสู่ระบบได้
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBackupWarning(false)}
                    className="p-1 text-amber-500 hover:text-amber-800 hover:bg-amber-100 rounded-xs transition-colors cursor-pointer shrink-0"
                    aria-label="ปิดการแจ้งเตือนคำเตือน"
                    title="ปิดการแจ้งเตือน"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Finish button */}
              <div className="pt-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setWizardStep('status');
                    fetchStatus();
                  }}
                  className="w-full py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-sm transition-colors cursor-pointer text-center"
                >
                  เสร็จสิ้นและรับทราบ
                </button>
              </div>
            </div>
          ) : (
            /* 4. Disable MFA Confirmation Modal */
            <form onSubmit={handleDisable2Fa} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-1">
                  <ShieldOff size={20} />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  ยืนยันการปิดใช้งาน MFA
                </h4>
                <p className="text-xs text-slate-500">
                  เพื่อความปลอดภัย กรุณายืนยันตัวตนด้วยรหัส OTP หรือรหัสผ่านปัจจุบัน
                </p>
              </div>

              {/* Method switch tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setDisableMethod('otp');
                    setDisableInput('');
                    setDisableError('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold border-b-2 text-center transition-colors cursor-pointer ${disableMethod === 'otp'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                  ใช้รหัส OTP (6 หลัก)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDisableMethod('password');
                    setDisableInput('');
                    setDisableError('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold border-b-2 text-center transition-colors cursor-pointer ${disableMethod === 'password'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                  ใช้รหัสผ่าน (Password)
                </button>
              </div>

              {/* Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  {disableMethod === 'otp' ? 'รหัส OTP 6 หลัก' : 'รหัสผ่านปัจจุบัน'}
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {disableMethod === 'otp' ? <Smartphone size={16} /> : <Lock size={16} />}
                  </div>
                  <input
                    type={disableMethod === 'password' && !showDisablePass ? 'password' : 'text'}
                    required
                    autoFocus
                    value={disableInput}
                    maxLength={disableMethod === 'otp' ? 6 : 50}
                    onChange={(e) => {
                      const v = disableMethod === 'otp' ? e.target.value.replace(/\D/g, '') : e.target.value;
                      setDisableInput(v);
                    }}
                    placeholder={disableMethod === 'otp' ? '••••••' : 'กรอกรหัสผ่าน...'}
                    className={`w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-sm text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all ${disableMethod === 'otp' ? 'text-center font-mono tracking-widest text-sm' : ''
                      }`}
                  />
                  {disableMethod === 'password' && (
                    <button
                      type="button"
                      onClick={() => setShowDisablePass(!showDisablePass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showDisablePass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
              </div>

              {disableError && (
                <div className="p-2.5 rounded-sm bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                  <span>{disableError}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep('status')}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isDisabling || !disableInput.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/25 rounded-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDisabling ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>กำลังปิดใช้งาน...</span>
                    </>
                  ) : (
                    <>
                      <ShieldOff size={14} />
                      <span>ยืนยันปิดใช้งาน MFA</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
