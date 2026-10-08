'use client';

import React, { useEffect } from 'react';
import { ShieldCheck, X, AlertTriangle, FileText, CheckCircle2, Building2, User, Scale } from 'lucide-react';
import { DEVELOPER_NAME, DEVELOPER_ALIAS, DEVELOPER_POSITION, DEVELOPER_ORGANIZATION } from '@/lib/constants';

interface EulaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EulaModal({ isOpen, onClose }: EulaModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="eula-title"
        className="bg-white rounded-md border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* ── Modal Header ── */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-sky-500/20 text-sky-400 flex items-center justify-center ring-1 ring-sky-400/30">
              <Scale size={18} />
            </div>
            <div>
              <h2 id="eula-title" className="text-sm sm:text-base font-bold leading-tight flex items-center gap-2">
                <span>สัญญาอนุญาตและข้อตกลงการใช้งาน</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  แจกใช้ฟรี
                </span>
              </h2>
              <p className="text-[11px] text-slate-300 mt-0.5">
                e-MR Audit Software Trial License Agreement • สำหรับหน่วยบริการสุขภาพ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Modal Body (Scrollable) ── */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed">
          {/* Important Notice Banner */}
          <div className="bg-amber-50/80 border border-amber-200/90 rounded-sm p-3.5 flex items-start gap-3 text-amber-900">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-bold text-amber-950">เงื่อนไขการอนุญาตให้ใช้งานฟรี:</span>
              <p className="text-amber-800 leading-normal">
                ระบบ e-MR Audit พัฒนาโดย <strong>นาย{DEVELOPER_NAME}</strong> <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs font-mono text-[10px] font-extrabold bg-slate-900 text-sky-400 border border-sky-500/40 shadow-xs tracking-wider ring-1 ring-sky-400/20">{DEVELOPER_ALIAS}</span> {DEVELOPER_ORGANIZATION} อนุญาตให้หน่วยบริการสุขภาพนำไปทดลองใช้งานโดยไม่มีค่าใช้จ่าย โดยมีเงื่อนไขห้ามดัดแปลง ลบ หรือแก้ไขข้อความแสดงสิทธิและเครดิตผู้พัฒนา การดัดแปลงแก้ไขถือเป็นการสิ้นสุดการอนุญาตให้ใช้งานและถือเป็นการละเมิดลิขสิทธิ์ตาม พ.ร.บ. ลิขสิทธิ์ พ.ศ. 2537 และฉบับแก้ไขเพิ่มเติม
              </p>
            </div>
          </div>

          {/* Section 1: สิทธิการใช้งาน */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-900 text-[13px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
              1. สิทธิและวัตถุประสงค์ในการใช้งาน (Grant of License)
            </h3>
            <p className="pl-3 text-slate-600">
              อนุญาตให้โรงพยาบาล, โรงพยาบาลส่งเสริมสุขภาพตำบล (รพ.สต.), สำนักงานสาธารณสุขจังหวัด และหน่วยบริการสุขภาพ นำไปติดตั้งและใช้งานเพื่อการประเมินคุณภาพเวชระเบียนภายในหน่วยบริการ โดยไม่มีค่าสิทธิการใช้งาน (Royalty-Free) ทั้งนี้หน่วยบริการเป็นผู้รับผิดชอบการติดตั้งและบริหารจัดการระบบแบบพึ่งพาตนเอง (Self-Hosted Model) โดยไม่มีบริการสนับสนุนทางเทคนิคเฉพาะบุคคลจากผู้พัฒนา
            </p>
          </div>

          {/* Section 2: ข้อห้ามเด็ดขาด */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 text-[13px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 inline-block" />
              2. ข้อห้ามเด็ดขาด (Strict Prohibitions)
            </h3>
            <div className="pl-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">•</span>
                <span>
                  <strong>ห้ามดัดแปลง ลบ หรือแก้ไขชื่อผู้พัฒนา:</strong> ทุกหน้าจอ UI, ส่วนท้ายหน้า (Footer), และโค้ดระบบ มีระบบตรวจสอบความสมบูรณ์ (Tamper Integrity Check) ห้ามแก้ไขหรือปิดบังข้อมูลผู้พัฒนาโดยเด็ดขาด
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">•</span>
                <span>
                  <strong>ห้ามใช้ในเชิงพาณิชย์:</strong> ห้ามนำโปรแกรมหรือส่วนประกอบไปจำหน่าย ให้เช่า แสวงหากำไร หรือเรียกเก็บค่าบริการในเชิงพาณิชย์
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">•</span>
                <span>
                  <strong>ห้ามแจกจ่ายต่อโดยมิชอบ:</strong> ห้ามนำไปเผยแพร่ ทำซ้ำ หรือแจกจ่ายต่อในนามบุคคลหรือหน่วยงานอื่นโดยไม่ได้รับความยินยอมเป็นลายลักษณ์อักษร
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">•</span>
                <span>
                  <strong>ห้ามแอบอ้างผลงาน:</strong> ห้ามนำไปแอบอ้างเป็นผลงานทางวิชาการของตนเอง หรือนำไปของบประมาณจัดซื้อจัดจ้าง
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: มาตรการทางกฎหมายและวินัย */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-900 text-[13px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 inline-block" />
              3. ผลทางกฎหมายและวินัยข้าราชการ (Legal & Disciplinary Enforcement)
            </h3>
            <p className="pl-3 text-slate-600">
              การฝ่าฝืน การลบข้อมูลการบริหารสิทธิ หรือการนำไปแสวงหาผลประโยชน์ทางการค้า ผู้พัฒนาขอสงวนสิทธิ์ในการเพิกถอนสิทธิการใช้งานทันที และดำเนินการตามกฎหมายทั้งทางแพ่งและทางอาญาตาม พ.ร.บ. ลิขสิทธิ์ พ.ศ. 2537 และ พ.ร.บ. คอมพิวเตอร์ พ.ศ. 2560 รวมถึงรายงานผู้บังคับบัญชาเพื่อพิจารณาโทษทางวินัย
            </p>
          </div>

          {/* Developer Card Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              ผู้พัฒนาและเจ้าของลิขสิทธิ์ (Original Developer)
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-slate-800">
              <div className="font-bold text-xs flex items-center gap-1.5">
                <User size={13} className="text-blue-900" />
                <span>นาย{DEVELOPER_NAME}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs font-mono text-[9.5px] font-extrabold bg-slate-900 text-sky-400 border border-sky-500/40 shadow-xs tracking-wider ring-1 ring-sky-400/20">
                  {DEVELOPER_ALIAS}
                </span>
                <span className="text-slate-500 font-normal">({DEVELOPER_POSITION})</span>
              </div>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Building2 size={13} className="text-slate-400" />
                {DEVELOPER_ORGANIZATION}
              </span>
            </div>
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 text-center sm:text-left">
            การเข้าสู่ระบบและใช้งาน e-MR Audit ถือว่าท่านยอมรับข้อกำหนดข้างต้น
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-sm bg-blue-900 hover:bg-blue-950 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 size={14} />
            <span>รับทราบและยอมรับข้อตกลง</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default EulaModal;
