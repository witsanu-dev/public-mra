'use client';

import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Calendar,
  Building,
  Activity,
  Layers,
  Sparkles,
  Save,
} from 'lucide-react';
import { alertSuccess, alertError } from '@/lib/mra-alert';

export interface ManualSamplingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'opd' | 'ipd';
  onSuccess: (batchId: string) => void;
}

interface CaseItem {
  code: string; // VN or AN
  hn: string;
  patientName: string;
  sex: string;
  age: string;
  date1: string; // vstdate or regdate
  date2?: string; // dchdate (IPD)
  deptOrWard: string;
  pdx: string;
  diagnosisName: string;
  doctorName: string;
  chiefComplaint?: string;
}

export function ManualSamplingModal({
  isOpen,
  onClose,
  mode,
  onSuccess,
}: ManualSamplingModalProps) {
  const isIpd = mode === 'ipd';

  // Batch header
  const todayStr = new Date().toISOString().split('T')[0];
  const [batchName, setBatchName] = useState(
    `ชุดสุ่มตรวจบันทึกเอง (${isIpd ? 'IPD' : 'OPD'} Manual) - ${new Date().toLocaleDateString('th-TH')}`
  );
  const [note, setNote] = useState('');

  // Form input state for single case
  const [currentCode, setCurrentCode] = useState('');
  const [currentHn, setCurrentHn] = useState('');
  const [currentPatientName, setCurrentPatientName] = useState('');
  const [currentSex, setCurrentSex] = useState('ชาย');
  const [currentAge, setCurrentAge] = useState('');
  const [currentDate1, setCurrentDate1] = useState(todayStr);
  const [currentDate2, setCurrentDate2] = useState(todayStr);
  const [currentDeptOrWard, setCurrentDeptOrWard] = useState(isIpd ? 'หอผู้ป่วยอายุรกรรม' : 'แผนกตรวจโรคทั่วไป');
  const [currentPdx, setCurrentPdx] = useState('');
  const [currentDiagnosisName, setCurrentDiagnosisName] = useState('');
  const [currentDoctorName, setCurrentDoctorName] = useState('');

  // List of items in current batch
  const [items, setItems] = useState<CaseItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Add single case to list
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentHn.trim() || !currentPatientName.trim()) {
      setErrorMsg('กรุณากรอก HN และชื่อ-สกุลผู้ป่วย');
      return;
    }

    const code = currentCode.trim() || (isIpd ? `AN-M${Date.now().toString().slice(-6)}` : `VN-M${Date.now().toString().slice(-6)}`);

    const newItem: CaseItem = {
      code,
      hn: currentHn.trim(),
      patientName: currentPatientName.trim(),
      sex: currentSex,
      age: currentAge.trim() || '0',
      date1: currentDate1,
      date2: isIpd ? currentDate2 : undefined,
      deptOrWard: currentDeptOrWard.trim(),
      pdx: currentPdx.trim().toUpperCase() || 'Z00.0',
      diagnosisName: currentDiagnosisName.trim() || 'General medical examination',
      doctorName: currentDoctorName.trim(),
    };

    setItems((prev) => [...prev, newItem]);
    setErrorMsg('');

    // Reset single case form
    setCurrentCode('');
    setCurrentHn('');
    setCurrentPatientName('');
    setCurrentAge('');
    setCurrentPdx('');
    setCurrentDiagnosisName('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    let headers = '';
    let sampleRow = '';
    if (isIpd) {
      headers = 'an,hn,patient_name,sex,age,regdate,dchdate,ward_name,pdx,diagnosis_name,doctor_name\n';
      sampleRow = 'AN690001,HN12345,นายสมชาย รักชาติ,ชาย,45,2026-10-01,2026-10-03,หอผู้ป่วยอายุรกรรม,J18.9,Pneumonia unspecified,นพ.วิษณุ ศรีโยธา\n';
    } else {
      headers = 'vn,hn,patient_name,sex,age,vstdate,department,pdx,diagnosis_name,doctor_name\n';
      sampleRow = 'VN690001,HN12345,นางสมศรี มีสุข,หญิง,38,2026-10-05,แผนกตรวจโรคทั่วไป,I10,Essential hypertension,พญ.ศิริพร แพทย์ชำนาญการ\n';
    }

    const blob = new Blob(['\uFEFF' + headers + sampleRow], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${mode}_manual_sampling.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Upload CSV file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          setErrorMsg('ไฟล์ไม่มีข้อมูลหรือมีเฉพาะแถวหัวตาราง');
          return;
        }

        const parsedItems: CaseItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 3 && cols[1]) {
            if (isIpd) {
              parsedItems.push({
                code: cols[0] || `AN-M${i}`,
                hn: cols[1],
                patientName: cols[2] || `ผู้ป่วย (${cols[1]})`,
                sex: cols[3] || 'ไม่ระบุ',
                age: cols[4] || '0',
                date1: cols[5] || todayStr,
                date2: cols[6] || todayStr,
                deptOrWard: cols[7] || 'หอผู้ป่วยสามัญ',
                pdx: (cols[8] || 'Z00.0').toUpperCase(),
                diagnosisName: cols[9] || 'General examination',
                doctorName: cols[10] || '',
              });
            } else {
              parsedItems.push({
                code: cols[0] || `VN-M${i}`,
                hn: cols[1],
                patientName: cols[2] || `ผู้ป่วย (${cols[1]})`,
                sex: cols[3] || 'ไม่ระบุ',
                age: cols[4] || '0',
                date1: cols[5] || todayStr,
                deptOrWard: cols[6] || 'แผนกตรวจโรคทั่วไป',
                pdx: (cols[7] || 'Z00.0').toUpperCase(),
                diagnosisName: cols[8] || 'General examination',
                doctorName: cols[9] || '',
              });
            }
          }
        }

        if (parsedItems.length > 0) {
          setItems((prev) => [...prev, ...parsedItems]);
          setErrorMsg('');
          alertSuccess('นำเข้าข้อมูลสำเร็จ', `นำเข้าเวชระเบียนจำนวน ${parsedItems.length} รายการ`);
        } else {
          setErrorMsg('ไม่พบแถวข้อมูลที่ถูกต้องในไฟล์ CSV');
        }
      } catch (err: any) {
        setErrorMsg('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์ CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Submit Batch to Backend
  const handleSubmitBatch = async () => {
    if (items.length === 0) {
      setErrorMsg('กรุณาเพิ่มรายการเวชระเบียนอย่างน้อย 1 รายการ');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const endpoint = isIpd ? '/api/sampling/ipd-manual' : '/api/sampling/manual';

      const payloadItems = items.map((it) => {
        if (isIpd) {
          return {
            an: it.code,
            hn: it.hn,
            patientName: it.patientName,
            sex: it.sex,
            age: parseInt(it.age, 10) || 0,
            regdate: it.date1,
            dchdate: it.date2 || it.date1,
            wardName: it.deptOrWard,
            pdx: it.pdx,
            diagnosisName: it.diagnosisName,
            doctorName: it.doctorName,
          };
        } else {
          return {
            vn: it.code,
            hn: it.hn,
            patientName: it.patientName,
            sex: it.sex,
            age: parseInt(it.age, 10) || 0,
            vstdate: it.date1,
            department: it.deptOrWard,
            pdx: it.pdx,
            diagnosisName: it.diagnosisName,
            doctorName: it.doctorName,
          };
        }
      });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchName,
          note,
          items: payloadItems,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error || 'เกิดข้อผิดพลาดในการบันทึกชุดสุ่มตรวจ');
        setIsSubmitting(false);
        return;
      }

      alertSuccess('สร้างชุดตรวจประเมินสำเร็จ', `ชุด ${json.data.batchId} (${items.length} รายการ)`);
      onSuccess(json.data.batchId);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-sm border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-pink-500 to-pink-700 text-white flex items-center justify-center shadow-xs">
              <FileText size={18} strokeWidth={2.4} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold leading-tight">
                  บันทึกตัวอย่างชุดตรวจประเมิน {isIpd ? 'ผู้ป่วยใน (IPD)' : 'ผู้ป่วยนอก (OPD)'}
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-pink-500/20 text-pink-300 border border-pink-500/40 uppercase">
                  Import
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                นำเข้าข้อมูลตัวอย่างชุดตรวจประเมินแบบกำหนดเอง
              </p>
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

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* 1. Batch Details Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-sm grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                ชื่อชุดตรวจประเมิน
              </label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="ระบุชื่อชุดตรวจ..."
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-pink-600 font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                หมายเหตุเพิ่มเติม
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="บันทึกช่วยจำ..."
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-pink-600 font-medium"
              />
            </div>
          </div>

          {/* 2. Dual Action Banner: Quick Template Import */}
          <div className="p-3 bg-pink-50/60 border border-pink-200 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} className="text-pink-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  กรณีต้องการนำเข้าข้อมูลพร้อมกันหลายรายการ
                </span>
                <span className="text-[11px] text-slate-500 block">
                  ดาวน์โหลดตัวอย่างข้อมูล template.csv แล้วนำเข้าข้อมูลเพื่อเพิ่มรายการ
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-sm shadow-2xs transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>ตัวอย่างข้อมูล CSV</span>
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 rounded-sm shadow-xs transition-colors cursor-pointer">
                <Upload size={13} />
                <span>นำเข้าข้อมูล</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          {/* 3. Manual Single Case Form */}
          <form onSubmit={handleAddItem} className="border border-slate-200 rounded-sm p-4 bg-white space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Plus size={14} className="text-pink-600" />
                <span>กรอกข้อมูลเวชระเบียนรายบุคคล</span>
              </h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  {isIpd ? 'AN (เลขรับผู้ป่วยใน)' : 'VN (เลขรับบริการ)'}
                </label>
                <input
                  type="text"
                  value={currentCode}
                  onChange={(e) => setCurrentCode(e.target.value)}
                  placeholder={isIpd ? 'AN...' : 'VN...'}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-sm font-mono text-xs focus:ring-1 focus:ring-pink-600 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  HN <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={currentHn}
                  onChange={(e) => setCurrentHn(e.target.value)}
                  placeholder="เช่น 12345"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-sm font-mono text-xs focus:ring-1 focus:ring-pink-600 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  ชื่อ-สกุล ผู้ป่วย <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={currentPatientName}
                  onChange={(e) => setCurrentPatientName(e.target.value)}
                  placeholder="ชื่อ-นามสกุล..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-sm text-xs focus:ring-1 focus:ring-pink-600 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  เพศ
                </label>
                <select
                  value={currentSex}
                  onChange={(e) => setCurrentSex(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-sm text-xs focus:ring-1 focus:ring-pink-600 outline-none bg-white"
                >
                  <option value="ชาย">ชาย</option>
                  <option value="หญิง">หญิง</option>
                  <option value="ไม่ระบุ">ไม่ระบุ</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  อายุ (ปี)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={currentAge}
                  onChange={(e) => setCurrentAge(e.target.value)}
                  placeholder="เช่น 45"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-sm text-xs focus:ring-1 focus:ring-pink-600 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  {isIpd ? 'วันที่รับเข้า (Admit)' : 'วันที่มารับบริการ'}
                </label>
                <input
                  type="date"
                  value={currentDate1}
                  onChange={(e) => setCurrentDate1(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-sm text-xs focus:ring-1 focus:ring-pink-600 outline-none"
                />
              </div>

              {isIpd && (
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    วันที่จำหน่าย (Discharge)
                  </label>
                  <input
                    type="date"
                    value={currentDate2}
                    onChange={(e) => setCurrentDate2(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-sm text-xs focus:ring-1 focus:ring-pink-600 outline-none"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  {isIpd ? 'หอผู้ป่วย (Ward)' : 'แผนกที่ตรวจ (Clinic/Dept)'}
                </label>
                <input
                  type="text"
                  value={currentDeptOrWard}
                  onChange={(e) => setCurrentDeptOrWard(e.target.value)}
                  placeholder={isIpd ? 'เช่น หอผู้ป่วยอายุรกรรม' : 'เช่น แผนกตรวจโรคทั่วไป'}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-sm text-xs focus:ring-1 focus:ring-pink-600 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  ICD-10 (PDX)
                </label>
                <input
                  type="text"
                  value={currentPdx}
                  onChange={(e) => setCurrentPdx(e.target.value)}
                  placeholder="เช่น J18.9"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-sm font-mono text-xs focus:ring-1 focus:ring-pink-600 outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  การวินิจฉัยโรค (Diagnosis Description)
                </label>
                <input
                  type="text"
                  value={currentDiagnosisName}
                  onChange={(e) => setCurrentDiagnosisName(e.target.value)}
                  placeholder="เช่น Pneumonia, unspecified"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-sm text-xs focus:ring-1 focus:ring-pink-600 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  แพทย์ผู้ตรวจ / เจ้าของไข้
                </label>
                <input
                  type="text"
                  value={currentDoctorName}
                  onChange={(e) => setCurrentDoctorName(e.target.value)}
                  placeholder="ชื่อแพทย์..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-sm text-xs focus:ring-1 focus:ring-pink-600 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-sm transition-colors cursor-pointer shadow-2xs"
              >
                <Plus size={13} />
                <span>เพิ่มข้อมูล</span>
              </button>
            </div>
          </form>

          {/* 4. Items Table in Current Batch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers size={14} className="text-pink-600" />
                <span>รายการเวชระเบียน ({items.length} รายการ)</span>
              </h4>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                >
                  ล้างรายการทั้งหมด
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-sm overflow-hidden bg-white max-h-56 overflow-y-auto shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="py-2 px-2.5 text-center w-10">#</th>
                    <th className="py-2 px-2.5">{isIpd ? 'AN' : 'VN'}</th>
                    <th className="py-2 px-2.5">HN</th>
                    <th className="py-2 px-2.5">ชื่อ-สกุล</th>
                    <th className="py-2 px-2.5">วันที่</th>
                    <th className="py-2 px-2.5">การวินิจฉัย (PDX)</th>
                    <th className="py-2 px-2.5">{isIpd ? 'หอผู้ป่วย' : 'แผนก'}</th>
                    <th className="py-2 px-2.5 text-center w-12">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        ยังไม่มีรายการเวชระเบียน กรุณากรอกข้อมูลด้านบนหรือนำเข้าไฟล์ CSV
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-2.5 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 font-mono font-bold text-slate-800">
                          {it.code}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-slate-600">
                          {it.hn}
                        </td>
                        <td className="py-2 px-2.5 font-medium text-slate-800">
                          {it.patientName} ({it.sex}/{it.age} ปี)
                        </td>
                        <td className="py-2 px-2.5 text-slate-600 text-[11px]">
                          {it.date1}
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="font-mono font-bold text-pink-700 bg-pink-50 px-1 py-0.2 rounded-xs border border-pink-200 text-[11px] mr-1">
                            {it.pdx}
                          </span>
                          <span className="text-[11px] text-slate-600 truncate max-w-[140px] inline-block align-bottom">
                            {it.diagnosisName}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-600 text-[11px]">
                          {it.deptOrWard}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xs transition-colors cursor-pointer"
                            title="ลบรายการ"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-sm bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            รวมรายการที่พร้อมบันทึก <strong className="text-slate-800">{items.length}</strong> เคส
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSubmitBatch}
              disabled={isSubmitting || items.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 rounded-sm shadow-md shadow-pink-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>กำลังบันทึกข้อมูล...</span>
              ) : (
                <>
                  <Save size={14} />
                  <span>บันทึกชุดตรวจประเมิน ({items.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
