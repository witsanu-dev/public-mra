'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiUrl } from '@/lib/constants';

export interface HisStatusData {
  connected: boolean;
  latencyMs?: number;
  hospitalCode?: string;
  hospitalName?: string;
  error?: string;
}

export function HisStatusBadge({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [hospitalInfo, setHospitalInfo] = useState<{ code?: string; name?: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isCheckingRef = useRef(false);

  const checkStatus = useCallback(async (manual = false) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    if (manual) setIsRefreshing(true);

    try {
      // Append cache buster to guarantee real-time probing
      const res = await fetch(apiUrl(`/api/his/status?_t=${Date.now()}`), {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache' },
      });
      const data = await res.json();

      if (data?.connected) {
        setStatus('connected');
        setLatencyMs(typeof data.latencyMs === 'number' ? data.latencyMs : null);
        if (data.hospitalName || data.hospitalCode) {
          setHospitalInfo({ code: data.hospitalCode, name: data.hospitalName });
        }
      } else {
        setStatus('disconnected');
        setLatencyMs(null);
      }
    } catch {
      setStatus('disconnected');
      setLatencyMs(null);
    } finally {
      isCheckingRef.current = false;
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  }, []);

  useEffect(() => {
    // 1. Initial probe on mount
    checkStatus();

    // 2. Real-time event listener: fires immediately when settings change in /settings
    const handleRefreshEvent = () => {
      checkStatus(true);
    };
    window.addEventListener('mra:his-status-refresh', handleRefreshEvent);

    // 3. Probe on window tab focus
    const handleFocus = () => {
      checkStatus();
    };
    window.addEventListener('focus', handleFocus);

    // 4. Background heartbeat probe every 45 seconds
    const interval = setInterval(() => {
      checkStatus();
    }, 45000);

    return () => {
      window.removeEventListener('mra:his-status-refresh', handleRefreshEvent);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [checkStatus]);

  if (status === 'checking') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-500 select-none leading-none tracking-wide animate-pulse ${className}`}
        title="กำลังตรวจสอบสถานะการเชื่อมต่อฐานข้อมูล HIS..."
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
        <span>HIS Checking...</span>
      </div>
    );
  }

  if (status === 'connected') {
    const tooltip = [
      'เชื่อมต่อฐานข้อมูล HIS สำเร็จ (สถานะออนไลน์)',
      hospitalInfo?.name ? `หน่วยบริการ: ${hospitalInfo.name}` : null,
      hospitalInfo?.code ? `(HCODE: ${hospitalInfo.code})` : null,
      latencyMs !== null ? `Latency: ${latencyMs} ms` : null,
      '— คลิกเพื่อตรวจสอบการเชื่อมต่อใหม่',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        type="button"
        onClick={() => checkStatus(true)}
        disabled={isRefreshing}
        title={tooltip}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-emerald-50 hover:bg-emerald-100/80 active:bg-emerald-200/70 border border-emerald-200/90 text-[10px] font-bold text-emerald-700 shadow-2xs select-none leading-none tracking-wide transition-all cursor-pointer group disabled:opacity-70 ${className}`}
      >
        {isRefreshing ? (
          <RefreshCw size={9} className="animate-spin text-emerald-600 shrink-0" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        )}
        <span>HIS Connected</span>
        {latencyMs !== null && !isRefreshing && (
          <span className="text-[9px] text-emerald-600/80 font-mono font-medium hidden sm:inline">
            {latencyMs}ms
          </span>
        )}
      </button>
    );
  }

  // Disconnected status
  return (
    <button
      type="button"
      onClick={() => checkStatus(true)}
      disabled={isRefreshing}
      title="ไม่สามารถเชื่อมต่อฐานข้อมูล HIS ได้ (สถานะออฟไลน์) — คลิกเพื่อตรวจสอบใหม่"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-rose-50 hover:bg-rose-100/80 active:bg-rose-200/70 border border-rose-200/90 text-[10px] font-bold text-rose-700 shadow-2xs select-none leading-none tracking-wide transition-all cursor-pointer group disabled:opacity-70 ${className}`}
    >
      {isRefreshing ? (
        <RefreshCw size={9} className="animate-spin text-rose-600 shrink-0" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
      )}
      <span>HIS Disconnected</span>
    </button>
  );
}

export default HisStatusBadge;
