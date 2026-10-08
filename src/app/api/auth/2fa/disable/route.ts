import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { disableUser2Fa, verifyLogin2Fa } from '@/lib/totp';
import { logAuditEvent } from '@/lib/audit-trail';
import { queryHis } from '@/lib/db-his';
import { verifyHosPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { code, password } = body;

    // Check verification: must provide either a valid 2FA code (OTP/backup) or password
    let isVerified = false;

    if (code && typeof code === 'string') {
      const verifyRes = await verifyLogin2Fa(session.loginname, code);
      if (verifyRes.success) {
        isVerified = true;
      }
    }

    if (!isVerified && password && typeof password === 'string') {
      // 1. Check password against HIS database if available
      try {
        const rows = await queryHis<any[]>(
          `SELECT password, passweb FROM opduser WHERE loginname = ? LIMIT 1`,
          [session.loginname]
        );
        if (rows.length > 0) {
          const ok = verifyHosPassword(password, rows[0].password, rows[0].passweb);
          if (ok) isVerified = true;
        }
      } catch (err) {
        // HIS unreachable, proceed to local check
      }

      // 2. Fallback: check password against local users in db_mra
      if (!isVerified) {
        try {
          const { queryMra } = await import('@/lib/db-mra');
          const { verifyPassword } = await import('@/lib/user-sync');
          const uRows = await queryMra<any[]>(
            `SELECT password_hash, salt FROM users WHERE username = ? AND is_active = 1 LIMIT 1`,
            [session.loginname]
          );
          if (uRows.length > 0 && verifyPassword(password, uRows[0].password_hash, uRows[0].salt)) {
            isVerified = true;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!isVerified) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกรหัส OTP 6 หลัก หรือรหัสผ่านปัจจุบันให้ถูกต้องเพื่อยืนยันการปิดใช้งาน' },
        { status: 400 }
      );
    }

    const ok = await disableUser2Fa(session.loginname);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถปิดใช้งาน 2FA ได้ กรุณาลองใหม่อีกครั้ง' },
        { status: 500 }
      );
    }

    // Log security audit trail
    void logAuditEvent({
      req,
      category: 'SECURITY',
      action: '2fa_disabled',
      status: 'success',
      severity: 'warning',
      summary: `ผู้ใช้ ${session.loginname} (${session.fullName}) ปิดการใช้งาน 2FA`,
      actor: {
        loginname: session.loginname,
        fullName: session.fullName,
        role: session.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'ปิดใช้งานการยืนยันตัวตน 2 ขั้นตอนเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('[2FA Disable API Error]:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการปิดใช้งาน 2FA' },
      { status: 500 }
    );
  }
}
