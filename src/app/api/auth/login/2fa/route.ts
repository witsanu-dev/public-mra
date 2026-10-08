import { NextRequest, NextResponse } from 'next/server';
import {
  verify2FaTempToken,
  signSession,
  logAuthEvent,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
} from '@/lib/auth';
import { verifyLogin2Fa } from '@/lib/totp';
import { getClientIp } from '@/lib/audit-trail';

export async function POST(req: NextRequest) {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const tempToken = (body.tempToken || '').trim();
    const code = (body.code || '').trim();

    if (!tempToken || !code) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกรหัสยืนยัน OTP หรือรหัสสำรอง' },
        { status: 400 }
      );
    }

    // 1. Verify temporary 5-minute login token
    const pendingPayload = verify2FaTempToken(tempToken);
    if (!pendingPayload) {
      return NextResponse.json(
        {
          success: false,
          error: 'เวลาการยืนยันตัวตนหมดอายุ (เกิน 5 นาที) กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านใหม่อีกครั้ง',
        },
        { status: 401 }
      );
    }

    const { loginname, authUser } = pendingPayload;

    // 2. Verify OTP code or Backup recovery code
    const verifyResult = await verifyLogin2Fa(loginname, code);
    if (!verifyResult.success) {
      await logAuthEvent({
        loginname,
        userFullname: authUser.fullName,
        doctorCode: authUser.doctorCode,
        positionId: authUser.positionId,
        positionName: authUser.positionName,
        role: authUser.role,
        action: 'failed',
        ipAddress,
        userAgent,
        status: 'failed',
        failReason: verifyResult.error || 'รหัส 2FA OTP ไม่ถูกต้อง',
      });

      return NextResponse.json(
        { success: false, error: verifyResult.error || 'รหัสยืนยันตัวตนไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    // 3. 2FA verification succeeded: Log success to audit trail
    const methodDesc = verifyResult.method === 'backup_code' ? '2FA (Backup Recovery Code)' : '2FA (Google Authenticator)';
    await logAuthEvent({
      loginname,
      userFullname: authUser.fullName,
      doctorCode: authUser.doctorCode,
      positionId: authUser.positionId,
      positionName: authUser.positionName,
      role: authUser.role,
      action: 'login',
      ipAddress,
      userAgent,
      status: 'success',
      failReason: `ผ่านการยืนยันตัวตน 2 ขั้นตอน: ${methodDesc}`,
    });

    // 4. Issue full session cookie
    const token = signSession(authUser);
    const response = NextResponse.json({
      success: true,
      user: authUser,
      method: verifyResult.method,
      remainingBackupCodes: verifyResult.remainingBackupCodes,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: false, // Must be false for hospital internal HTTP intranet
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SEC,
    });

    return response;
  } catch (error: unknown) {
    console.error('Error during 2FA login verification:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบ 2FA กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
