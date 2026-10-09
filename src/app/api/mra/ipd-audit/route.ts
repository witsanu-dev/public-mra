import { NextRequest, NextResponse } from 'next/server';
import { executeMra, queryMra } from '@/lib/db-mra';
import { getHisHospitalInfo } from '@/lib/db-his';
import { getServerSession } from '@/lib/auth';
import { RBAC, forbiddenResponse } from '@/lib/rbac';
import { RowDataPacket } from 'mysql2/promise';
import { logAuditEvent } from '@/lib/audit-trail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      itemId,
      an,
      hn,
      pid = '',
      patientName = '',
      hcode: rawHcode = '',
      hname: rawHname = '',
      caseType = 'general',
      isPsychiatric = false,
      wardCode = '',
      wardName = '',
      admitDate = '',
      dischargeDate = '',
      lengthOfStay = 0,
      dischargeStatus = '',
      dischargeType = '',
      diagnosis = '',
      sumScore = 0,
      fullScore = 0,
      percentage = 0,
      isPassed = 0,
      overallFinding = 'no_issue',
      certainIssueRemarks = '',
      auditorName = '',
      auditDate = new Date().toISOString().split('T')[0],
      rows = [],
    } = body;

    if (!an || !hn) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน: ต้องมี AN และ HN' },
        { status: 400 }
      );
    }

    // Resolve hospital info dynamically if not provided
    let hcode = String(rawHcode || '').trim();
    let hname = String(rawHname || '').trim();
    if (!hcode || !hname) {
      try {
        const hosp = await getHisHospitalInfo();
        hcode = hcode || hosp.hcode;
        hname = hname || hosp.hname;
      } catch {
        // Fallback
      }
    }

    // Check session & enforce RBAC for IPD audit save
    const session = await getServerSession();
    if (!session || !RBAC.canSaveAudit(session.role)) {
      void logAuditEvent({
        req,
        category: 'AUDIT',
        action: 'ipd_audit_save',
        status: 'denied',
        severity: 'warning',
        targetType: 'ipd_admission',
        targetId: an,
        summary: `ถูกปฏิเสธ: ไม่มีสิทธิ์บันทึกผลตรวจประเมิน IPD (AN ${an})`,
      });
      return forbiddenResponse('ท่านไม่มีสิทธิ์บันทึกผลการตรวจประเมิน (สิทธิ์การใช้งาน: เจ้าหน้าที่ทั่วไป - ดูได้อย่างเดียว)');
    }

    // Resolve Auditor Name from session if not provided
    let finalAuditorName = (auditorName || '').trim();
    if (!finalAuditorName || finalAuditorName === 'นพ. ตรวจสอบ เวชระเบียน' || finalAuditorName === 'ผู้ตรวจประเมิน IPD') {
      if (session?.fullName) {
        finalAuditorName = session.fullName;
      }
    }
    if (!finalAuditorName) finalAuditorName = 'ผู้ตรวจประเมิน IPD';

    const finalIsPsychiatric = Boolean(isPsychiatric || caseType === 'psychiatric');
    const finalCaseType = caseType === 'psychiatric' ? 'psychiatric' : caseType;

    // Check if an audit already exists for this IPD case (by itemId or an)
    let existingAuditId: string | null = null;
    const removedDuplicateAuditIds: string[] = [];
    const existingAudits = await queryMra<RowDataPacket[]>(
      `SELECT audit_id FROM mra_ipd_audit 
       WHERE (item_id = ? AND item_id IS NOT NULL AND item_id != '') 
          OR an = ? 
       ORDER BY created_at DESC`,
      [itemId || '', an]
    );

    if (existingAudits.length > 0) {
      existingAuditId = existingAudits[0].audit_id;
      // Clean up any historical orphan duplicate records for this case
      if (existingAudits.length > 1) {
        for (let i = 1; i < existingAudits.length; i++) {
          const oldAid = existingAudits[i].audit_id;
          await executeMra(`DELETE FROM mra_ipd_audit_detail WHERE audit_id = ?`, [oldAid]);
          await executeMra(`DELETE FROM mra_ipd_audit WHERE audit_id = ?`, [oldAid]);
          removedDuplicateAuditIds.push(String(oldAid));
        }
      }
    }

    const auditId = existingAuditId || `IPD-AUDIT-${an}-${Date.now().toString().slice(-4)}`;

    // Snapshot previous values (read-only, best-effort) so updates keep before/after traceability
    let previousValues: Record<string, unknown> | null = null;
    if (existingAuditId) {
      try {
        const [prev] = await queryMra<RowDataPacket[]>(
          `SELECT sum_score, full_score, percentage, is_passed, overall_finding, auditor_name
           FROM mra_ipd_audit WHERE audit_id = ? LIMIT 1`,
          [existingAuditId]
        );
        if (prev) {
          previousValues = {
            sumScore: prev.sum_score,
            fullScore: prev.full_score,
            percentage: prev.percentage,
            isPassed: Boolean(prev.is_passed),
            overallFinding: prev.overall_finding,
            auditorName: prev.auditor_name,
          };
        }
      } catch {
        // non-critical
      }
    }

    // 1. Insert/Update mra_ipd_audit in db_mra
    await executeMra(
      `INSERT INTO mra_ipd_audit
        (audit_id, item_id, an, hn, patient_name, hcode, hname, case_type, is_psychiatric, ward_code, ward_name, 
         admit_date, discharge_date, length_of_stay, discharge_status, discharge_type, diagnosis, 
         sum_score, full_score, percentage, is_passed, overall_finding, certain_issue_remarks, auditor_name, audit_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         case_type = VALUES(case_type),
         is_psychiatric = VALUES(is_psychiatric),
         ward_code = VALUES(ward_code),
         ward_name = VALUES(ward_name),
         admit_date = VALUES(admit_date),
         discharge_date = VALUES(discharge_date),
         length_of_stay = VALUES(length_of_stay),
         discharge_status = VALUES(discharge_status),
         discharge_type = VALUES(discharge_type),
         diagnosis = VALUES(diagnosis),
         sum_score = VALUES(sum_score),
         full_score = VALUES(full_score),
         percentage = VALUES(percentage),
         is_passed = VALUES(is_passed),
         overall_finding = VALUES(overall_finding),
         certain_issue_remarks = VALUES(certain_issue_remarks),
         auditor_name = VALUES(auditor_name),
         audit_date = VALUES(audit_date),
         updated_at = NOW()`,
      [
        auditId,
        itemId || null,
        an,
        hn,
        patientName,
        hcode,
        hname,
        finalCaseType,
        finalIsPsychiatric ? 1 : 0,
        wardCode,
        wardName,
        admitDate || null,
        dischargeDate || null,
        lengthOfStay,
        dischargeStatus,
        dischargeType,
        diagnosis,
        sumScore,
        fullScore,
        percentage,
        isPassed ? 1 : 0,
        overallFinding,
        certainIssueRemarks || null,
        finalAuditorName,
        auditDate,
      ]
    );

    // 2. Clear previous details and insert new details
    await executeMra(`DELETE FROM mra_ipd_audit_detail WHERE audit_id = ?`, [auditId]);

    for (const r of rows) {
      await executeMra(
        `INSERT INTO mra_ipd_audit_detail
          (audit_id, content_no, content_name, na_selected, missing_selected, no_selected, scores_json, add_score, deduct_score, calculated_full, calculated_sum, remark_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          auditId,
          r.no,
          r.name,
          r.naSelected ? 1 : 0,
          r.missingSelected ? 1 : 0,
          r.noSelected ? 1 : 0,
          JSON.stringify(r.scores || []),
          r.addScore || 0,
          r.deductScore || 0,
          r.rowFull || 0,
          r.rowSum || 0,
          r.remarkText || '',
        ]
      );
    }



    // 4. Update status in mra_ipd_sampling_item if itemId or AN matches
    try {
      if (itemId) {
        await executeMra(
          `UPDATE mra_ipd_sampling_item 
           SET audit_status = 'audited', audit_id = ?, audited_at = NOW() 
           WHERE item_id = ?`,
          [auditId, itemId]
        );
      } else if (an) {
        await executeMra(
          `UPDATE mra_ipd_sampling_item 
           SET audit_status = 'audited', audit_id = ?, audited_at = NOW() 
           WHERE an = ? AND audit_status = 'pending'`,
          [auditId, an]
        );
      }
    } catch (samplingItemErr) {
      console.warn('Warning: Could not update mra_ipd_sampling_item status:', samplingItemErr);
    }

    void logAuditEvent({
      req,
      category: 'AUDIT',
      action: existingAuditId ? 'ipd_audit_update' : 'ipd_audit_create',
      severity: 'info',
      targetType: 'ipd_audit',
      targetId: auditId,
      summary: `${existingAuditId ? 'แก้ไข' : 'บันทึก'}ผลตรวจประเมิน IPD (AN ${an}) คะแนน ${sumScore}/${fullScore} (${percentage}%) ${isPassed ? 'ผ่าน' : 'ไม่ผ่าน'}`,
      details: {
        an,
        hn,
        itemId: itemId || null,
        caseType: finalCaseType,
        sumScore,
        fullScore,
        percentage,
        isPassed: Boolean(isPassed),
        overallFinding,
        auditorName: finalAuditorName,
        detailRows: Array.isArray(rows) ? rows.length : 0,
        removedDuplicateAuditIds,
        previous: previousValues,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        auditId,
        message: 'บันทึกผลการตรวจประเมิน IPD ลงฐานข้อมูลสำเร็จเรียบร้อย',
      },
    });
  } catch (error) {
    console.error('Error saving IPD audit:', error);
    void logAuditEvent({
      req,
      category: 'AUDIT',
      action: 'ipd_audit_save',
      status: 'failed',
      severity: 'warning',
      summary: 'บันทึกผลการตรวจประเมิน IPD ไม่สำเร็จ',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล IPD',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const an = searchParams.get('an');
    const auditId = searchParams.get('auditId');

    if (!an && !auditId) {
      const audits = await queryMra<RowDataPacket[]>(
        `SELECT 
          audit_id as auditId,
          an,
          hn,
          patient_name as patientName,
          case_type as caseType,
          is_psychiatric as isPsychiatric,
          ward_name as wardName,
          diagnosis,
          DATE_FORMAT(admit_date, '%Y-%m-%d') as admitDate,
          DATE_FORMAT(discharge_date, '%Y-%m-%d') as dischargeDate,
          length_of_stay as lengthOfStay,
          sum_score as sumScore,
          full_score as fullScore,
          percentage,
          is_passed as isPassed,
          overall_finding as overallFinding,
          certain_issue_remarks as certainIssueRemarks,
          auditor_name as auditorName,
          DATE_FORMAT(audit_date, '%Y-%m-%d') as auditDate,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as createdAt
        FROM mra_ipd_audit
        ORDER BY created_at DESC
        LIMIT 50`
      );
      return NextResponse.json({ success: true, data: audits });
    }

    const [audit] = await queryMra<RowDataPacket[]>(
      `SELECT * FROM mra_ipd_audit 
       WHERE audit_id = ? OR an = ? 
       ORDER BY (audit_id = ?) DESC, created_at DESC 
       LIMIT 1`,
      [auditId || '', an || '', auditId || '']
    );

    if (!audit) {
      return NextResponse.json({ success: true, data: null });
    }

    const details = await queryMra<RowDataPacket[]>(
      `SELECT * FROM mra_ipd_audit_detail WHERE audit_id = ? ORDER BY content_no ASC`,
      [audit.audit_id]
    );

    void logAuditEvent({
      req,
      category: 'ACCESS',
      action: 'ipd_audit_view',
      targetType: 'ipd_audit',
      targetId: audit.audit_id,
      summary: `เปิดดูผลตรวจประเมิน IPD (AN ${audit.an})`,
      details: { an: audit.an, hn: audit.hn },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...audit,
        caseType: audit.case_type,
        isPsychiatric: Boolean(audit.is_psychiatric),
        certainIssueRemarks: audit.certain_issue_remarks || '',
        details,
      },
    });
  } catch (error) {
    console.error('Error querying IPD audit:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve IPD audit record' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mra/ipd-audit?an=...&itemId=...&auditId=...
 * Revoke/delete an audit of an individual IPD case:
 * - Deletes mra_ipd_audit_detail and mra_ipd_audit
 * - Resets mra_ipd_sampling_item back to audit_status = 'pending', audit_id = NULL
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const an = searchParams.get('an');
    const itemId = searchParams.get('itemId');
    const auditIdParam = searchParams.get('auditId');

    // RBAC: Administrator and Auditor can revoke/cancel IPD audits (revert case to pending)
    const session = await getServerSession();
    if (!session || (!RBAC.isAdmin(session.role) && !RBAC.isAuditor(session.role))) {
      void logAuditEvent({
        req,
        category: 'AUDIT',
        action: 'ipd_audit_revoke',
        status: 'denied',
        severity: 'warning',
        targetType: 'ipd_admission',
        targetId: an || auditIdParam || itemId,
        summary: 'ถูกปฏิเสธ: ไม่มีสิทธิ์ยกเลิกผลตรวจประเมิน IPD',
      });
      return forbiddenResponse('เฉพาะผู้ดูแลระบบ (Administrator) และผู้ตรวจประเมิน (Auditor) เท่านั้นที่มีสิทธิ์ยกเลิกผลการตรวจประเมิน IPD');
    }

    if (!an && !itemId && !auditIdParam) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ an, itemId หรือ auditId เพื่อยกเลิกการตรวจประเมิน IPD' },
        { status: 400 }
      );
    }

    // 1. Locate audit record
    let targetAuditId = auditIdParam;
    if (!targetAuditId) {
      const found = await queryMra<RowDataPacket[]>(
        `SELECT audit_id FROM mra_ipd_audit 
         WHERE (item_id = ? AND item_id IS NOT NULL AND item_id != '') 
            OR an = ? 
         LIMIT 1`,
        [itemId || '', an || '']
      );
      if (found.length > 0) {
        targetAuditId = found[0].audit_id;
      }
    }

    // 2. Capture pre-delete snapshot & delete detail rows and header
    let deletedSnapshot: Record<string, unknown> | null = null;
    if (targetAuditId) {
      try {
        const [snap] = await queryMra<RowDataPacket[]>(
          `SELECT a.an, a.hn, a.sum_score, a.full_score, a.percentage, a.is_passed, a.overall_finding,
                  a.auditor_name, DATE_FORMAT(a.audit_date, '%Y-%m-%d') AS audit_date,
                  (SELECT COUNT(*) FROM mra_ipd_audit_detail d WHERE d.audit_id = a.audit_id) AS detail_rows
           FROM mra_ipd_audit a WHERE a.audit_id = ? LIMIT 1`,
          [targetAuditId]
        );
        if (snap) {
          deletedSnapshot = {
            an: snap.an,
            hn: snap.hn,
            sumScore: snap.sum_score,
            fullScore: snap.full_score,
            percentage: snap.percentage,
            isPassed: Boolean(snap.is_passed),
            overallFinding: snap.overall_finding,
            auditorName: snap.auditor_name,
            auditDate: snap.audit_date,
            detailRows: Number(snap.detail_rows || 0),
          };
        }
      } catch {
        // non-critical
      }

      await executeMra(`DELETE FROM mra_ipd_audit_detail WHERE audit_id = ?`, [targetAuditId]);
      await executeMra(`DELETE FROM mra_ipd_audit WHERE audit_id = ?`, [targetAuditId]);
    }

    // 3. Reset status in mra_ipd_sampling_item back to 'pending'
    if (itemId) {
      await executeMra(
        `UPDATE mra_ipd_sampling_item 
         SET audit_status = 'pending', audit_id = NULL, audited_at = NULL 
         WHERE item_id = ?`,
        [itemId]
      );
    }
    if (an) {
      await executeMra(
        `UPDATE mra_ipd_sampling_item 
         SET audit_status = 'pending', audit_id = NULL, audited_at = NULL 
         WHERE an = ?`,
        [an]
      );
    }

    void logAuditEvent({
      req,
      category: 'AUDIT',
      action: 'ipd_audit_revoke',
      severity: 'critical',
      targetType: 'ipd_audit',
      targetId: targetAuditId || an || itemId,
      summary: `ยกเลิก/ลบผลตรวจประเมิน IPD${an ? ` (AN ${an})` : ''}${targetAuditId ? '' : ' - ไม่พบรายการผลตรวจ'}`,
      details: { an, itemId, auditId: targetAuditId, deleted: deletedSnapshot },
    });

    return NextResponse.json({
      success: true,
      message: 'ยกเลิกผลการตรวจประเมิน IPD สำเร็จเรียบร้อย สถานะกลับเป็นรอตรวจ',
    });
  } catch (error) {
    console.error('Error revoking MRA IPD audit:', error);
    void logAuditEvent({
      req,
      category: 'AUDIT',
      action: 'ipd_audit_revoke',
      status: 'failed',
      severity: 'warning',
      summary: 'ยกเลิก/ลบผลตรวจประเมิน IPD ไม่สำเร็จ',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการยกเลิกผลการตรวจประเมิน IPD',
      },
      { status: 500 }
    );
  }
}
