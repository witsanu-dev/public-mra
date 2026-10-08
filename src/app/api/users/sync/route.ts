import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { RBAC } from '@/lib/rbac';
import { syncAllUsersFromHis } from '@/lib/user-sync';
import { logAuditEvent } from '@/lib/audit-trail';
import { queryMra } from '@/lib/db-mra';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !RBAC.canManageSettings(session.role)) {
      return NextResponse.json(
        { success: false, error: 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถดูข้อมูลนี้ได้' },
        { status: 403 }
      );
    }

    const rows = await queryMra<any[]>(
      `SELECT id, username, full_name, doctor_code, position_id, position_name, role, role_description, auth_source, is_active, last_sync_at, last_login_at
       FROM users
       ORDER BY id ASC`
    );

    return NextResponse.json({
      success: true,
      users: rows,
      totalCount: rows.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'ไม่สามารถดึงรายชื่อผู้ใช้ได้' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !RBAC.canManageSettings(session.role)) {
      return NextResponse.json(
        { success: false, error: 'เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่สามารถดำเนินการนี้ได้' },
        { status: 403 }
      );
    }

    const result = await syncAllUsersFromHis();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'การซิงค์ข้อมูลล้มเหลว' },
        { status: 500 }
      );
    }

    void logAuditEvent({
      req,
      category: 'SETTINGS',
      action: 'user_sync_his',
      status: 'success',
      severity: 'info',
      summary: `ผู้ดูแลระบบ ${session.loginname} ซิงค์รายชื่อผู้ใช้งานจาก HIS เฉพาะผู้ใช้ที่เปิดใช้งาน (${result.syncedCount} บัญชี, ข้าม/ตัดออก ${result.disabledSkippedCount || 0} บัญชีที่ปิดใช้งาน)`,
      actor: {
        loginname: session.loginname,
        fullName: session.fullName,
        role: session.role,
      },
      details: {
        syncedCount: result.syncedCount,
        disabledSkippedCount: result.disabledSkippedCount || 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: `ซิงค์ข้อมูลผู้ใช้งานที่เปิดใช้งานจาก HIS เรียบร้อยแล้ว (${result.syncedCount} บัญชี, ไม่นำเข้า/ตัดออก ${result.disabledSkippedCount || 0} บัญชีที่ปิดใช้งาน)`,
      syncedCount: result.syncedCount,
      disabledSkippedCount: result.disabledSkippedCount || 0,
    });
  } catch (err: any) {
    console.error('[Sync All Users API Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลผู้ใช้งาน' },
      { status: 500 }
    );
  }
}
