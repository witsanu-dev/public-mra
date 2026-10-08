import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { start2FaEnrollment } from '@/lib/totp';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' }, { status: 401 });
    }

    const enrollment = await start2FaEnrollment(session.loginname, session.fullName);

    return NextResponse.json({
      success: true,
      loginname: session.loginname,
      secret: enrollment.secret,
      qrCodeDataUrl: enrollment.qrCodeDataUrl,
      otpauthUrl: enrollment.otpauthUrl,
    });
  } catch (error) {
    console.error('[2FA Setup API Error]:', error);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถสร้างข้อมูลลงทะเบียน 2FA ได้' },
      { status: 500 }
    );
  }
}
