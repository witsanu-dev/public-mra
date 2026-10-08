import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getUser2FaInfo } from '@/lib/totp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' }, { status: 401 });
    }

    const info = await getUser2FaInfo(session.loginname);

    return NextResponse.json({
      success: true,
      loginname: session.loginname,
      fullName: session.fullName,
      isEnabled: info.isEnabled,
      enrolledAt: info.enrolledAt,
      backupCodesRemaining: info.backupCodesRemaining,
    });
  } catch (error) {
    console.error('[2FA Status API Error]:', error);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถดึงข้อมูลสถานะ 2FA ได้' },
      { status: 500 }
    );
  }
}
