import { NextRequest, NextResponse } from 'next/server';
import { executeMra } from '@/lib/db-mra';
import { getServerSession } from '@/lib/auth';
import { RBAC, forbiddenResponse } from '@/lib/rbac';
import { logAuditEvent } from '@/lib/audit-trail';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !RBAC.canCreateSample(session.role)) {
      return forbiddenResponse('เฉพาะผู้ดูแลระบบและผู้ตรวจประเมินเท่านั้นที่มีสิทธิ์สร้างชุดตรวจประเมิน');
    }

    const body = await req.json().catch(() => ({}));
    const { batchName, note, items = [] } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุข้อมูลเวชระเบียนผู้ป่วยใน (IPD) อย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    const now = new Date();
    const yy = String(now.getFullYear() + 543).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const batchId = `IPD-M${yy}${mm}-${randomHex}`;

    const finalBatchName = (
      batchName ||
      `ชุดตรวจผู้ป่วยในบันทึกด้วยตนเอง (IPD Manual) ประจำวันที่ ${now.toLocaleDateString('th-TH')}`
    ).trim();

    const minDate = items.reduce((min, it) => (!min || (it.regdate && it.regdate < min) ? it.regdate : min), '') ||
      now.toISOString().split('T')[0];
    const maxDate = items.reduce((max, it) => (!max || (it.dchdate && it.dchdate > max) ? it.dchdate : max), '') ||
      now.toISOString().split('T')[0];

    // 1. Insert into mra_ipd_sampling_batch
    await executeMra(
      `INSERT INTO mra_ipd_sampling_batch 
        (batch_id, batch_name, sampling_date, case_type, date_from, date_to, sample_size, total_available, ward_code, status, note, created_by)
       VALUES (?, ?, NOW(), 'manual', ?, ?, ?, ?, 'MANUAL', 'active', ?, ?)`,
      [
        batchId,
        finalBatchName,
        minDate,
        maxDate,
        items.length,
        items.length,
        note || 'สร้างเคสผู้ป่วยในแบบ Manual / นำเข้าไฟล์ (Standalone Mode)',
        session.fullName || session.loginname,
      ]
    );

    // 2. Insert items into mra_ipd_sampling_item
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const itemId = `${batchId}-${i + 1}`;
      const an = (it.an || `AN-M${Date.now()}-${i + 1}`).trim();
      const hn = (it.hn || `HN-M${i + 1}`).trim();
      const regdate = it.regdate || now.toISOString().split('T')[0];
      const dchdate = it.dchdate || now.toISOString().split('T')[0];

      let los = parseInt(String(it.lengthOfStay || 0), 10);
      if (!los) {
        const d1 = new Date(regdate).getTime();
        const d2 = new Date(dchdate).getTime();
        los = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      }

      await executeMra(
        `INSERT INTO mra_ipd_sampling_item 
          (item_id, batch_id, an, hn, cid, patient_name, sex, age_y, regdate, regtime, dchdate, dchtime, ward_code, ward_name, pdx, diagnosis_name, pttype_name, dchstts, dchtype, length_of_stay, doctor_name, audit_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          itemId,
          batchId,
          an,
          hn,
          it.cid || '',
          it.patientName || `ผู้ป่วยใน (${hn})`,
          it.sex || 'ไม่ระบุ',
          parseInt(String(it.age || 0), 10) || 0,
          regdate,
          it.regtime || '08:00',
          dchdate,
          it.dchtime || '16:00',
          it.wardCode || '01',
          it.wardName || 'หอผู้ป่วยสามัญ',
          it.pdx || 'Z00.0',
          it.diagnosisName || it.diagnosis || 'General adult medical examination',
          it.pttypeName || 'สิทธิหลักประกันสุขภาพ (บัตรทอง)',
          it.dchstts || 'Complete Recovery',
          it.dchtype || 'With Approval',
          los,
          it.doctorName || session.fullName || 'แพทย์เจ้าของไข้',
        ]
      );
    }

    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'ipd_manual_batch_create',
      severity: 'info',
      targetType: 'ipd_batch',
      targetId: batchId,
      summary: `สร้างชุดตรวจเวชระเบียน IPD แบบ Manual สำเร็จ (${items.length} รายการ)`,
      actor: {
        loginname: session.loginname,
        fullName: session.fullName,
        role: session.role,
      },
      details: {
        batchId,
        sampleCount: items.length,
        batchName: finalBatchName,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        batchName: finalBatchName,
        sampleCount: items.length,
      },
      message: `สร้างชุดตรวจประเมิน IPD แบบ Manual สำเร็จ (${items.length} รายการ)`,
    });
  } catch (error: any) {
    console.error('[Error in IPD Manual Sampling]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'เกิดข้อผิดพลาดในการสร้างชุดตรวจประเมิน IPD' },
      { status: 500 }
    );
  }
}
