'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  Hospital,
  BedDouble,
  Shuffle,
  ListTodo,
  BarChart3,
  Settings,
  Brain,
  LogIn,
  User,
  LogOut,
  Briefcase,
  ShieldCheck,
  Gem,
  Lock,
  PieChart,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  History,
  BookOpen,
  Smartphone,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { alertConfirm } from '@/lib/mra-alert';
import { TwoFactorModal } from '@/components/settings/TwoFactorModal';
import { apiUrl } from '@/lib/constants';

interface TopbarProps {
  onMenuOpen: () => void;
}

interface PageMeta {
  title: string;
  sub?: string;      // section badge label
  badge?: string;    // OPD & ER | IPD | etc.
  badgeColor?: string;
  icon?: React.ReactNode;
}

function getPageMeta(pathname: string): PageMeta {
  if (pathname === '/sampling') {
    return {
      title: 'สุ่มตรวจเวชระเบียน',
      badge: 'OPD & ER',
      badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
      icon: <Shuffle size={14} />,
    };
  }
  if (pathname === '/' || pathname === '/opd-table') {
    return {
      title: 'ตรวจประเมินคุณภาพ',
      badge: 'OPD & ER',
      badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
      icon: <ListTodo size={14} />,
    };
  }
  if (pathname === '/ipd/sampling') {
    return {
      title: 'สุ่มตรวจเวชระเบียน',
      badge: 'IPD',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <Shuffle size={14} />,
    };
  }
  if (pathname === '/ipd') {
    return {
      title: 'ตรวจประเมินคุณภาพ',
      badge: 'IPD',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <ListTodo size={14} />,
    };
  }
  if (pathname === '/psychiatric') {
    return {
      title: 'ตรวจประเมินคุณภาพ',
      badge: 'จิตเวช',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <Brain size={14} />,
    };
  }
  if (pathname === '/dashboard') {
    return {
      title: 'ภาพรวมระบบ',
      badge: 'Dashboards',
      badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
      icon: <PieChart size={14} />,
    };
  }
  if (pathname === '/reports') {
    return {
      title: 'รายงานและสถิติ',
      badge: 'Overview',
      badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
      icon: <BarChart3 size={14} />,
    };
  }
  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return {
      title: 'ตั้งค่าระบบ',
      badge: 'Configuration',
      badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
      icon: <Settings size={14} />,
    };
  }
  if (pathname === '/audit-logs' || pathname.startsWith('/audit-logs/')) {
    return {
      title: 'ประวัติการใช้งานระบบ',
      badge: 'Audit Logs',
      badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
      icon: <History size={14} />,
    };
  }
  if (pathname === '/manual' || pathname.startsWith('/manual/')) {
    return {
      title: 'คู่มือมาตรฐาน',
      badge: 'Manual',
      badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
      icon: <BookOpen size={14} />,
    };
  }
  return { title: 'MRA System' };
}

export function Topbar({ onMenuOpen }: TopbarProps) {
  const pathname = usePathname();
  const meta = getPageMeta(pathname);
  const { user, securityKey, logout } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSecurityKey, setShowSecurityKey] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [activeKey, setActiveKey] = useState<string>(securityKey || 'mra@admin2026');
  const [is2FaModalOpen, setIs2FaModalOpen] = useState(false);
  const [is2FaActive, setIs2FaActive] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync security key & 2FA status from store or fetch latest
  useEffect(() => {
    if (isDropdownOpen) {
      if (!securityKey) {
        fetch(apiUrl('/api/auth/me'))
          .then((res) => res.json())
          .then((json) => {
            if (json.securityKey) {
              setActiveKey(json.securityKey);
            }
          })
          .catch(() => { });
      }
      // Fetch 2FA status
      fetch(apiUrl('/api/auth/2fa/status'))
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setIs2FaActive(json.isEnabled);
          }
        })
        .catch(() => { });
    } else if (securityKey) {
      setActiveKey(securityKey);
    }
  }, [isDropdownOpen, securityKey]);

  const handleCopySecurityKey = async () => {
    try {
      await navigator.clipboard.writeText(activeKey);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Listen for trigger from Sidebar to toggle profile info dropdown
  useEffect(() => {
    const handleToggle = () => {
      setIsDropdownOpen((prev) => !prev);
    };
    const handleOpen = () => {
      setIsDropdownOpen(true);
    };

    window.addEventListener('mra:toggle-profile-dropdown', handleToggle);
    window.addEventListener('mra:open-profile-dropdown', handleOpen);

    return () => {
      window.removeEventListener('mra:toggle-profile-dropdown', handleToggle);
      window.removeEventListener('mra:open-profile-dropdown', handleOpen);
    };
  }, []);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    const ok = await alertConfirm({
      title: 'ออกจากระบบ?',
      text: 'คุณต้องการออกจากระบบหรือไม่?',
      confirmText: 'ออกจากระบบ',
      cancelText: 'ยกเลิก',
      icon: 'question',
    });
    if (ok) logout();
  };

  return (
    <header
      className={`h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs relative transition-[z-index] ${
        isDropdownOpen ? 'z-[60]' : 'z-30'
      }`}
      role="banner"
    >
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="เปิดเมนูนำทาง"
          aria-expanded={false}
          aria-controls="sidebar-drawer"
          className="lg:hidden p-2 -ml-1 rounded-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 min-h-[var(--touch-min)] min-w-[var(--touch-min)] flex items-center justify-center"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-sm font-bold text-blue-900 shrink-0 hidden sm:inline">
            e-MRA
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>

          {/* Section badge */}
          {meta.badge && (
            <span
              className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border ${meta.badgeColor}`}
            >
              {meta.icon}
              {meta.badge}
            </span>
          )}

          {/* Page title */}
          <span
            className="text-sm font-semibold text-slate-900 truncate"
            aria-current="page"
          >
            {meta.title}
          </span>
        </nav>
      </div>

      {/* Right: user info toggle / login button */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-2 sm:ml-4">
        {user ? (
          <div className="flex items-center gap-2">
            <div className={`relative ${isDropdownOpen ? 'z-[70]' : ''}`} ref={dropdownRef}>
              {/* Topbar Avatar Icon Button Only (Clean, Minimalist, Responsive) */}
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
                aria-label="ข้อมูลผู้ใช้งานและเมนู"
                title={`${user.fullName} | ${user.positionName || user.roleDescription} (${user.role})`}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-sm bg-gradient-to-br from-pink-500 to-pink-700 text-white flex items-center justify-center shrink-0 select-none shadow-xs ring-2 ring-pink-200/90 hover:ring-pink-400 hover:shadow-md transition-all active:scale-95 cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 group"
              >
                <User className="w-5 h-5 sm:w-[22px] sm:h-[22px]" strokeWidth={2.2} />

                {/* Sparkling Diamond Circle Badge (มุมขวาบน พร้อมเหลือบสีชมพูมุมซ้ายและแสงเงาตกกระทบสมจริง) */}
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-gradient-to-r from-pink-400 via-sky-500 to-blue-700 ring-1.5 ring-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.35),0_0_8px_rgba(56,189,248,0.7),-2px_0_6px_rgba(244,114,182,0.55),inset_0_1px_1px_rgba(255,255,255,0.9)] flex items-center justify-center overflow-hidden z-10 group-hover:scale-105 transition-transform"
                  title="สถานะผู้ใช้งานออนไลน์ (สิทธิ์ระดับสูง)"
                >
                  {/* Subtle pink ambient reflection on left corner */}
                  <span className="absolute -left-0.5 top-0 bottom-0 w-1.5 bg-gradient-to-r from-pink-400/70 to-transparent pointer-events-none z-10" />

                  {/* Realistic diagonal specular glint */}
                  <span className="absolute -inset-1 bg-gradient-to-tr from-transparent via-white/60 to-transparent -rotate-45 animate-[pulse_1.8s_ease-in-out_infinite] pointer-events-none" />
                  <Gem
                    size={9}
                    strokeWidth={2.4}
                    className="text-white fill-cyan-100/25 relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] sm:w-[10px] sm:h-[10px]"
                  />
                </span>
              </button>

              {/* Dropdown Info Toggle Menu */}
              {isDropdownOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-sm shadow-2xl border border-slate-200/90 py-3 px-3.5 z-[70] animate-in fade-in zoom-in-95 duration-150 select-none"
                >
                  {/* 1. Header: Avatar + Full Name + Role Badge + Loginname */}
                  <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                    <div className="w-11 h-11 rounded-sm bg-gradient-to-br from-pink-500 to-pink-700 text-white flex items-center justify-center shrink-0 shadow-xs ring-2 ring-pink-200 relative">
                      <User className="w-6 h-6" strokeWidth={2.2} />
                      {/* Sparkling Diamond Circle Badge (มุมขวาบน พร้อมเหลือบสีชมพูมุมซ้ายและแสงเงาตกกระทบสมจริง) */}
                      <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-gradient-to-r from-pink-400 via-sky-500 to-blue-700 ring-1.5 ring-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.35),0_0_8px_rgba(56,189,248,0.7),-2px_0_6px_rgba(244,114,182,0.55),inset_0_1px_1px_rgba(255,255,255,0.9)] flex items-center justify-center overflow-hidden z-10">
                        {/* Subtle pink ambient reflection on left corner */}
                        <span className="absolute -left-0.5 top-0 bottom-0 w-1.5 bg-gradient-to-r from-pink-400/70 to-transparent pointer-events-none z-10" />

                        <span className="absolute -inset-1 bg-gradient-to-tr from-transparent via-white/60 to-transparent -rotate-45 animate-[pulse_1.8s_ease-in-out_infinite] pointer-events-none" />
                        <Gem
                          size={10}
                          strokeWidth={2.4}
                          className="text-white fill-cyan-100/25 relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
                        />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h3 className="text-sm font-bold text-slate-900 truncate" title={user.fullName}>
                          {user.fullName}
                        </h3>
                        <span
                          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shrink-0 shadow-2xs ${user.role === 'Administrator'
                            ? 'bg-sky-50 text-sky-700 border border-sky-300'
                            : user.role === 'Auditor'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}
                        >
                          {user.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono flex items-center gap-1 truncate">
                        <span>@{user.loginname}</span>
                        {user.doctorCode && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 font-mono text-[11px]">ID: {user.doctorCode}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* 2. Detailed User Information (Large Pink Icons Covering Key & Value without fill color) */}
                  <div className="py-2.5 space-y-2 text-xs">
                    {/* ตำแหน่งงาน */}
                    <div className="flex items-center gap-3 text-slate-700 bg-slate-50/80 hover:bg-slate-50 p-2 sm:p-2.5 rounded-sm border border-slate-100 transition-colors">
                      <div className="w-7 sm:w-8 flex items-center justify-center shrink-0 text-pink-600">
                        <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider leading-none mb-1">
                          ตำแหน่ง
                        </span>
                        <span className="font-semibold text-slate-800 break-words leading-tight text-xs block">
                          {user.positionName || user.roleDescription || 'เจ้าหน้าที่'}
                        </span>
                      </div>
                    </div>

                    {/* โรงพยาบาล / หน่วยบริการ */}
                    <div className="flex items-center gap-3 text-slate-700 bg-slate-50/80 hover:bg-slate-50 p-2 sm:p-2.5 rounded-sm border border-slate-100 transition-colors">
                      <div className="w-7 sm:w-8 flex items-center justify-center shrink-0 text-pink-600">
                        <Hospital className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider leading-none mb-1">
                          หน่วยบริการ
                        </span>
                        <span className="font-medium text-slate-700 leading-tight text-xs block">
                          โรงพยาบาลกมลาไสย
                        </span>
                      </div>
                    </div>

                    {/* สิทธิ์การใช้งานระบบ */}
                    <div className="flex items-center gap-3 text-slate-700 bg-slate-50/80 hover:bg-slate-50 p-2 sm:p-2.5 rounded-sm border border-slate-100 transition-colors">
                      <div className="w-7 sm:w-8 flex items-center justify-center shrink-0 text-pink-600">
                        <Lock className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider leading-none mb-1">
                          สิทธิ์การใช้งาน
                        </span>
                        <span className="font-medium text-slate-700 break-words leading-tight text-xs block">
                          {user.roleDescription}
                        </span>
                      </div>
                    </div>

                    {/* Security Key (รหัสความปลอดภัย) */}
                    <div className="flex items-center gap-3 text-slate-700 bg-slate-50/80 hover:bg-slate-50 p-2 sm:p-2.5 rounded-sm border border-slate-100 transition-colors">
                      <div className="w-7 sm:w-8 flex items-center justify-center shrink-0 text-pink-600">
                        <KeyRound className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider leading-none mb-1">
                          Security Key
                        </span>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="font-mono text-xs font-semibold text-slate-800 tracking-wider truncate select-all">
                            {showSecurityKey ? activeKey : '••••••••••••'}
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowSecurityKey((prev) => !prev);
                              }}
                              className="p-1 rounded-xs text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                              title={showSecurityKey ? 'ซ่อน Security Key' : 'แสดง Security Key'}
                              aria-label={showSecurityKey ? 'ซ่อน Security Key' : 'แสดง Security Key'}
                            >
                              {showSecurityKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            {showSecurityKey && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopySecurityKey();
                                }}
                                className="p-1 rounded-xs text-slate-400 hover:text-blue-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                                title="คัดลอก Security Key"
                                aria-label="คัดลอก Security Key"
                              >
                                {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* การยืนยันตัวตนหลายปัจจัย (MFA: Multi-Factor Authentication) */}
                    <div
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIs2FaModalOpen(true);
                      }}
                      className="flex items-center gap-3 text-slate-700 bg-slate-50/80 hover:bg-pink-50/50 hover:border-pink-200 p-2 sm:p-2.5 rounded-sm border border-slate-100 transition-all cursor-pointer group"
                      title="คลิกเพื่อจัดการการยืนยันตัวตนหลายปัจจัย (MFA: Multi-Factor Authentication)"
                    >
                      <div className="w-7 sm:w-8 flex items-center justify-center shrink-0 text-pink-600 group-hover:scale-110 transition-transform">
                        <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider leading-none mb-1">
                          MFA - การยืนยันตัวตนหลายปัจจัย
                        </span>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="font-semibold text-slate-800 text-xs">
                            Multi-Factor Authentication
                          </span>
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-xs border tracking-tight ${is2FaActive
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-200 text-slate-600 border-slate-300'
                              }`}
                          >
                            {is2FaActive ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Actions / Logout */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-sm transition-colors cursor-pointer shadow-2xs group"
                    >
                      <LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Logout Icon Button next to User Avatar (ไว้เหมือนเดิม) */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-10 h-10 sm:w-10 sm:h-10 rounded-sm flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors shadow-2xs cursor-pointer shrink-0"
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4 sm:w-[16px] sm:h-[16px]" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold text-white bg-blue-900 hover:bg-blue-950 transition-colors shadow-xs"
          >
            <LogIn size={13} />
            <span>เข้าสู่ระบบ</span>
          </Link>
        )}
      </div>

      {/* Two-Factor Authentication Management Modal */}
      <TwoFactorModal
        isOpen={is2FaModalOpen}
        onClose={() => setIs2FaModalOpen(false)}
        onStatusChange={(enabled) => setIs2FaActive(enabled)}
      />
    </header>
  );
}
