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
      vn,
      hn,
      pid = '',
      patientName = '',
      hcode: rawHcode = '',
      hname: rawHname = '',
      caseType = 'general',
      isPsychiatric = false,
      diagnosis = '',
      visitDate = '',
      chronicPeriodFrom = '',
      chronicPeriodTo = '',
      firstVisitDate = '',
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

    if (!vn || !hn) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน: ต้องมี VN และ HN' },
        { status: 400 }
      );
    }

    // Resolve hospital from this installation's HIS when not supplied
    let hcode = String(rawHcode || '').trim();
    let hname = String(rawHname || '').trim();
    if (!hcode || !hname) {
      try {
        const hosp = await getHisHospitalInfo();
        hcode = hcode || hosp.hcode;
        hname = hname || hosp.hname;
      } catch {
        // HIS unreachable: keep whatever the client sent
      }
    }

    // Check session & enforce RBAC for audit save
    const session = await getServerSession();
    if (!session || !RBAC.canSaveAudit(session.role)) {
      void logAuditEvent({
        req,
        category: 'AUDIT',
        action: 'opd_audit_save',
        status: 'denied',
        severity: 'warning',
        targetType: 'opd_visit',
        targetId: vn,
        summary: `ถูกปฏิเสธ: ไม่มีสิทธิ์บันทึกผลตรวจประเมิน OPD (VN ${vn})`,
      });
      return forbiddenResponse('ท่านไม่มีสิทธิ์บันทึกผลการตรวจประเมิน (สิทธิ์การใช้งาน: เจ้าหน้าที่ทั่วไป - ดูได้อย่างเดียว)');
    }

    // Resolve Auditor Name from session if not provided
    let finalAuditorName = (auditorName || '').trim();
    if (!finalAuditorName || finalAuditorName === 'นพ. ตรวจสอบ เวชระเบียน') {
      if (session?.fullName) {
        finalAuditorName = session.fullName;
      }
    }
    if (!finalAuditorName) finalAuditorName = 'ผู้ตรวจประเมิน';

    const finalIsPsychiatric = Boolean(isPsychiatric || caseType === 'psychiatric');
    const finalCaseType = caseType === 'psychiatric' ? 'psychiatric' : caseType;

    // Check if an audit already exists for this case (by itemId or vn)
    let existingAuditId: string | null = null;
    const removedDuplicateAuditIds: string[] = [];
    const existingAudits = await queryMra<RowDataPacket[]>(
      `SELECT audit_id FROM mra_opd_audit 
       WHERE (item_id = ? AND item_id IS NOT NULL AND item_id != '') 
          OR vn = ? 
       ORDER BY created_at DESC`,
      [itemId || '', vn]
    );

    if (existingAudits.length > 0) {
      existingAuditId = existingAudits[0].audit_id;
      // Clean up any historical orphan duplicate records for this case
      if (existingAudits.length > 1) {
        for (let i = 1; i < existingAudits.length; i++) {
          const oldAid = existingAudits[i].audit_id;
          await executeMra(`DELETE FROM mra_opd_audit_detail WHERE audit_id = ?`, [oldAid]);
          await executeMra(`DELETE FROM mra_opd_audit WHERE audit_id = ?`, [oldAid]);
          removedDuplicateAuditIds.push(String(oldAid));
        }
      }
    }

    const auditId = existingAuditId || `AUDIT-${vn}-${Date.now().toString().slice(-4)}`;

    // Snapshot previous values (read-only, best-effort) so updates keep before/after traceability
    let previousValues: Record<string, unknown> | null = null;
    if (existingAuditId) {
      try {
        const [prev] = await queryMra<RowDataPacket[]>(
          `SELECT sum_score, full_score, percentage, is_passed, overall_finding, auditor_name
           FROM mra_opd_audit WHERE audit_id = ? LIMIT 1`,
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

    // 1. Insert/Update mra_opd_audit in db_mra
    await executeMra(
      `INSERT INTO mra_opd_audit
        (audit_id, item_id, vn, hn, pid, patient_name, hcode, hname, case_type, is_psychiatric, diagnosis, visit_date, 
         chronic_period_from, chronic_period_to, first_visit_date, sum_score, full_score, percentage, 
         is_passed, overall_finding, certain_issue_remarks, auditor_name, audit_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         case_type = VALUES(case_type),
         is_psychiatric = VALUES(is_psychiatric),
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
        vn,
        hn,
        pid,
        patientName,
        hcode,
        hname,
        finalCaseType,
        finalIsPsychiatric ? 1 : 0,
        diagnosis,
        visitDate,
        chronicPeriodFrom,
        chronicPeriodTo,
        firstVisitDate,
        sumScore,
        fullScore,
        percentage,
        isPassed ? 1 : 0,
        overallFinding,
        certainIssueRemarks,
        finalAuditorName,
        auditDate,
      ]
    );

    // 2. Clear old details if any and insert new details
    await executeMra(`DELETE FROM mra_opd_audit_detail WHERE audit_id = ?`, [auditId]);

    for (const r of rows) {
      await executeMra(
        `INSERT INTO mra_opd_audit_detail
          (audit_id, content_no, content_name, na_selected, missing_selected, scores_json, add_score, deduct_score, calculated_full, calculated_sum, remark_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          auditId,
          r.no,
          r.name,
          r.naSelected ? 1 : 0,
          r.missingSelected ? 1 : 0,
          JSON.stringify(r.scores || [null, null, null, null, null, null, null]),
          r.addScore || 0,
          r.deductScore || 0,
          r.rowFull || 0,
          r.rowSum || 0,
          r.remarkText || '',
        ]
      );
    }



    // 3. If linked to a sampling item, update its status
    if (itemId) {
      await executeMra(
        `UPDATE mra_sampling_item 
         SET audit_status = 'audited', audit_id = ?, audited_at = NOW() 
         WHERE item_id = ?`,
        [auditId, itemId]
      );
    } else {
      // Try to match by vn
      await executeMra(
        `UPDATE mra_sampling_item 
         SET audit_status = 'audited', audit_id = ?, audited_at = NOW() 
         WHERE vn = ? AND audit_status = 'pending'`,
        [auditId, vn]
      );
    }

    void logAuditEvent({
      req,
      category: 'AUDIT',
      action: existingAuditId ? 'opd_audit_update' : 'opd_audit_create',
      severity: 'info',
      targetType: 'opd_audit',
      targetId: auditId,
      summary: `${existingAuditId ? 'แก้ไข' : 'บันทึก'}ผลตรวจประเมิน OPD (VN ${vn}) คะแนน ${sumScore}/${fullScore} (${percentage}%) ${isPassed ? 'ผ่าน' : 'ไม่ผ่าน'}`,
      details: {
        vn,
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
        message: 'บันทึกผลการตรวจประเมิน MRA ลงฐานข้อมูล db_mra สำเร็จเรียบร้อย',
      },
    });
  } catch (error) {
    console.error('Error saving MRA audit:', error);
    void logAuditEvent({
      req,
      category: 'AUDIT',
      action: 'opd_audit_save',
      status: 'failed',
      severity: 'warning',
      summary: 'บันทึกผลการตรวจประเมิน OPD ไม่สำเร็จ',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vn = searchParams.get('vn');
    const auditId = searchParams.get('auditId');

    if (!vn && !auditId) {
      // List recent audits
      const audits = await queryMra<RowDataPacket[]>(
        `SELECT 
          audit_id as auditId,
          vn,
          hn,
          pid,
          patient_name as patientName,
          case_type as caseType,
          is_psychiatric as isPsychiatric,
          diagnosis,
          visit_date as visitDate,
          sum_score as sumScore,
          full_score as fullScore,
          percentage,
          is_passed as isPassed,
          overall_finding as overallFinding,
          auditor_name as auditorName,
          DATE_FORMAT(audit_date, '%Y-%m-%d') as auditDate,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as createdAt
        FROM mra_opd_audit
        ORDER BY created_at DESC
        LIMIT 50`
      );
      return NextResponse.json({ success: true, data: audits });
    }

    const [audit] = await queryMra<RowDataPacket[]>(
      `SELECT * FROM mra_opd_audit 
       WHERE audit_id = ? OR vn = ? 
       ORDER BY (audit_id = ?) DESC, created_at DESC 
       LIMIT 1`,
      [auditId || '', vn || '', auditId || '']
    );

    if (!audit) {
      return NextResponse.json({ success: true, data: null });
    }

    const details = await queryMra<RowDataPacket[]>(
      `SELECT * FROM mra_opd_audit_detail WHERE audit_id = ? ORDER BY content_no ASC`,
      [audit.audit_id]
    );

    void logAuditEvent({
      req,
      category: 'ACCESS',
      action: 'opd_audit_view',
      targetType: 'opd_audit',
      targetId: audit.audit_id,
      summary: `เปิดดูผลตรวจประเมิน OPD (VN ${audit.vn})`,
      details: { vn: audit.vn, hn: audit.hn },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...audit,
        caseType: audit.case_type,
        isPsychiatric: Boolean(audit.is_psychiatric),
        details,
      },
    });
  } catch (error) {
    console.error('Error querying MRA audit:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve audit record' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mra/audit?vn=...&itemId=...&auditId=...
 * Revoke/delete an audit of an individual OPD case:
 * - Deletes mra_opd_audit_detail and mra_opd_audit
 * - Cleans up relational audit tables if present
 * - Resets mra_sampling_item back to audit_status = 'pending', audit_id = NULL
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vn = searchParams.get('vn');
    const itemId = searchParams.get('itemId');
    const auditIdParam = searchParams.get('auditId');

    // RBAC: Only Administrator can revoke/delete audits
    const session = await getServerSession();
    if (!session || !RBAC.canRevokeAudit(session.role)) {
      void logAuditEvent({
        req,
        category: 'AUDIT',
        action: 'opd_audit_revoke',
        status: 'denied',
        severity: 'warning',
        targetType: 'opd_visit',
        targetId: vn || auditIdParam || itemId,
        summary: 'ถูกปฏิเสธ: ไม่มีสิทธิ์ลบ/ยกเลิกผลตรวจประเมิน OPD',
      });
      return forbiddenResponse('เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่มีสิทธิ์ลบหรือยกเลิกผลการตรวจประเมิน');
    }

    if (!vn && !itemId && !auditIdParam) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ vn, itemId หรือ auditId เพื่อยกเลิกการตรวจประเมิน' },
        { status: 400 }
      );
    }

    // 1. Locate audit record
    let targetAuditId = auditIdParam;
    if (!targetAuditId) {
      const found = await queryMra<RowDataPacket[]>(
        `SELECT audit_id FROM mra_opd_audit 
         WHERE (item_id = ? AND item_id IS NOT NULL AND item_id != '') 
            OR vn = ? 
         LIMIT 1`,
        [itemId || '', vn || '']
      );
      if (found.length > 0) {
        targetAuditId = found[0].audit_id;
      }
    }

    // 2. Delete detail rows & header if audit record exists
    let deletedSnapshot: Record<string, unknown> | null = null;
    if (targetAuditId) {
      // Best-effort snapshot of what is about to be deleted (read-only)
      try {
        const [snap] = await queryMra<RowDataPacket[]>(
          `SELECT a.vn, a.hn, a.sum_score, a.full_score, a.percentage, a.is_passed, a.overall_finding,
                  a.auditor_name, DATE_FORMAT(a.audit_date, '%Y-%m-%d') AS audit_date,
                  (SELECT COUNT(*) FROM mra_opd_audit_detail d WHERE d.audit_id = a.audit_id) AS detail_rows
           FROM mra_opd_audit a WHERE a.audit_id = ? LIMIT 1`,
          [targetAuditId]
        );
        if (snap) {
          deletedSnapshot = {
            vn: snap.vn,
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

      await executeMra(`DELETE FROM mra_opd_audit_detail WHERE audit_id = ?`, [targetAuditId]);
      await executeMra(`DELETE FROM mra_opd_audit WHERE audit_id = ?`, [targetAuditId]);


    }

    // 3. Reset status in mra_sampling_item back to 'pending'
    if (itemId) {
      await executeMra(
        `UPDATE mra_sampling_item 
         SET audit_status = 'pending', audit_id = NULL, audited_at = NULL 
         WHERE item_id = ?`,
        [itemId]
      );
    }
    if (vn) {
      await executeMra(
        `UPDATE mra_sampling_item 
         SET audit_status = 'pending', audit_id = NULL, audited_at = NULL 
         WHERE vn = ?`,
        [vn]
      );
    }

    void logAuditEvent({
      req,
      category: 'AUDIT',
      action: 'opd_audit_revoke',
      severity: 'critical',
      targetType: 'opd_audit',
      targetId: targetAuditId || vn || itemId,
      summary: `ยกเลิก/ลบผลตรวจประเมิน OPD${vn ? ` (VN ${vn})` : ''}${targetAuditId ? '' : ' - ไม่พบรายการผลตรวจ'}`,
      details: { vn, itemId, auditId: targetAuditId, deleted: deletedSnapshot },
    });

    return NextResponse.json({
      success: true,
      message: 'ยกเลิกผลการตรวจประเมิน OPD สำเร็จเรียบร้อย สถานะกลับเป็นรอตรวจ',
    });
  } catch (error) {
    console.error('Error revoking MRA OPD audit:', error);
    void logAuditEvent({
      req,
      category: 'AUDIT',
      action: 'opd_audit_revoke',
      status: 'failed',
      severity: 'warning',
      summary: 'ยกเลิก/ลบผลตรวจประเมิน OPD ไม่สำเร็จ',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการยกเลิกผลการตรวจประเมิน',
      },
      { status: 500 }
    );
  }
}
