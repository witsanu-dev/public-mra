'use client';

import React from 'react';
import { Terminal } from 'lucide-react';
import { APP_VERSION, APP_YEAR, DEVELOPER_NAME, DEVELOPER_ALIAS, DEVELOPER_POSITION, DEVELOPER_ORGANIZATION } from '@/lib/constants';
import { HisStatusBadge } from '@/components/ui/HisStatusBadge';

export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="w-full bg-white/95 backdrop-blur-xs border-t border-slate-200/90 mt-auto shrink-0 select-none transition-colors"
    >
      <div className="max-w-[1700px] mx-auto px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-3 text-slate-600">
        {/* ── Left Side: Developer Information ── */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 w-full md:w-auto justify-center md:justify-start">
          {/* Jewel Terminal Icon Badge (Matches Login Page) */}
          <div className="w-5 h-5 rounded-sm bg-gradient-to-br from-sky-500 via-sky-600 to-sky-700 text-white flex items-center justify-center shadow-xs shrink-0 ring-1 ring-inset ring-sky-300/50">
            <Terminal size={11} strokeWidth={3} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-[11px] leading-tight min-w-0 text-center sm:text-left">
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-center sm:justify-start">
              <span className="font-black tracking-wider uppercase text-[10px] bg-gradient-to-r from-sky-700 to-slate-800 bg-clip-text text-transparent">
                DEVELOPMENT BY
              </span>
              <span className="font-bold text-sky-600">{DEVELOPER_NAME}</span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <span className="text-slate-600 text-[10.5px]">{DEVELOPER_POSITION}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] sm:text-[10.5px] justify-center sm:justify-start flex-wrap sm:flex-nowrap">
              <span className="hidden sm:inline text-slate-300">•</span>
              <span className="text-center sm:text-left">{DEVELOPER_ORGANIZATION}</span>
            </div>
          </div>
        </div>

        {/* ── Right Side: Copyright, Version & Real-Time HIS Connection Badge ── */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 justify-center md:justify-end w-full md:w-auto pt-1.5 md:pt-0 border-t md:border-t-0 border-slate-100 flex-wrap">
          <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-400 tracking-wider uppercase whitespace-nowrap">
            © {APP_YEAR} • VERSION {APP_VERSION}
          </span>

          <HisStatusBadge />
        </div>
      </div>
    </footer>
  );
}

export default Footer;
