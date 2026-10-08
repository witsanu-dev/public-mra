import { NextRequest, NextResponse } from 'next/server';
import { queryMra, executeMra, getMraPool } from '@/lib/db-mra';
import { getServerSession } from '@/lib/auth';
import { RBAC, forbiddenResponse } from '@/lib/rbac';
import { RowDataPacket } from 'mysql2/promise';
import { logAuditEvent } from '@/lib/audit-trail';

/**
 * GET /api/mra/ipd-batches
 * - ?batchId=... : Fetch sampled visit items for a specific IPD batch
 * - (no query)   : List recent IPD sampling batches with status, notes, and audit progress
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');

    if (batchId) {
      // Get all sampled items for this IPD batch
      const items = await queryMra<RowDataPacket[]>(
        `SELECT 
          item_id as itemId,
          batch_id as batchId,
          an,
          hn,
          cid,
          patient_name as patientName,
          sex,
          age_y as age,
          DATE_FORMAT(regdate, '%Y-%m-%d') as admitDate,
          TIME_FORMAT(regtime, '%H:%i') as admitTime,
          DATE_FORMAT(dchdate, '%Y-%m-%d') as dischargeDate,
          TIME_FORMAT(dchtime, '%H:%i') as dischargeTime,
          ward_code as wardCode,
          ward_name as wardName,
          pdx,
          diagnosis_name as diagnosisName,
          pttype_name as pttypeName,
          dchstts as dischargeStatus,
          dchtype as dischargeType,
          length_of_stay as lengthOfStay,
          doctor_name as doctorName,
          audit_status as auditStatus,
          audit_id as auditId,
          audited_at as auditedAt
        FROM mra_ipd_sampling_item
        WHERE batch_id = ?
        ORDER BY dchdate DESC, dchtime DESC, regdate DESC`,
        [batchId]
      );

      return NextResponse.json({ success: true, data: items });
    }

    // List recent IPD batches
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
        b.ward_code as wardCode,
        b.ward_name as wardName,
        COALESCE(b.status, 'active') as status,
        COALESCE(b.note, '') as note,
        COALESCE(b.created_by, 'Auditor') as createdBy,
        DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') as createdAt,
        DATE_FORMAT(b.updated_at, '%Y-%m-%d %H:%i') as updatedAt,
        COUNT(CASE WHEN i.audit_status = 'audited' THEN 1 END) as auditedCount
      FROM mra_ipd_sampling_batch b
      LEFT JOIN mra_ipd_sampling_item i ON i.batch_id = b.batch_id
      GROUP BY b.batch_id
      ORDER BY b.sampling_date DESC
      LIMIT 100`
    );

    return NextResponse.json({ success: true, data: batches });
  } catch (error) {
    console.error('Error fetching IPD MRA batches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch IPD sampling batches' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mra/ipd-batches
 * Status & info updates for IPD batches
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, action, batchName, note, createdBy, status } = body;

    if (!batchId) {
      return NextResponse.json({ success: false, error: 'Missing batchId' }, { status: 400 });
    }

    // RBAC: Only Administrator can modify batches (cancel, reactivate, complete, update metadata)
    const session = await getServerSession();
    if (!session || !RBAC.isAdmin(session.role)) {
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'ipd_batch_update',
        status: 'denied',
        severity: 'warning',
        targetType: 'ipd_batch',
        targetId: batchId,
        summary: 'ถูกปฏิเสธ: ไม่มีสิทธิ์แก้ไขหรือเปลี่ยนสถานะชุดสุ่มเวชระเบียน IPD',
      });
      return forbiddenResponse('เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่มีสิทธิ์แก้ไขหรือเปลี่ยนแปลงสถานะชุดสุ่มเวชระเบียน IPD');
    }

    if (action === 'cancel') {
      await executeMra(
        `UPDATE mra_ipd_sampling_batch SET status = 'cancelled', updated_at = NOW() WHERE batch_id = ?`,
        [batchId]
      );
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'ipd_batch_cancel',
        severity: 'warning',
        targetType: 'ipd_batch',
        targetId: batchId,
        summary: `ยกเลิกรอบการสุ่ม IPD: ${batchId}`,
        details: { batchId },
      });
      return NextResponse.json({
        success: true,
        data: { message: 'ยกเลิกการสุ่มตรวจ IPD เรียบร้อยแล้ว' },
      });
    }

    if (action === 'reactivate') {
      await executeMra(
        `UPDATE mra_ipd_sampling_batch SET status = 'active', updated_at = NOW() WHERE batch_id = ?`,
        [batchId]
      );
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'ipd_batch_reactivate',
        severity: 'info',
        targetType: 'ipd_batch',
        targetId: batchId,
        summary: `คืนสถานะรอบการสุ่ม IPD เป็นเปิดใช้งาน: ${batchId}`,
        details: { batchId },
      });
      return NextResponse.json({
        success: true,
        data: { message: 'เปิดใช้งานการสุ่มตรวจ IPD เรียบร้อยแล้ว' },
      });
    }

    if (action === 'complete') {
      await executeMra(
        `UPDATE mra_ipd_sampling_batch SET status = 'completed', updated_at = NOW() WHERE batch_id = ?`,
        [batchId]
      );
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'ipd_batch_complete',
        severity: 'info',
        targetType: 'ipd_batch',
        targetId: batchId,
        summary: `บันทึกสถานะรอบการสุ่ม IPD ว่าตรวจเสร็จสมบูรณ์: ${batchId}`,
        details: { batchId },
      });
      return NextResponse.json({
        success: true,
        data: { message: 'ปิดการสุ่มตรวจ IPD สำเร็จเรียบร้อยแล้ว' },
      });
    }

    if (action === 'update') {
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
      if (status && ['active', 'completed', 'cancelled'].includes(status)) {
        updates.push('status = ?');
        params.push(status);
      }

      if (updates.length === 0) {
        return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
      }

      updates.push('updated_at = NOW()');
      params.push(batchId);

      await executeMra(
        `UPDATE mra_ipd_sampling_batch SET ${updates.join(', ')} WHERE batch_id = ?`,
        params
      );

      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'ipd_batch_update',
        severity: 'info',
        targetType: 'ipd_batch',
        targetId: batchId,
        summary: `แก้ไขข้อมูลรอบการสุ่ม IPD: ${batchId}`,
        details: { batchId, batchName, note, createdBy, status },
      });

      return NextResponse.json({
        success: true,
        data: { message: 'แก้ไขข้อมูลการสุ่มตรวจ IPD เรียบร้อยแล้ว' },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action specified' }, { status: 400 });
  } catch (error) {
    console.error('Error updating IPD batch:', error);
    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'ipd_batch_update',
      status: 'failed',
      severity: 'warning',
      summary: 'แก้ไขข้อมูลรอบการสุ่ม IPD ไม่สำเร็จ',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { success: false, error: 'Failed to update IPD batch' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mra/ipd-batches?batchId=...
 * Clean deletion of IPD batch and items
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const force = searchParams.get('force') === 'true';

    // RBAC: Only Administrator can delete IPD batches
    const session = await getServerSession();
    if (!session || !RBAC.canDeleteBatch(session.role)) {
      void logAuditEvent({
        req,
        category: 'SAMPLING',
        action: 'ipd_batch_delete',
        status: 'denied',
        severity: 'warning',
        targetType: 'ipd_batch',
        targetId: batchId,
        summary: 'ถูกปฏิเสธ: ไม่มีสิทธิ์ลบชุดสุ่มเวชระเบียน IPD',
      });
      return forbiddenResponse('เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่มีสิทธิ์ลบชุดสุ่มเวชระเบียน IPD');
    }

    if (!batchId) {
      return NextResponse.json({ success: false, error: 'Missing batchId' }, { status: 400 });
    }

    // Check if any items have been audited
    const audited = await queryMra<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM mra_ipd_sampling_item 
       WHERE batch_id = ? AND audit_status = 'audited'`,
      [batchId]
    );

    const auditedCount = audited[0]?.count || 0;
    if (auditedCount > 0 && !force) {
      return NextResponse.json(
        {
          success: false,
          hasAuditedItems: true,
          auditedCount,
          error: `ชุดนี้มีการตรวจประเมินไปแล้ว ${auditedCount} เคส ท่านสามารถเข้าไปยกเลิกการตรวจรายเคสก่อน หรือเลือก "ยกเลิก" แทน หรือกดยืนยันเพื่อลบถาวร`,
        },
        { status: 409 }
      );
    }

    // Clean up audit records and items associated with this batch using MySQL Transaction
    const pool = getMraPool();
    const conn = await pool.getConnection();
    let deletedAuditIdsCount = 0;
    let totalItems = 0;
    try {
      await conn.query('SET NAMES utf8mb4');
      await conn.beginTransaction();

      // Retrieve all items in this batch to identify related audits by audit_id, item_id, or an
      const [batchItems] = await conn.query<RowDataPacket[]>(
        `SELECT item_id, an, audit_id FROM mra_ipd_sampling_item WHERE batch_id = ?`,
        [batchId]
      );
      totalItems = batchItems.length;

      const auditIds = new Set<string>();
      for (const it of batchItems) {
        if (it.audit_id) auditIds.add(it.audit_id);
      }

      // Check mra_ipd_audit for any linked item_id or an
      for (const it of batchItems) {
        if (it.item_id || it.an) {
          const [matched] = await conn.query<RowDataPacket[]>(
            `SELECT audit_id FROM mra_ipd_audit WHERE (item_id = ? AND item_id IS NOT NULL) OR an = ?`,
            [it.item_id || '', it.an || '']
          );
          for (const m of matched) {
            if (m.audit_id) auditIds.add(m.audit_id);
          }
        }
      }

      // Delete audit details and headers for all collected auditIds
      for (const aId of auditIds) {
        await conn.execute(`DELETE FROM mra_ipd_audit_detail WHERE audit_id = ?`, [aId]);
        await conn.execute(`DELETE FROM mra_ipd_audit WHERE audit_id = ?`, [aId]);
      }
      deletedAuditIdsCount = auditIds.size;

      // Delete sampled items in this batch
      await conn.execute(`DELETE FROM mra_ipd_sampling_item WHERE batch_id = ?`, [batchId]);

      // Delete the batch header
      await conn.execute(`DELETE FROM mra_ipd_sampling_batch WHERE batch_id = ?`, [batchId]);

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
      action: 'ipd_batch_delete',
      severity: 'critical',
      targetType: 'ipd_batch',
      targetId: batchId,
      summary: `ลบชุดสุ่มตรวจประเมิน IPD (${batchId}) รวมรายการ ${totalItems} รายการ และผลตรวจที่เกี่ยวข้อง ${deletedAuditIdsCount} รายการ`,
      details: { batchId, totalItems, auditedCount, deletedAuditIdsCount, force },
    });

    return NextResponse.json({
      success: true,
      data: { message: `ลบข้อมูลการสุ่มตรวจ IPD (${batchId}) เรียบร้อยแล้ว` },
    });
  } catch (error) {
    console.error('Error deleting IPD batch:', error);
    void logAuditEvent({
      req,
      category: 'SAMPLING',
      action: 'ipd_batch_delete',
      status: 'failed',
      severity: 'warning',
      summary: 'เกิดข้อผิดพลาดในการลบชุดสุ่มตรวจประเมิน IPD',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { success: false, error: 'Failed to delete IPD batch' },
      { status: 500 }
    );
  }
}
