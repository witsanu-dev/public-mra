import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, logAuthEvent, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getClientIp } from '@/lib/audit-trail';

export async function POST(req: NextRequest) {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  try {
    const user = await getServerSession();

    if (user) {
      await logAuthEvent({
        loginname: user.loginname,
        userFullname: user.fullName,
        doctorCode: user.doctorCode,
        positionId: user.positionId,
        positionName: user.positionName,
        role: user.role,
        action: 'logout',
        ipAddress,
        userAgent,
        status: 'success',
      });
    }

    const response = NextResponse.json({
      success: true,
      message: 'ออกจากระบบเรียบร้อยแล้ว',
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: false, // Must be false for hospital internal HTTP intranet (10.250.101.18)
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Error during logout:', error);
    const response = NextResponse.json({ success: true, message: 'ออกจากระบบแล้ว' });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: false, // Must be false for hospital internal HTTP intranet (10.250.101.18)
      sameSite: 'lax',
    });
    return response;
  }
}
