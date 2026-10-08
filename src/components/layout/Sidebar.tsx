'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { alertConfirm } from '@/lib/mra-alert';
import {
  Brain,
  BarChart3,
  Settings,
  LogOut,
  SquareCheckBig,
  X,
  Shuffle,
  ListTodo,
  Hospital,
  BedDouble,
  LogIn,
  User,
  ListOrdered,
  LayoutDashboard,
  BarChart2,
  BarChart4,
  TrendingUp,
  PieChart,
  Gem,
  History,
  BookOpen,
  BookMarked,
  ShieldCheck,
  Logs,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { RBAC } from '@/lib/rbac';

interface NavItem {
  name: string;
  badge?: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  disabled?: boolean;
}

interface NavGroup {
  label: string;
  labelIcon: React.ComponentType<{ size?: number; className?: string }>;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'ภาพรวมระบบ',
    labelIcon: BarChart3,
    items: [
      { name: 'Dashboards', href: '/dashboard', icon: PieChart },
      { name: 'รายงานและสถิติ', href: '/reports', icon: LayoutDashboard },
    ],
  },
  {
    label: 'ผู้ป่วยนอก (OPD/ER)',
    labelIcon: Hospital,
    items: [
      { name: 'สุ่มตรวจเวชระเบียน', href: '/sampling', icon: Shuffle },
      { name: 'ตรวจประเมินคุณภาพ', href: '/', icon: ListTodo },
    ],
  },
  {
    label: 'ผู้ป่วยใน (IPD)',
    labelIcon: BedDouble,
    items: [
      { name: 'สุ่มตรวจเวชระเบียน', href: '/ipd/sampling', icon: Shuffle },
      { name: 'ตรวจประเมินคุณภาพ', href: '/ipd', icon: ListTodo },
    ],
  },
  {
    label: 'Psychiatric Care',
    labelIcon: ListOrdered,
    items: [
      { name: 'ผู้ป่วยจิตเวช', href: '/psychiatric', icon: Brain },
    ],
  },
  {
    label: 'Audit Logs',
    labelIcon: Logs,
    items: [
      { name: 'ประวัติการใช้งานระบบ', href: '/audit-logs', icon: History },
    ],
  },
  {
    label: 'User Manual',
    labelIcon: BookMarked,
    items: [
      { name: 'คู่มือมาตรฐาน', href: '/manual', icon: BookOpen },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Inner nav content — shared between desktop aside and mobile drawer ──
function NavContent({ onClose, pathname }: { onClose: () => void; pathname: string }) {
  const { user, logout } = useAuthStore();

  const isActive = (href: string, disabled?: boolean) => {
    if (disabled || href === '#') return false;
    if (href === '/') return pathname === '/' || pathname === '/opd-table';
    if (href === '/ipd') return pathname === '/ipd';
    return pathname.startsWith(href);
  };

  const handleNavClick = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose();
  };

  const handleToggleProfileDropdown = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mra:toggle-profile-dropdown'));
    }
    onClose();
  };

  const activeLinkClass =
    'flex items-center gap-3 px-3.5 rounded-sm text-sm font-semibold transition-colors min-h-[var(--touch-min)] bg-pink-600 text-white shadow-xs';

  const normalLinkClass =
    'flex items-center gap-3 px-3.5 rounded-sm text-sm font-medium transition-colors min-h-[var(--touch-min)] text-blue-100 hover:bg-blue-900 hover:text-white';

  const disabledLinkClass =
    'flex items-center gap-3 px-3.5 rounded-sm text-sm font-medium min-h-[var(--touch-min)] text-blue-900/50 cursor-not-allowed select-none';

  return (
    <div className="flex flex-col h-full">
      {/* Brand header */}
      <div className="h-16 sm:h-20 px-4 sm:px-5 flex items-center gap-3.5 border-b border-blue-900/80 shrink-0 relative bg-gradient-to-b from-white/[0.03] to-transparent">
        {/* top accent gradient line */}
        <div className="absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r from-pink-400 via-pink-500 to-transparent" />

        <Link href="/dashboard" onClick={handleNavClick} className="flex items-center gap-3.5 flex-1 min-w-0">
          {/* Icon Container (Animated Jewel effect) */}
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-md bg-gradient-to-br from-pink-500 via-pink-600 to-pink-800 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-inset ring-pink-300/60">
            {/* Animated diagonal glossy shine */}
            <div className="absolute -inset-1 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-90 animate-[pulse_2s_ease-in-out_infinite]" />

            <SquareCheckBig className="text-white w-5 h-5 sm:w-6 sm:h-6 relative z-10" strokeWidth={2.5} />
          </div>

          {/* Text */}
          <div className="flex flex-col flex-1 min-w-0 justify-center">
            <span className="font-extrabold text-[21px] sm:text-[20px] leading-none tracking-tight truncate flex items-center gap-1">
              <span className="bg-gradient-to-r from-pink-400 to-white bg-clip-text text-transparent">
                e-MR
              </span>
              <span className="text-white font-bold">Audit</span>
            </span>
            <span className="text-[10px] sm:text-[11px] text-white/90 truncate font-medium tracking-[0.1em] mt-1.5">
              คุณภาพเวชระเบียน
            </span>
          </div>
        </Link>

        {/* Close button — mobile drawer only */}
        <button
          type="button"
          onClick={handleNavClick}
          aria-label="ปิดเมนู"
          className="lg:hidden p-1.5 rounded-sm text-blue-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 p-3 overflow-y-auto" aria-label="เมนูหลัก">
        {navGroups.map((group) => {
          const LabelIcon = group.labelIcon;
          return (
            <div key={group.label} className="mb-2">
              {/* Group label */}
              <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold text-blue-300 uppercase tracking-wider select-none flex items-center gap-1.5">
                <LabelIcon size={12} />
                {group.label}
              </p>

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href, item.disabled);
                  const Icon = item.icon;

                  if (item.disabled) {
                    return (
                      <span
                        key={item.name}
                        title="ยังไม่เปิดใช้งาน"
                        className={`${disabledLinkClass} justify-between`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon size={18} className="text-blue-900/40 shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded tracking-wide bg-blue-950 text-blue-900/40 border border-blue-900/30 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </span>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavClick}
                      aria-current={active ? 'page' : undefined}
                      className={`${active ? activeLinkClass : normalLinkClass} justify-between group/nav`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon size={18} className={active ? 'text-white' : 'text-blue-300 group-hover/nav:text-white transition-colors shrink-0'} />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded tracking-wide shrink-0 transition-colors ${active
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-900/70 text-blue-300 border border-blue-800/80 group-hover/nav:border-pink-500/50 group-hover/nav:text-pink-200'
                            }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom: settings & User/Logout */}
      <div className="p-3 border-t border-blue-900 space-y-2 shrink-0 bg-blue-950/60">
        {RBAC.canManageSettings(user?.role) && (
          <Link
            href="/settings"
            onClick={handleNavClick}
            aria-current={pathname === '/settings' ? 'page' : undefined}
            className={pathname === '/settings' ? activeLinkClass : normalLinkClass}
          >
            <Settings size={18} className={pathname === '/settings' ? 'text-white' : 'text-blue-300'} />
            <span>ตั้งค่าระบบ</span>
          </Link>
        )}

        {user ? (
          <div className="p-2.5 rounded-sm bg-white/5 border border-white/10 space-y-2">
            {/* Clickable User Info Header (triggers Topbar Profile Dropdown) */}
            <div
              role="button"
              tabIndex={0}
              onClick={handleToggleProfileDropdown}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleProfileDropdown();
                }
              }}
              aria-label="แสดงข้อมูลผู้ใช้งานบนแถบด้านบน"
              title="คลิกเพื่อแสดงข้อมูลผู้ใช้งานและรหัสความปลอดภัย (Security Key) บนแถบด้านบน"
              className="flex items-center gap-2.5 min-w-0 cursor-pointer group focus:outline-none focus:ring-0 focus-visible:outline-none rounded-sm select-none"
            >
              <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-pink-500 to-pink-700 text-white flex items-center justify-center shrink-0 shadow-xs ring-1 ring-inset ring-pink-300/40 group-hover:ring-pink-200 transition-all">
                <User size={18} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-xs font-bold text-white truncate group-hover:text-pink-100 transition-colors" title={user.fullName}>
                  {user.fullName}
                </div>
                <div
                  className="text-[11px] text-blue-200 truncate mt-0.5 font-medium"
                  title={`ตำแหน่ง: ${user.positionName || user.roleDescription}`}
                >
                  {user.positionName || user.roleDescription}
                </div>
              </div>

              {/* Sparkling Diamond Circle Badge (Badge สีฟ้าเพชรชัดเจน เปล่งประกายเหลือบชมพูเมื่อสะท้อนแสง ขยาย +1px เฉพาะ Sidebar) */}
              <div className="shrink-0 flex items-center justify-center pl-1.5">
                <span
                  className="w-[28px] h-[28px] rounded-full bg-gradient-to-br from-cyan-300 via-sky-500 to-blue-700 border-[1.5px] border-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.4),0_0_12px_rgba(56,189,248,0.6),inset_0_1px_1.5px_rgba(255,255,255,0.8)] flex items-center justify-center overflow-hidden relative group-hover:scale-105 transition-all duration-200 select-none"
                  title="สถานะผู้ใช้งานออนไลน์ (สิทธิ์ระดับสูง)"
                >
                  {/* Subtle diamond ice-cyan ambient reflection on left corner */}
                  <span className="absolute -left-0.5 top-0 bottom-0 w-2.5 bg-gradient-to-r from-cyan-200/80 to-transparent pointer-events-none z-10" />

                  {/* Natural Diamond Scintillation Sparkle (ประกายแสงเพชรระยิบระยับ แบบสมูทกลมกลืน ไร้ริ้วคลื่น) */}
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_32%,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.65)_18%,rgba(244,114,182,0.45)_36%,transparent_70%)] animate-diamond-sparkle pointer-events-none" />

                  {/* Crisp High-Carat Diamond Icon */}
                  <Gem
                    size={16.5}
                    strokeWidth={2.4}
                    className="text-white fill-cyan-100/30 relative z-10 drop-shadow-[0_1.5px_2.5px_rgba(0,0,0,0.85)]"
                  />
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
              <span
                className={`text-[9.5px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider ${user.role === 'Administrator'
                  ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40'
                  : user.role === 'Auditor'
                    ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                    : 'bg-slate-500/25 text-slate-200 border border-slate-400/40'
                  }`}
              >
                {user.role}
              </span>

              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  handleNavClick();
                  const ok = await alertConfirm({
                    title: 'ออกจากระบบ?',
                    text: 'คุณต้องการออกจากระบบหรือไม่?',
                    confirmText: 'ออกจากระบบ',
                    cancelText: 'ยกเลิก',
                    icon: 'question',
                  });
                  if (ok) logout();
                }}
                className="text-[11px] font-medium text-rose-300 hover:text-white flex items-center gap-1 p-1 hover:bg-rose-500/20 rounded-sm transition-colors cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut size={12} />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        ) : (
          <Link
            href="/login"
            onClick={handleNavClick}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-sm text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white shadow-xs transition-colors"
          >
            <LogIn size={14} />
            <span>เข้าสู่ระบบ</span>
          </Link>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop: permanent static sidebar ── */}
      <aside
        className="hidden lg:flex w-64 bg-blue-950 text-white flex-col shrink-0 border-r border-blue-900 select-none"
        aria-label="Sidebar navigation"
      >
        <NavContent onClose={() => { }} pathname={pathname} />
      </aside>

      {/* ── Mobile: overlay drawer ── */}
      {/* Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel with inert when closed */}
      <aside
        className={`sidebar-drawer lg:hidden bg-blue-950 text-white select-none ${isOpen ? 'is-open' : ''}`}
        aria-label="Sidebar navigation"
        inert={!isOpen ? true : undefined}
      >
        <NavContent onClose={onClose} pathname={pathname} />
      </aside>
    </>
  );
}
