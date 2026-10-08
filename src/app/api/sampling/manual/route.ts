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
        { success: false, error: 'กรุณาระบุข้อมูลเวชระเบียนผู้ป่วยอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    const now = new Date();
    const yy = String(now.getFullYear() + 543).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const batchId = `OPD-M${yy}${mm}-${randomHex}`;

    const finalBatchName = (
      batchName ||
      `ชุดตรวจบันทึกด้วยตนเอง (Manual) ประจำวันที่ ${now.toLocaleDateString('th-TH')}`
    ).trim();

    const minDate = items.reduce((min, it) => (!min || (it.vstdate && it.vstdate < min) ? it.vstdate : min), '') ||
      now.toISOString().split('T')[0];
    const maxDate = items.reduce((max, it) => (!max || (it.vstdate && it.vstdate > max) ? it.vstdate : max), '') ||
      now.toISOString().split('T')[0];

    // 1. Insert into mra_sampling_batch
    await executeMra(
      `INSERT INTO mra_sampling_batch 
        (batch_id, batch_name, sampling_date, case_type, date_from, date_to, sample_size, total_available, department_code, status, note, created_by)
       VALUES (?, ?, NOW(), 'manual', ?, ?, ?, ?, 'MANUAL', 'active', ?, ?)`,
      [
        batchId,
        finalBatchName,
        minDate,
        maxDate,
        items.length,
        items.length,
        note || 'สร้างเคสประเมินแบบ Manual / นำเข้าไฟล์ (Standalone Mode)',
        session.fullName || session.loginname,
      ]
    );

    // 2. Insert items into mra_sampling_item
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const itemId = `${batchId}-${i + 1}`;
      const vn = (it.vn || `VN-M${Date.now()}-${i + 1}`).trim();
      const hn = (it.hn || `HN-M${i + 1}`).trim();

      await executeMra(
        `INSERT INTO mra_sampling_item 
          (item_id, batch_id, vn, hn, cid, patient_name, sex, age_y, vstdate, vsttime, department, pdx, diagnosis_name, pttype_name, doctor_name, chief_complaint, audit_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          itemId,
          batchId,
          vn,
          hn,
          it.cid || '',
          it.patientName || `ผู้ป่วยทั่วไป (${hn})`,
          it.sex || 'ไม่ระบุ',
          parseInt(String(it.age || 0), 10) || 0,
          it.vstdate || now.toISOString().split('T')[0],
          it.vsttime || '09:00',
          it.department || 'แผนกตรวจโรคทั่วไป',
          it.pdx || 'Z00.0',
          it.diagnosisName || it.diagnosis || 'General medical examination',
          it.pttypeName || 'สิทธิหลักประกันสุขภาพ (บัตรทอง)',
          it.doctorName || session.fullName || 'แพทย์ผู้ตรวจ',
          it.chiefComplaint || it.cc || '-',
        ]
      );
    }

    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'opd_manual_batch_create',
      severity: 'info',
      targetType: 'opd_batch',
      targetId: batchId,
      summary: `สร้างชุดตรวจเวชระเบียน OPD แบบ Manual สำเร็จ (${items.length} รายการ)`,
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
      message: `สร้างชุดตรวจประเมิน OPD แบบ Manual สำเร็จ (${items.length} รายการ)`,
    });
  } catch (error: any) {
    console.error('[Error in OPD Manual Sampling]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'เกิดข้อผิดพลาดในการสร้างชุดตรวจประเมิน' },
      { status: 500 }
    );
  }
}
