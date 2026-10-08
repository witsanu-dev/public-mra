import { NextRequest, NextResponse } from 'next/server';
import { queryHis } from '@/lib/db-his';
import { executeMra } from '@/lib/db-mra';
import { getServerSession } from '@/lib/auth';
import { RBAC, forbiddenResponse } from '@/lib/rbac';
import { RowDataPacket } from 'mysql2/promise';
import { logAuditEvent } from '@/lib/audit-trail';

interface HisVisitSampleRow extends RowDataPacket {
  vn: string;
  hn: string;
  cid: string;
  patient_name: string;
  sex: string;
  age_y: number;
  vstdate: string;
  vsttime: string;
  pdx: string;
  diagnosis_name: string;
  pttype_name: string;
  department: string;
  doctor_name: string;
  chief_complaint: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      dateFrom,
      dateTo,
      caseType = 'all',
      clinicCode = '',
      sampleSize = 10,
      auditorName = 'Auditor',
    } = body;

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุช่วงวันที่รับบริการ (dateFrom, dateTo)' },
        { status: 400 }
      );
    }

    const size = Math.min(Math.max(parseInt(String(sampleSize), 10) || 10, 1), 100);

    // Check session & enforce RBAC (Officer is Read-Only and cannot sample)
    const session = await getServerSession();
    if (!session || !RBAC.canCreateSample(session.role)) {
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'opd_sample_create',
        status: 'denied',
        severity: 'warning',
        summary: 'ถูกปฏิเสธ: ไม่มีสิทธิ์สร้างชุดสุ่มเวชระเบียน OPD',
      });
      return forbiddenResponse('เฉพาะผู้ดูแลระบบและผู้ตรวจประเมินเท่านั้นที่มีสิทธิ์สร้างชุดสุ่มเวชระเบียน');
    }

    // Resolve Auditor Name from session if not specified
    let finalAuditorName = (auditorName || '').trim();
    if (!finalAuditorName || finalAuditorName === 'Auditor') {
      if (session?.fullName) {
        finalAuditorName = session.fullName;
      }
    }
    if (!finalAuditorName) finalAuditorName = 'Auditor';

    // 1. Build Query for HIS (Strict Read-Only)
    const whereClauses: string[] = [
      `o.vstdate BETWEEN ? AND ?`,
      `o.an IS NULL`, // OPD/ER only (not admitted)
    ];
    const queryParams: unknown[] = [dateFrom, dateTo];

    let extraJoin = '';

    if (caseType === 'chronic') {
      if (clinicCode) {
        extraJoin += ` INNER JOIN clinicmember cm ON cm.hn = o.hn AND cm.clinic = ? `;
        queryParams.push(clinicCode);
      } else {
        // Any chronic clinic member or chronic PDX (Diabetes, Hypertension, Asthma, COPD, CKD, etc.)
        whereClauses.push(`(
          EXISTS (SELECT 1 FROM clinicmember cm WHERE cm.hn = o.hn)
          OR v.pdx REGEXP '^(E1[0-4]|I1[0-5]|J4[4-5]|N18|I6[0-9]|F[0-9])'
        )`);
      }
    } else if (caseType === 'psychiatric') {
      // ผู้ป่วยจิตเวช: ICD-10 กลุ่ม F00-F99 หรือคลินิกจิตเวช
      whereClauses.push(`(
        v.pdx REGEXP '^F[0-9]'
        OR k.department LIKE '%จิตเวช%'
        OR EXISTS (SELECT 1 FROM ovstdiag od WHERE od.vn = o.vn AND od.icd10 REGEXP '^F[0-9]')
      )`);
    } else if (caseType === 'er') {
      whereClauses.push(`(
        EXISTS (SELECT 1 FROM er_regist er WHERE er.vn = o.vn)
        OR k.department LIKE '%ฉุกเฉิน%'
      )`);
    } else if (caseType === 'general') {
      whereClauses.push(`(
        NOT EXISTS (SELECT 1 FROM er_regist er WHERE er.vn = o.vn)
        AND NOT (v.pdx REGEXP '^(E1[0-4]|I1[0-5]|J4[4-5]|N18|I6[0-9]|F[0-9])')
      )`);
    }

    const whereSql = whereClauses.join(' AND ');

    // Count available visits
    const countSql = `
      SELECT COUNT(DISTINCT o.vn) as total
      FROM ovst o
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN kskdepartment k ON k.depcode = o.cur_dep
      ${extraJoin}
      WHERE ${whereSql}
    `;
    const [countResult] = await queryHis<RowDataPacket[]>(countSql, queryParams);
    const totalAvailable = countResult?.total || 0;

    if (totalAvailable === 0) {
      return NextResponse.json({
        success: true,
        data: {
          batchId: null,
          totalAvailable: 0,
          sampleCount: 0,
          samples: [],
          message: 'ไม่พบประวัติการรับบริการตามช่วงเวลาและเงื่อนไขที่ระบุ',
        },
      });
    }

    // Query random samples from HIS (automatically encoded as UTF-8)
    const sampleSql = `
      SELECT 
        o.vn,
        o.hn,
        p.cid,
        CONCAT(p.pname, p.fname, ' ', p.lname) AS patient_name,
        p.sex,
        TIMESTAMPDIFF(YEAR, p.birthday, o.vstdate) AS age_y,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i') AS vsttime,
        v.pdx,
        COALESCE(i.name, v.pdx, 'ไม่ระบุ') AS diagnosis_name,
        COALESCE(pt.name, '') AS pttype_name,
        COALESCE(k.department, '') AS department,
        COALESCE(d.name, '') AS doctor_name,
        COALESCE(s.cc, '') AS chief_complaint
      FROM ovst o
      INNER JOIN patient p ON p.hn = o.hn
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN icd101 i ON i.code = v.pdx
      LEFT JOIN pttype pt ON pt.pttype = o.pttype
      LEFT JOIN kskdepartment k ON k.depcode = o.cur_dep
      LEFT JOIN doctor d ON d.code = o.doctor
      LEFT JOIN opdscreen s ON s.vn = o.vn
      ${extraJoin}
      WHERE ${whereSql}
      ORDER BY RAND()
      LIMIT ?
    `;

    const sampleParams = [...queryParams, size];
    const samples = await queryHis<HisVisitSampleRow[]>(sampleSql, sampleParams);

    // 2. Save Sampling Batch into db_mra (guaranteed UTF-8)
    const batchId = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    await executeMra(
      `INSERT INTO mra_sampling_batch 
        (batch_id, sampling_date, case_type, date_from, date_to, sample_size, total_available, department_code, created_by)
       VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        caseType,
        dateFrom,
        dateTo,
        samples.length,
        totalAvailable,
        clinicCode || null,
        finalAuditorName,
      ]
    );

    // 3. Save each sampled item into db_mra.mra_sampling_item
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const itemId = `${batchId}-${i + 1}`;
      await executeMra(
        `INSERT INTO mra_sampling_item
          (item_id, batch_id, vn, hn, cid, patient_name, sex, age_y, vstdate, vsttime, department, pdx, diagnosis_name, pttype_name, doctor_name, chief_complaint, audit_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          itemId,
          batchId,
          s.vn,
          s.hn,
          s.cid || '',
          s.patient_name || '',
          s.sex === '1' ? 'ชาย' : s.sex === '2' ? 'หญิง' : '',
          s.age_y || 0,
          s.vstdate,
          s.vsttime || '00:00',
          s.department || '',
          s.pdx || '',
          s.diagnosis_name || '',
          s.pttype_name || '',
          s.doctor_name || '',
          s.chief_complaint || '',
        ]
      );
    }

    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'opd_sample_create',
      severity: 'info',
      targetType: 'opd_batch',
      targetId: batchId,
      summary: `สร้างชุดสุ่มตรวจประเมิน OPD สำเร็จ (${samples.length} รายการ จากทั้งหมด ${totalAvailable} รายการ)`,
      details: {
        batchId,
        caseType,
        dateFrom,
        dateTo,
        clinicCode: clinicCode || undefined,
        sampleSize: samples.length,
        totalAvailable,
        auditorName: finalAuditorName,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        totalAvailable,
        sampleCount: samples.length,
        samples: samples.map((s, idx) => ({
          itemId: `${batchId}-${idx + 1}`,
          vn: s.vn,
          hn: s.hn,
          cid: s.cid,
          patientName: s.patient_name,
          sex: s.sex === '1' ? 'ชาย' : s.sex === '2' ? 'หญิง' : '',
          age: s.age_y,
          vstdate: s.vstdate,
          vsttime: s.vsttime,
          department: s.department,
          pdx: s.pdx,
          diagnosisName: s.diagnosis_name,
          pttypeName: s.pttype_name,
          doctorName: s.doctor_name,
          chiefComplaint: s.chief_complaint,
          auditStatus: 'pending',
        })),
      },
    });
  } catch (error: any) {
    const isConnError =
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'ENOTFOUND' ||
      error?.code === 'EHOSTUNREACH' ||
      error?.message?.includes('ETIMEDOUT') ||
      error?.message?.includes('ECONNREFUSED') ||
      error?.message?.includes('connect');

    const errorMsg = isConnError
      ? 'ไม่สามารถเชื่อมต่อฐานข้อมูล HIS โรงพยาบาลได้ (เครือข่ายขัดข้อง หรือเซิร์ฟเวอร์ออฟไลน์)'
      : (error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสุ่มข้อมูลจากระบบโรงพยาบาล');

    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'opd_sample_create',
      status: 'failed',
      severity: isConnError ? 'warning' : 'critical',
      summary: isConnError ? 'ไม่สามารถเชื่อมต่อฐานข้อมูล HIS (สถานะออฟไลน์)' : 'เกิดข้อผิดพลาดในการสร้างชุดสุ่มตรวจประเมิน OPD',
      details: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      {
        success: false,
        isHisOffline: isConnError,
        error: errorMsg,
      },
      { status: 200 }
    );
  }
}
