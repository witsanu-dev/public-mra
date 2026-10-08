import { NextRequest, NextResponse } from 'next/server';
import { queryHis } from '@/lib/db-his';
import { executeMra, queryMra } from '@/lib/db-mra';
import { getServerSession } from '@/lib/auth';
import { RBAC, forbiddenResponse } from '@/lib/rbac';
import { RowDataPacket } from 'mysql2/promise';
import { logAuditEvent } from '@/lib/audit-trail';

interface HisIpdSampleRow extends RowDataPacket {
  an: string;
  hn: string;
  cid: string;
  patient_name: string;
  sex: string;
  age_y: number;
  regdate: string;
  regtime: string;
  dchdate: string;
  dchtime: string;
  ward_code: string;
  ward_name: string;
  pdx: string;
  diagnosis_name: string;
  pttype_name: string;
  dchstts: string;
  dchtype: string;
  length_of_stay: number;
  doctor_name: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      caseType = 'all',
      dateFrom,
      dateTo,
      sampleSize = 10,
      wardCode,
      auditorName = 'Auditor',
      batchName,
      note,
    } = body;

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุช่วงวันที่จำหน่าย (Date From / Date To)' },
        { status: 400 }
      );
    }

    const size = Math.min(Math.max(parseInt(sampleSize, 10) || 10, 1), 200);

    // Check session & enforce RBAC (Officer is Read-Only and cannot sample)
    const session = await getServerSession();
    if (!session || !RBAC.canCreateSample(session.role)) {
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'ipd_sample_create',
        status: 'denied',
        severity: 'warning',
        summary: 'ถูกปฏิเสธ: ไม่มีสิทธิ์สร้างชุดสุ่มเวชระเบียน IPD',
      });
      return forbiddenResponse('เฉพาะผู้ดูแลระบบและผู้ตรวจประเมินเท่านั้นที่มีสิทธิ์สร้างชุดสุ่มเวชระเบียน IPD');
    }

    // Resolve Auditor Name from session if not specified
    let finalAuditorName = (auditorName || '').trim();
    if (!finalAuditorName || finalAuditorName === 'Auditor' || finalAuditorName === 'ผู้ตรวจประเมิน IPD') {
      if (session?.fullName) {
        finalAuditorName = session.fullName;
      }
    }
    if (!finalAuditorName) finalAuditorName = 'ผู้ตรวจประเมิน IPD';

    // 1. Build Query Conditions for HIS (Read-only)
    const whereConditions: string[] = [
      'i.dchdate BETWEEN ? AND ?',
      "a.pdx IS NOT NULL AND a.pdx != ''", // Completed PDx required
    ];
    const queryParams: unknown[] = [dateFrom, dateTo];

    // Filter by Ward
    let selectedWardName = '';
    if (wardCode && wardCode.trim()) {
      whereConditions.push('i.ward = ?');
      queryParams.push(wardCode.trim());

      try {
        const [wardRow] = await queryHis<RowDataPacket[]>(
          `SELECT name FROM ward WHERE ward = ? LIMIT 1`,
          [wardCode.trim()]
        );
        if (wardRow?.name) selectedWardName = wardRow.name;
      } catch {}
    }

    // Filter by IPD Case Type
    if (caseType === 'surgical') {
      // Patients who underwent surgery
      whereConditions.push(
        `(EXISTS (SELECT 1 FROM ipt_oper io WHERE io.an = i.an) 
          OR a.op0 IS NOT NULL AND a.op0 != '')`
      );
    } else if (caseType === 'medical') {
      // Non-surgical general medical
      whereConditions.push(
        `NOT EXISTS (SELECT 1 FROM ipt_oper io WHERE io.an = i.an) 
         AND (a.op0 IS NULL OR a.op0 = '')`
      );
    } else if (caseType === 'psychiatric') {
      // ผู้ป่วยจิตเวช IPD: ICD-10 กลุ่ม F00-F99 หรือหอผู้ป่วยจิตเวช
      whereConditions.push(
        `(a.pdx REGEXP '^F[0-9]' 
          OR EXISTS (SELECT 1 FROM iptdiag id WHERE id.an = i.an AND id.icd10 REGEXP '^F[0-9]')
          OR EXISTS (SELECT 1 FROM ward w WHERE w.ward = i.ward AND w.name LIKE '%จิตเวช%'))`
      );
    } else if (caseType === 'pediatric') {
      // Age <= 15
      whereConditions.push('a.age_y <= 15');
    } else if (caseType === 'obgyn') {
      // Female and O-codes or related
      whereConditions.push("(p.sex = '2' AND (a.pdx LIKE 'O%' OR a.pdx LIKE 'Z3%'))");
    }

    const whereSql = whereConditions.join(' AND ');

    // Count Total Available in HIS
    const countSql = `
      SELECT COUNT(DISTINCT i.an) as total
      FROM ipt i
      INNER JOIN patient p ON p.hn = i.hn
      INNER JOIN an_stat a ON a.an = i.an
      WHERE ${whereSql}
    `;
    const [countResult] = await queryHis<RowDataPacket[]>(countSql, queryParams);
    const totalAvailable = Number(countResult?.total) || 0;

    if (totalAvailable === 0) {
      return NextResponse.json({
        success: true,
        data: {
          batchId: null,
          samplesCount: 0,
          totalAvailable: 0,
          samples: [],
          message: 'ไม่พบผู้ป่วยในที่ตรงตามเงื่อนไขที่เลือกในช่วงเวลาดังกล่าว',
        },
      });
    }

    // Query Random Sample from HIS
    const sampleSql = `
      SELECT 
        i.an,
        i.hn,
        p.cid,
        CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS patient_name,
        p.sex,
        a.age_y,
        DATE_FORMAT(i.regdate, '%Y-%m-%d') AS regdate,
        TIME_FORMAT(i.regtime, '%H:%i') AS regtime,
        DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
        TIME_FORMAT(i.dchtime, '%H:%i') AS dchtime,
        i.ward AS ward_code,
        COALESCE(w.name, CONCAT('หอผู้ป่วย ', i.ward)) AS ward_name,
        a.pdx,
        COALESCE(icd.name, a.pdx, 'ไม่ระบุ') AS diagnosis_name,
        COALESCE(pt.name, '') AS pttype_name,
        i.dchstts,
        i.dchtype,
        COALESCE(a.los, DATEDIFF(i.dchdate, i.regdate), 1) AS length_of_stay,
        COALESCE(d.name, '') AS doctor_name
      FROM ipt i
      INNER JOIN patient p ON p.hn = i.hn
      INNER JOIN an_stat a ON a.an = i.an
      LEFT JOIN ward w ON w.ward = i.ward
      LEFT JOIN icd101 icd ON icd.code = a.pdx
      LEFT JOIN pttype pt ON pt.pttype = i.pttype
      LEFT JOIN doctor d ON d.code = i.admdoctor
      WHERE ${whereSql}
      ORDER BY RAND()
      LIMIT ?
    `;

    const sampleParams = [...queryParams, size];
    const samples = await queryHis<HisIpdSampleRow[]>(sampleSql, sampleParams);

    // 2. Save Sampling Batch into db_mra
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const batchId = `BATCH-IPD-${dateStamp}-${randSuffix}`;

    const finalBatchName =
      batchName && batchName.trim()
        ? batchName.trim()
        : `สุ่มตรวจ IPD (${selectedWardName || 'ทุกหอผู้ป่วย'}) ${samples.length} เคส`;

    await executeMra(
      `INSERT INTO mra_ipd_sampling_batch 
        (batch_id, batch_name, sampling_date, case_type, date_from, date_to, sample_size, total_available, ward_code, ward_name, status, note, created_by)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        batchId,
        finalBatchName,
        caseType,
        dateFrom,
        dateTo,
        samples.length,
        totalAvailable,
        wardCode || null,
        selectedWardName || null,
        note || '',
        finalAuditorName,
      ]
    );

    // 3. Save each sampled item into db_mra.mra_ipd_sampling_item
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const itemId = `${batchId}-${i + 1}`;
      await executeMra(
        `INSERT INTO mra_ipd_sampling_item
          (item_id, batch_id, an, hn, cid, patient_name, sex, age_y, regdate, regtime, dchdate, dchtime, ward_code, ward_name, pdx, diagnosis_name, pttype_name, dchstts, dchtype, length_of_stay, doctor_name, audit_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          itemId,
          batchId,
          s.an,
          s.hn,
          s.cid || '',
          s.patient_name || '',
          s.sex === '1' ? 'ชาย' : s.sex === '2' ? 'หญิง' : '',
          s.age_y || 0,
          s.regdate,
          s.regtime || '00:00',
          s.dchdate,
          s.dchtime || '00:00',
          s.ward_code || '',
          s.ward_name || '',
          s.pdx || '',
          s.diagnosis_name || '',
          s.pttype_name || '',
          s.dchstts || '',
          s.dchtype || '',
          Math.max(1, Math.round(Number(s.length_of_stay) || 1)),
          s.doctor_name || '',
        ]
      );
    }

    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'ipd_sample_create',
      severity: 'info',
      targetType: 'ipd_batch',
      targetId: batchId,
      summary: `สร้างชุดสุ่มตรวจประเมิน IPD สำเร็จ (${samples.length} รายการ จากทั้งหมด ${totalAvailable} รายการ)`,
      details: {
        batchId,
        batchName: finalBatchName,
        caseType,
        dateFrom,
        dateTo,
        wardCode: wardCode || undefined,
        wardName: selectedWardName || undefined,
        sampleSize: samples.length,
        totalAvailable,
        auditorName: finalAuditorName,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        batchName: finalBatchName,
        samplesCount: samples.length,
        totalAvailable,
        samples: samples.map((s, idx) => ({
          itemId: `${batchId}-${idx + 1}`,
          an: s.an,
          hn: s.hn,
          cid: s.cid,
          patientName: s.patient_name,
          sex: s.sex === '1' ? 'ชาย' : s.sex === '2' ? 'หญิง' : '',
          age: s.age_y,
          admitDate: s.regdate,
          admitTime: s.regtime,
          dischargeDate: s.dchdate,
          dischargeTime: s.dchtime,
          wardCode: s.ward_code,
          wardName: s.ward_name,
          pdx: s.pdx,
          diagnosisName: s.diagnosis_name,
          pttypeName: s.pttype_name,
          dischargeStatus: s.dchstts,
          dischargeType: s.dchtype,
          lengthOfStay: Math.max(1, Math.round(Number(s.length_of_stay) || 1)),
          doctorName: s.doctor_name,
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
      : (error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสุ่มเวชระเบียนผู้ป่วยในจาก HIS');

    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'ipd_sample_create',
      status: 'failed',
      severity: isConnError ? 'warning' : 'critical',
      summary: isConnError ? 'ไม่สามารถเชื่อมต่อฐานข้อมูล HIS (สถานะออฟไลน์)' : 'เกิดข้อผิดพลาดในการสร้างชุดสุ่มตรวจประเมิน IPD',
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
