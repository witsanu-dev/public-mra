import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { RBAC, forbiddenResponse } from '@/lib/rbac';
import { queryAuditTrail, logAuditEvent, AuditCategory, AuditSeverity, AuditStatus } from '@/lib/audit-trail';

/**
 * GET /api/settings/audit-trail
 * Retrieve audit log events for system administrator inspection.
 * Supports filtering by category, status, severity, user, target, date range, and search keyword.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !RBAC.isAdmin(session.role)) {
      return forbiddenResponse('เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นที่มีสิทธิ์เข้าถึง Audit Trail Logs');
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') as AuditCategory | null;
    const action = searchParams.get('action') || undefined;
    const actor = searchParams.get('actor') || searchParams.get('username') || undefined;
    const target = searchParams.get('target') || undefined;
    const status = searchParams.get('status') as AuditStatus | null;
    const severity = searchParams.get('severity') as AuditSeverity | null;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const q = searchParams.get('q') || searchParams.get('search') || undefined;
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '50', 10) || 50, 1), 100);

    const isExport = searchParams.get('export') === 'true';
    if (isExport) {
      const exportLimit = Math.min(Math.max(parseInt(searchParams.get('exportLimit') || '1000', 10) || 1000, 1), 2000);
      const exportResult = await queryAuditTrail({
        category: category || undefined,
        action,
        actor,
        target,
        status: status || undefined,
        severity: severity || undefined,
        dateFrom,
        dateTo,
        q,
        page: 1,
        pageSize: exportLimit,
      });

      void logAuditEvent({
        req,
        category: 'EXPORT',
        action: 'audit_trail_export',
        severity: 'info',
        summary: `ส่งออกข้อมูลประวัติ Audit Trail (${exportResult.rows.length} รายการ)`,
        details: { count: exportResult.rows.length, category, status, severity, dateFrom, dateTo, q },
      });

      return NextResponse.json({
        success: true,
        data: {
          items: exportResult.rows,
          total: exportResult.rows.length,
          exportedAt: new Date().toISOString(),
        },
      });
    }

    const result = await queryAuditTrail({
      category: category || undefined,
      action,
      actor,
      target,
      status: status || undefined,
      severity: severity || undefined,
      dateFrom,
      dateTo,
      q,
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: result.rows,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        stats: result.stats,
      },
    });
  } catch (error) {
    console.error('Error querying audit trail:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูล Audit Trail',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/audit-trail
 * Allows client application to report client-triggered audit events (e.g. Excel export, report download, UI actions)
 * Non-blocking, sanitized, and session-enforced.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      category = 'EXPORT',
      action = 'export_data',
      status = 'success',
      severity = 'info',
      targetType,
      targetId,
      summary,
      details,
    } = body;

    // Validate category
    const validCategories: AuditCategory[] = [
      'AUDIT',
      'SAMPLING',
      'BATCH',
      'SETTINGS',
      'BACKUP',
      'SECURITY',
      'EXPORT',
      'ACCESS',
      'AUTH',
      'SYSTEM',
    ];
    const safeCategory: AuditCategory = validCategories.includes(category) ? category : 'EXPORT';

    void logAuditEvent({
      req,
      category: safeCategory,
      action: String(action || 'export_data').slice(0, 100),
      status: (status === 'failed' || status === 'denied' ? status : 'success') as AuditStatus,
      severity: (severity === 'warning' || severity === 'critical' ? severity : 'info') as AuditSeverity,
      targetType: targetType ? String(targetType).slice(0, 50) : undefined,
      targetId: targetId ? String(targetId).slice(0, 100) : undefined,
      summary: summary ? String(summary).slice(0, 255) : `ดาวน์โหลดหรือส่งออกข้อมูล (${safeCategory})`,
      details: typeof details === 'object' && details !== null ? details : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging client audit event:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record audit event',
      },
      { status: 500 }
    );
  }
}
