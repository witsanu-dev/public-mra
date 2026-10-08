import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { RBAC } from '@/lib/rbac';
import { listAll2FaUsers, disableUser2Fa } from '@/lib/totp';
import { logAuditEvent } from '@/lib/audit-trail';

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

    const users = await listAll2FaUsers();

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('[2FA Admin List Error]:', error);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถดึงรายชื่อผู้ใช้ 2FA ได้' },
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

    const body = await req.json().catch(() => ({}));
    const { targetLoginname, action } = body;

    if (!targetLoginname || typeof targetLoginname !== 'string') {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุชื่อผู้ใช้งาน (targetLoginname)' },
        { status: 400 }
      );
    }

    if (action === 'reset') {
      const ok = await disableUser2Fa(targetLoginname);
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'ไม่สามารถรีเซ็ต 2FA ของผู้ใช้นี้ได้' },
          { status: 500 }
        );
      }

      // Record administrative audit trail
      void logAuditEvent({
        req,
        category: 'SECURITY',
        action: '2fa_admin_reset',
        status: 'success',
        severity: 'warning',
        summary: `ผู้ดูแลระบบ ${session.loginname} (${session.fullName}) รีเซ็ตและปลดล็อค 2FA สำหรับผู้ใช้ @${targetLoginname}`,
        actor: {
          loginname: session.loginname,
          fullName: session.fullName,
          role: session.role,
        },
        targetType: 'user',
        targetId: targetLoginname,
      });

      return NextResponse.json({
        success: true,
        message: `รีเซ็ตการยืนยันตัวตน 2FA ของ @${targetLoginname} เรียบร้อยแล้ว`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'คำสั่งไม่ถูกต้อง' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[2FA Admin Action Error]:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดำเนินการ' },
      { status: 500 }
    );
  }
}
