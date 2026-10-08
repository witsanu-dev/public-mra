import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminOrEmergencyKey } from '@/lib/auth';
import { testDbConnection } from '@/lib/db-config';
import { logAuditEvent } from '@/lib/audit-trail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, config, adminKey } = body || {};

    const authCheck = await verifyAdminOrEmergencyKey(req, adminKey);
    if (!authCheck.authorized) {
      void logAuditEvent({
        req,
        category: 'SETTINGS',
        action: 'db_connection_test',
        status: 'denied',
        severity: 'warning',
        summary: 'ถูกปฏิเสธ: พยายามทดสอบการเชื่อมต่อฐานข้อมูลโดยไม่มีสิทธิ์',
      });
      return NextResponse.json(
        {
          success: false,
          error: authCheck.reason || 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ทดสอบการเชื่อมต่อฐานข้อมูล',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    if (!type || !config || (type !== 'his' && type !== 'mra')) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลคำขอไม่ถูกต้อง: ต้องระบุ type ("his" หรือ "mra") และ config' },
        { status: 400 }
      );
    }

    if (!config.host || !config.database || !config.user) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ Host, Database Name และ Username ให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // Execute safe transient connection test
    const result = await testDbConnection(type, {
      host: String(config.host).trim(),
      port: Number(config.port) || 3306,
      database: String(config.database).trim(),
      user: String(config.user).trim(),
      password: config.password !== undefined ? String(config.password) : undefined,
    });

    void logAuditEvent({
      req,
      category: 'SETTINGS',
      action: 'db_connection_test',
      status: result.success ? 'success' : 'failed',
      severity: 'info',
      targetType: 'db_connection',
      targetId: type,
      summary: `ทดสอบการเชื่อมต่อฐานข้อมูล ${String(type).toUpperCase()} ${result.success ? 'สำเร็จ' : 'ไม่สำเร็จ'}`,
      details: {
        host: config.host,
        port: Number(config.port) || 3306,
        database: config.database,
        user: config.user,
        message: result.message,
      },
    });

    return NextResponse.json({
      success: result.success,
      data: result,
      error: !result.success ? result.message : undefined,
    });
  } catch (err: any) {
    console.error('[API POST /api/settings/db/test Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการทดสอบการเชื่อมต่อฐานข้อมูล' },
      { status: 500 }
    );
  }
}
