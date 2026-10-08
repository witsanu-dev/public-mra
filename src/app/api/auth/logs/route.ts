import { NextRequest, NextResponse } from 'next/server';
import { queryMra } from '@/lib/db-mra';
import { getServerSession } from '@/lib/auth';
import { RBAC, forbiddenResponse } from '@/lib/rbac';
import { RowDataPacket } from 'mysql2/promise';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !RBAC.isAdmin(session.role)) {
      return forbiddenResponse('สิทธิ์ของคุณไม่สามารถเข้าถึงประวัติการเข้าใช้งานระบบได้ (เฉพาะ Administrator)');
    }
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const logs = await queryMra<RowDataPacket[]>(
      `SELECT 
        id, 
        actor_loginname AS loginname, 
        actor_fullname AS user_fullname, 
        JSON_UNQUOTE(JSON_EXTRACT(details, '$.doctorCode')) AS doctor_code,
        JSON_UNQUOTE(JSON_EXTRACT(details, '$.positionId')) AS position_id,
        JSON_UNQUOTE(JSON_EXTRACT(details, '$.positionName')) AS position_name,
        actor_role AS role, 
        CASE WHEN action = 'login_failed' THEN 'failed' ELSE action END AS action, 
        ip_address, 
        status, 
        JSON_UNQUOTE(JSON_EXTRACT(details, '$.failReason')) AS fail_reason, 
        DATE_FORMAT(event_time, '%Y-%m-%d %H:%i:%s') AS created_at
       FROM mra_audit_trail
       WHERE category = 'AUTH'
       ORDER BY event_time DESC
       LIMIT ?`,
      [limit]
    );

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching auth logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch auth logs' },
      { status: 500 }
    );
  }
}
