import { NextRequest, NextResponse } from 'next/server';
import { queryMra, executeMra, getMraPool } from '@/lib/db-mra';
import { getServerSession } from '@/lib/auth';
import { RBAC, forbiddenResponse } from '@/lib/rbac';
import { RowDataPacket } from 'mysql2/promise';
import { logAuditEvent } from '@/lib/audit-trail';

/**
 * GET /api/mra/batches
 * - ?batchId=... : Fetch sampled visit items for a specific batch
 * - (no query)   : List recent sampling batches with status, notes, and audit progress
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');

    if (batchId) {
      // Get all sampled items for this batch
      const items = await queryMra<RowDataPacket[]>(
        `SELECT 
          item_id as itemId,
          batch_id as batchId,
          vn,
          hn,
          cid,
          patient_name as patientName,
          sex,
          age_y as age,
          DATE_FORMAT(vstdate, '%Y-%m-%d') as vstdate,
          vsttime,
          department,
          pdx,
          diagnosis_name as diagnosisName,
          pttype_name as pttypeName,
          doctor_name as doctorName,
          chief_complaint as chiefComplaint,
          audit_status as auditStatus,
          audit_id as auditId,
          audited_at as auditedAt
        FROM mra_sampling_item
        WHERE batch_id = ?
        ORDER BY vstdate DESC, vsttime DESC`,
        [batchId]
      );

      return NextResponse.json({ success: true, data: items });
    }

    // List recent batches (including batch_name, status, note, progress)
    const batches = await queryMra<RowDataPacket[]>(
      `SELECT 
        b.batch_id as batchId,
        COALESCE(b.batch_name, '') as batchName,
        DATE_FORMAT(b.sampling_date, '%Y-%m-%d %H:%i') as samplingDate,
        b.case_type as caseType,
        DATE_FORMAT(b.date_from, '%Y-%m-%d') as dateFrom,
        DATE_FORMAT(b.date_to, '%Y-%m-%d') as dateTo,
        b.sample_size as sampleSize,
        b.total_available as totalAvailable,
        b.department_code as departmentCode,
        COALESCE(b.status, 'active') as status,
        COALESCE(b.note, '') as note,
        COALESCE(b.created_by, 'Auditor') as createdBy,
        DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') as createdAt,
        DATE_FORMAT(b.updated_at, '%Y-%m-%d %H:%i') as updatedAt,
        COUNT(CASE WHEN i.audit_status = 'audited' THEN 1 END) as auditedCount
      FROM mra_sampling_batch b
      LEFT JOIN mra_sampling_item i ON i.batch_id = b.batch_id
      GROUP BY b.batch_id
      ORDER BY b.sampling_date DESC
      LIMIT 100`
    );

    return NextResponse.json({ success: true, data: batches });
  } catch (error) {
    console.error('Error fetching MRA batches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sampling batches' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mra/batches
 * Flexible batch updates:
 * - action='cancel'     : Mark batch as cancelled (void)
 * - action='reactivate' : Restore cancelled batch back to active
 * - action='complete'   : Mark batch as completed
 * - action='update'     : Edit batchName, note, createdBy, status
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, action, batchName, note, createdBy, status } = body;

    if (!batchId) {
      return NextResponse.json({ success: false, error: 'batchId is required' }, { status: 400 });
    }

    // RBAC: Only Administrator can modify batches (cancel, reactivate, complete, update metadata)
    const session = await getServerSession();
    if (!session || !RBAC.isAdmin(session.role)) {
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'opd_batch_update',
        status: 'denied',
        severity: 'warning',
        targetType: 'opd_batch',
        targetId: batchId,
        summary: 'ถูกปฏิเสธ: ไม่มีสิทธิ์แก้ไขหรือเปลี่ยนสถานะชุดสุ่มเวชระเบียน OPD',
      });
      return forbiddenResponse('เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่มีสิทธิ์แก้ไขหรือเปลี่ยนแปลงสถานะชุดสุ่มเวชระเบียน');
    }

    if (action === 'cancel') {
      await executeMra(
        `UPDATE mra_sampling_batch SET status = 'cancelled', updated_at = NOW() WHERE batch_id = ?`,
        [batchId]
      );
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'opd_batch_cancel',
        severity: 'warning',
        targetType: 'opd_batch',
        targetId: batchId,
        summary: `ยกเลิกรอบการสุ่ม OPD: ${batchId}`,
        details: { batchId },
      });
      return NextResponse.json({
        success: true,
        message: `ยกเลิกรอบการสุ่ม ${batchId} เรียบร้อยแล้ว`,
      });
    }

    if (action === 'reactivate') {
      await executeMra(
        `UPDATE mra_sampling_batch SET status = 'active', updated_at = NOW() WHERE batch_id = ?`,
        [batchId]
      );
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'opd_batch_reactivate',
        severity: 'info',
        targetType: 'opd_batch',
        targetId: batchId,
        summary: `คืนสถานะรอบการสุ่ม OPD เป็นเปิดใช้งาน: ${batchId}`,
        details: { batchId },
      });
      return NextResponse.json({
        success: true,
        message: `คืนสถานะรอบการสุ่ม ${batchId} เป็นเปิดใช้งานเรียบร้อยแล้ว`,
      });
    }

    if (action === 'complete') {
      await executeMra(
        `UPDATE mra_sampling_batch SET status = 'completed', updated_at = NOW() WHERE batch_id = ?`,
        [batchId]
      );
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'opd_batch_complete',
        severity: 'info',
        targetType: 'opd_batch',
        targetId: batchId,
        summary: `บันทึกสถานะรอบการสุ่ม OPD ว่าตรวจเสร็จสมบูรณ์: ${batchId}`,
        details: { batchId },
      });
      return NextResponse.json({
        success: true,
        message: `บันทึกสถานะรอบ ${batchId} ว่าตรวจครบเสร็จสิ้นแล้ว`,
      });
    }

    // Default 'update' action for metadata editing
    const updates: string[] = [];
    const params: unknown[] = [];

    if (batchName !== undefined) {
      updates.push('batch_name = ?');
      params.push(String(batchName).trim());
    }
    if (note !== undefined) {
      updates.push('note = ?');
      params.push(String(note).trim());
    }
    if (createdBy !== undefined) {
      updates.push('created_by = ?');
      params.push(String(createdBy).trim());
    }
    if (status !== undefined && ['active', 'completed', 'cancelled'].includes(status)) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่มีข้อมูลที่ต้องการแก้ไข' },
        { status: 400 }
      );
    }

    updates.push('updated_at = NOW()');
    params.push(batchId);

    await executeMra(
      `UPDATE mra_sampling_batch SET ${updates.join(', ')} WHERE batch_id = ?`,
      params
    );

    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'opd_batch_update',
      severity: 'info',
      targetType: 'opd_batch',
      targetId: batchId,
      summary: `แก้ไขข้อมูลรอบการสุ่ม OPD: ${batchId}`,
      details: { batchId, batchName, note, createdBy, status },
    });

    return NextResponse.json({
      success: true,
      message: `แก้ไขข้อมูลรอบการสุ่ม ${batchId} เรียบร้อยแล้ว`,
    });
  } catch (error) {
    console.error('Error updating MRA batch:', error);
    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'opd_batch_update',
      status: 'failed',
      severity: 'warning',
      summary: 'แก้ไขข้อมูลรอบการสุ่ม OPD ไม่สำเร็จ',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update batch' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mra/batches?batchId=...&force=true|false
 * Standard & Secure Batch Deletion:
 * - If items were already audited (auditedCount > 0), reject unless force=true
 * - Deletes mra_sampling_item rows and mra_sampling_batch row cleanly
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const force = searchParams.get('force') === 'true';

    // RBAC: Only Administrator can delete sampling batches
    const session = await getServerSession();
    if (!session || !RBAC.canDeleteBatch(session.role)) {
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'opd_batch_delete',
        status: 'denied',
        severity: 'warning',
        targetType: 'opd_batch',
        targetId: batchId,
        summary: 'ถูกปฏิเสธ: ไม่มีสิทธิ์ลบชุดสุ่มเวชระเบียน OPD',
      });
      return forbiddenResponse('เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่มีสิทธิ์ลบชุดสุ่มเวชระเบียน');
    }

    if (!batchId) {
      return NextResponse.json({ success: false, error: 'batchId is required' }, { status: 400 });
    }

    // 1. Check if batch exists and inspect audited count
    const stats = await queryMra<RowDataPacket[]>(
      `SELECT 
        COUNT(CASE WHEN audit_status = 'audited' THEN 1 END) as auditedCount,
        COUNT(*) as totalItems
      FROM mra_sampling_item
      WHERE batch_id = ?`,
      [batchId]
    );

    const auditedCount = Number(stats[0]?.auditedCount || 0);
    const totalItems = Number(stats[0]?.totalItems || 0);

    // 2. Safety guard: Prevent accidental deletion of audited clinical records
    if (auditedCount > 0 && !force) {
      return NextResponse.json(
        {
          success: false,
          hasAuditedItems: true,
          auditedCount,
          totalItems,
          message: `รอบนี้มีเวชระเบียนที่ตรวจประเมินไปแล้ว ${auditedCount} ชาร์ต (จากทั้งหมด ${totalItems} ชาร์ต) เพื่อความปลอดภัยของข้อมูลการตรวจประเมิน ขอแนะนำให้ใช้การ "ยกเลิกรอบ" แทน หรือกดยืนยันเพื่อลบถาวร`,
        },
        { status: 409 }
      );
    }

    // 3. Atomically delete all associated records using MySQL Transaction
    const pool = getMraPool();
    const conn = await pool.getConnection();
    let deletedAuditIdsCount = 0;
    try {
      await conn.query('SET NAMES utf8mb4');
      await conn.beginTransaction();

      // Retrieve all items in this batch to identify related audits by audit_id, item_id, or vn
      const [batchItems] = await conn.query<RowDataPacket[]>(
        `SELECT item_id, vn, audit_id FROM mra_sampling_item WHERE batch_id = ?`,
        [batchId]
      );

      const auditIds = new Set<string>();
      for (const it of batchItems) {
        if (it.audit_id) auditIds.add(it.audit_id);
      }

      // Check mra_opd_audit for any linked item_id or vn
      for (const it of batchItems) {
        if (it.item_id || it.vn) {
          const [matched] = await conn.query<RowDataPacket[]>(
            `SELECT audit_id FROM mra_opd_audit WHERE (item_id = ? AND item_id IS NOT NULL) OR vn = ?`,
            [it.item_id || '', it.vn || '']
          );
          for (const m of matched) {
            if (m.audit_id) auditIds.add(m.audit_id);
          }
        }
      }

      // Clean up audit details, headers, and relational tables for each auditId
      for (const aId of auditIds) {
        await conn.execute(`DELETE FROM mra_opd_audit_detail WHERE audit_id = ?`, [aId]);
        await conn.execute(`DELETE FROM mra_opd_audit WHERE audit_id = ?`, [aId]);
      }
      deletedAuditIdsCount = auditIds.size;

      // Delete all sampled items in this batch
      await conn.execute(`DELETE FROM mra_sampling_item WHERE batch_id = ?`, [batchId]);

      // Delete the batch header
      await conn.execute(`DELETE FROM mra_sampling_batch WHERE batch_id = ?`, [batchId]);

      await conn.commit();
    } catch (txError) {
      await conn.rollback();
      throw txError;
    } finally {
      conn.release();
    }

    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'opd_batch_delete',
      severity: 'critical',
      targetType: 'opd_batch',
      targetId: batchId,
      summary: `ลบชุดสุ่มตรวจประเมิน OPD (${batchId}) รวมรายการ ${totalItems} รายการ และผลตรวจที่เกี่ยวข้อง ${deletedAuditIdsCount} รายการ`,
      details: { batchId, totalItems, auditedCount, deletedAuditIdsCount, force },
    });

    return NextResponse.json({
      success: true,
      message: `ลบรอบการสุ่ม ${batchId} พร้อมรายการตัวอย่าง ${totalItems} รายการออกจากฐานข้อมูลเรียบร้อย`,
    });
  } catch (error) {
    console.error('Error deleting MRA batch:', error);
    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'opd_batch_delete',
      status: 'failed',
      severity: 'warning',
      summary: 'เกิดข้อผิดพลาดในการลบชุดสุ่มตรวจประเมิน OPD',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete batch' },
      { status: 500 }
    );
  }
}
