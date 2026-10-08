import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, verifyAdminOrEmergencyKey } from '@/lib/auth';
import { getCurrentDbSettings, getHybridDbSettings, saveDbSettings } from '@/lib/db-config';
import { logAuditEvent } from '@/lib/audit-trail';

/** Connection fields safe to record (never the password) */
function describeConn(c: any) {
  return c ? { host: c.host, port: c.port, database: c.database, user: c.user } : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyAdminOrEmergencyKey(req);
    if (!authCheck.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: authCheck.reason || 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์เข้าถึงการตั้งค่าฐานข้อมูล',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Read from sys_db_connections table in db_mra with seamless fallback to .env.local
    const settings = await getHybridDbSettings(false);
    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (err: any) {
    console.error('[API GET /api/settings/db Error]:', err);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถโหลดการตั้งค่าฐานข้อมูลได้: ' + (err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { his, mra, adminKey } = body || {};

    const authCheck = await verifyAdminOrEmergencyKey(req, adminKey);
    if (!authCheck.authorized) {
      void logAuditEvent({
        req,
        category: 'SETTINGS',
        action: 'db_settings_update',
        status: 'denied',
        severity: 'warning',
        summary: 'ถูกปฏิเสธ: พยายามบันทึกการตั้งค่าฐานข้อมูลโดยไม่มีสิทธิ์',
      });
      return NextResponse.json(
        {
          success: false,
          error: authCheck.reason || 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์บันทึกการตั้งค่าฐานข้อมูล',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    if (!his && !mra) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลการตั้งค่าไม่ถูกต้อง: กรุณาระบุการตั้งค่า HIS หรือ MRA' },
        { status: 400 }
      );
    }

    // Save and reload connection pools
    const result = await saveDbSettings({ his, mra });

    // Audit log (central audit trail; never includes passwords)
    const session = await getServerSession();
    void logAuditEvent({
      req,
      actor: session
        ? { loginname: session.loginname, fullName: session.fullName, role: session.role }
        : { loginname: 'emergency_admin', fullName: 'ผู้ดูแลระบบฉุกเฉิน (Admin Security Key)', role: 'Administrator' },
      category: 'SETTINGS',
      action: 'db_settings_update',
      severity: 'critical',
      targetType: 'db_connection',
      targetId: [his ? 'his' : null, mra ? 'mra' : null].filter(Boolean).join(','),
      summary: 'ปรับปรุงการตั้งค่าการเชื่อมต่อฐานข้อมูล (Hot-Reload)',
      details: { his: describeConn(his), mra: describeConn(mra), viaEmergencyKey: !session },
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err: any) {
    console.error('[API POST /api/settings/db Error]:', err);
    void logAuditEvent({
      req,
      category: 'SETTINGS',
      action: 'db_settings_update',
      status: 'failed',
      severity: 'warning',
      summary: 'บันทึกการตั้งค่าฐานข้อมูลไม่สำเร็จ',
      details: { error: err?.message || String(err) },
    });
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่าฐานข้อมูล' },
      { status: 500 }
    );
  }
}
