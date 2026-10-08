'use client';

import React, { useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import { DEVELOPER_NAME, DEVELOPER_ORGANIZATION } from '@/lib/constants';

interface EulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  acceptLabel?: string;
}

export function EulaModal({ isOpen, onClose, onAccept, acceptLabel }: EulaModalProps) {
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

  const handleAccept = () => {
    if (onAccept) {
      onAccept();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="eula-title"
        className="bg-white rounded-sm border border-amber-300/60 shadow-2xl shadow-amber-950/20 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* ── Modal Header ── */}
        <div className="px-5 py-4 border-b border-amber-800/40 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-amber-800/60 text-amber-300 flex items-center justify-center ring-1 ring-amber-400/40 shadow-xs">
              <Scale size={20} />
            </div>
            <div>
              <h2 id="eula-title" className="text-sm sm:text-base font-bold leading-tight flex items-center gap-2 text-white">
                <span>ข้อตกลงการใช้งานและการอนุญาต</span>
              </h2>
              <p className="text-[11px] text-amber-300/90 mt-0.5 tracking-wide">
                e-MRA Software Trial License Agreement
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-1 rounded-sm text-amber-300/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Modal Body (Scrollable) ── */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          {/* Important Notice Banner */}
          <div className="bg-amber-50/90 border border-amber-200 rounded-sm p-3.5 flex items-start gap-3 text-amber-950 shadow-2xs">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-bold text-amber-950 block">เงื่อนไขการอนุญาตให้ใช้งานฟรี:</span>
              <p className="text-amber-900 leading-normal">
                ระบบ e-MR Audit พัฒนาโดย <strong>นาย{DEVELOPER_NAME}</strong> {DEVELOPER_ORGANIZATION} อนุญาตให้หน่วยบริการสุขภาพนำไปทดลองใช้งานโดยไม่มีค่าใช้จ่าย โดยมีเงื่อนไขห้ามดัดแปลง ลบ หรือแก้ไขข้อความแสดงสิทธิและเครดิตผู้พัฒนา การดัดแปลงแก้ไขถือเป็นการละเมิดลิขสิทธิ์ตาม พ.ร.บ. ลิขสิทธิ์ พ.ศ. 2537 และฉบับแก้ไขเพิ่มเติม
              </p>
            </div>
          </div>

          {/* Section 1: สิทธิการใช้งาน */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-amber-950 text-[13px] flex items-center gap-2 border-l-2 border-amber-600 pl-2">
              1. สิทธิและวัตถุประสงค์ในการใช้งาน
            </h3>
            <p className="pl-3 text-slate-700 leading-relaxed">
              อนุญาตให้ทุกหน่วยงานในสังกัดกระทรวงสาธารณสุข หรือหน่วยงานอื่น ๆ ในระบบบริการสุขภาพ นำไปติดตั้งและใช้งานเพื่อการประเมินคุณภาพการบันทึกข้อมูลเวชระเบียนภายในหน่วยบริการ โดยไม่มีค่าสิทธิการใช้งาน (Free-license) ทั้งนี้หน่วยบริการเป็นผู้ <strong className="font-bold text-amber-950 bg-amber-100/80 px-1.5 py-0.5 rounded-xs border border-amber-300/70 inline-block my-0.5 shadow-2xs">รับผิดชอบการติดตั้งและบริหารจัดการระบบด้วยตนเอง โดยไม่มีบริการสนับสนุนทางเทคนิคจากผู้พัฒนาทุกกรณี</strong>
            </p>
          </div>

          {/* Section 2: ข้อห้ามเด็ดขาด */}
          <div className="space-y-2">
            <h3 className="font-bold text-amber-950 text-[13px] flex items-center gap-2 border-l-2 border-amber-600 pl-2">
              2. ข้อห้ามเด็ดขาด
            </h3>
            <div className="pl-3 space-y-2">
              <div className="flex items-start gap-2 bg-amber-50/40 p-2 rounded-xs border border-amber-100/80">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                <span>
                  <strong className="text-amber-950">ห้ามดัดแปลง ลบ หรือแก้ไขชื่อผู้พัฒนา:</strong> ห้ามแก้ไขหรือปิดบังข้อมูลผู้พัฒนาโดยเด็ดขาด
                </span>
              </div>
              <div className="flex items-start gap-2 bg-amber-50/40 p-2 rounded-xs border border-amber-100/80">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                <span>
                  <strong className="text-amber-950">ห้ามใช้ในเชิงพาณิชย์:</strong> ห้ามนำโปรแกรมหรือส่วนประกอบไปจำหน่าย ให้เช่า แสวงหากำไร หรือเรียกเก็บค่าบริการในเชิงพาณิชย์
                </span>
              </div>
              <div className="flex items-start gap-2 bg-amber-50/40 p-2 rounded-xs border border-amber-100/80">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                <span>
                  <strong className="text-amber-950">ห้ามแจกจ่ายต่อโดยมิชอบ:</strong> ห้ามนำไปเผยแพร่ ทำซ้ำ หรือแจกจ่ายต่อในนามบุคคลหรือหน่วยงานอื่นโดยไม่ได้รับความยินยอมเป็นลายลักษณ์อักษร
                </span>
              </div>
              <div className="flex items-start gap-2 bg-amber-50/40 p-2 rounded-xs border border-amber-100/80">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                <span>
                  <strong className="text-amber-950">ห้ามแอบอ้างผลงาน:</strong> ห้ามนำไปแอบอ้างเป็นผลงานทางวิชาการของตนเอง หรือนำไปของบประมาณจัดซื้อจัดจ้าง
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: มาตรการทางกฎหมายและวินัย */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-amber-950 text-[13px] flex items-center gap-2 border-l-2 border-amber-600 pl-2">
              3. ผลทางกฎหมายและวินัยข้าราชการ
            </h3>
            <p className="pl-3 text-slate-700">
              การฝ่าฝืน การลบข้อมูลการบริหารสิทธิ หรือการนำไปแสวงหาผลประโยชน์ทางการค้า ผู้พัฒนาจะดำเนินการตามกฎหมายทั้งทางแพ่งและทางอาญาตาม พ.ร.บ.ลิขสิทธิ์ พ.ศ.2537 และ พ.ร.บ.คอมพิวเตอร์ พ.ศ.2560 รวมถึงรายงานผู้บังคับบัญชาเพื่อพิจารณาโทษทางวินัย
            </p>
          </div>

        </div>

        {/* ── Modal Footer ── */}
        <div className="px-5 py-3.5 bg-amber-50/70 border-t border-amber-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-amber-900/80 font-medium text-center sm:text-left">
            การเข้าสู่ระบบและใช้งาน e-MRA ถือว่าท่านยอมรับข้อกำหนดข้างต้น
          </span>
          <button
            type="button"
            onClick={handleAccept}
            className="w-full sm:w-auto px-5 py-2 rounded-sm bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ring-1 ring-amber-500/30"
          >
            <CheckCircle2 size={14} />
            <span>{acceptLabel || 'รับทราบและยอมรับข้อตกลง'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default EulaModal;
