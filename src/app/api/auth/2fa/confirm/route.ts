import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { confirmAndActivate2Fa } from '@/lib/totp';
import { logAuditEvent } from '@/lib/audit-trail';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกรหัส OTP 6 หลักจาก Google Authenticator' },
        { status: 400 }
      );
    }

    const result = await confirmAndActivate2Fa(session.loginname, token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'รหัส OTP ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Log security audit trail
    void logAuditEvent({
      req,
      category: 'SECURITY',
      action: '2fa_enrolled',
      status: 'success',
      severity: 'info',
      summary: `ผู้ใช้ ${session.loginname} (${session.fullName}) เปิดใช้งานการยืนยันตัวตน 2 ขั้นตอน (2FA TOTP) สำเร็จ`,
      actor: {
        loginname: session.loginname,
        fullName: session.fullName,
        role: session.role,
      },
      details: {
        backupCodesGenerated: 8,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'เปิดใช้งานการยืนยันตัวตน 2 ขั้นตอนสำเร็จ',
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    console.error('[2FA Confirm API Error]:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการยืนยันเปิดใช้งาน 2FA' },
      { status: 500 }
    );
  }
}
