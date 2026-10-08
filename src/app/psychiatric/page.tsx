'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Brain, Shuffle, ListTodo, BedDouble, Hospital, CheckCircle2, BookOpen, ExternalLink, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useUnifiedAuditStore } from '@/store/useUnifiedAuditStore';
import { useIpdAuditStore } from '@/store/useIpdAuditStore';
import { useRouter } from 'next/navigation';

export default function PsychiatricAssessmentHub() {
  const router = useRouter();
  const { setIsPsychiatric } = useUnifiedAuditStore();
  const setIpdField = useIpdAuditStore((s) => s.setField);

  const handleStartOpdPsychiatric = () => {
    setIsPsychiatric(true);
    router.push('/');
  };

  const handleStartIpdPsychiatric = () => {
    setIpdField('caseType', 'psychiatric');
    router.push('/ipd');
  };

  return (
    <div className="section-gap">
      {/* ── 1. Page Header ── */}
      <div className="bg-white p-4 md:p-5 rounded-sm border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-sm bg-purple-50 text-purple-700 border border-purple-200">
            มาตรฐาน สปสช.
          </span>
          <span className="text-xs text-slate-700 font-semibold uppercase">
            Medical Record Audit <span className="text-slate-300 font-normal mx-1">|</span> <span className="text-purple-600 font-bold">Psychiatric Care</span>
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-sm bg-gradient-to-br from-purple-600 to-indigo-800 text-white flex items-center justify-center shrink-0 shadow-xs ring-2 ring-purple-100">
              <Brain size={24} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-blue-950 leading-snug">
                ระบบตรวจประเมินเวชระเบียนผู้ป่วยจิตเวช (Psychiatric)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                โครงสร้างการประเมินมาตรฐาน ตามคู่มือการประเมินคุณภาพการบันทึกเวชระเบียนผู้ป่วยจิตเวช
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── 2. Quick Access Cards for OPD & IPD Psychiatric ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* OPD/ER Psychiatric Card */}
        <Card className="hover:shadow-md transition-shadow border-slate-200">
          <CardHeader className="bg-gradient-to-r from-pink-50/70 via-purple-50/40 to-transparent border-b border-slate-200 py-3.5 px-4 md:px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-sm bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Hospital size={24} />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-blue-950">
                    ผู้ป่วยนอกจิตเวช
                  </CardTitle>
                  <span className="text-[11px] font-semibold text-pink-700">
                    OPD & ER Psychiatric
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-5 space-y-3">
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li>โครงสร้างประเมินมาตรฐาน 8 หมวด (General case &ge; 14, Chronic case &ge; 18)</li>
              <li><strong className="text-slate-800">หมวดที่ 6 (Operative note)</strong>: ประเมินการรักษาด้วยไฟฟ้า (ECT) และ Psychosocial intervention</li>
              <li><strong className="text-slate-800">หมวดที่ 8 (Rehabilitation record)</strong>: ประเมินการฟื้นฟูสมรรถภาพจิตเวชโดยเฉพาะ</li>
            </ul>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartOpdPsychiatric}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 rounded-sm transition-colors shadow-xs"
              >
                <ListTodo size={14} />
                <span>ตรวจประเมินคุณภาพ</span>
              </button>
              <Link
                href="/sampling?caseType=psychiatric"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-sm transition-colors"
              >
                <Shuffle size={13} />
                <span>สุ่มตรวจเวชระเบียน</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* IPD Psychiatric Card */}
        <Card className="hover:shadow-md transition-shadow border-slate-200">
          <CardHeader className="bg-gradient-to-r from-blue-50/70 via-purple-50/40 to-transparent border-b border-slate-200 py-3.5 px-4 md:px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-sm bg-blue-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <BedDouble size={24} />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-blue-950">
                    ผู้ป่วยในจิตเวช
                  </CardTitle>
                  <span className="text-[11px] font-semibold text-blue-700">
                    IPD Psychiatric
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-5 space-y-3">
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li>โครงสร้างประเมินมาตรฐาน 11 หมวด (คะแนนเต็มต้องไม่น้อยกว่า 57 คะแนน)</li>
              <li><strong className="text-slate-800">หมวดที่ 9 (Operative note)</strong>: ประเมินการบำบัดทางจิตสังคม (Psychosocial intervention) และ ECT</li>
              <li><strong className="text-slate-800">หมวดที่ 10 (Labour record)</strong>: ปิดใช้งาน / NA ตามมาตรฐานจิตเวช</li>
            </ul>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartIpdPsychiatric}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-sm transition-colors shadow-xs"
              >
                <ListTodo size={14} />
                <span>ตรวจประเมินคุณภาพ</span>
              </button>
              <Link
                href="/ipd/sampling?caseType=psychiatric"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-sm transition-colors"
              >
                <Shuffle size={13} />
                <span>สุ่มตรวจเวชระเบียน</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
