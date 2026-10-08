import type { RowDataPacket } from 'mysql2/promise';
import { executeMra, queryMra } from '@/lib/db-mra';
import { getServerSession } from '@/lib/auth';

/**
 * MRA Audit Trail
 * ---------------------------------------------------------------------------
 * Central, append-only activity log (table: mra_audit_trail).
 *
 * Design guarantees:
 *  - NEVER throws: logging problems must not affect the main workflow.
 *  - Callers use `void logAuditEvent(...)` (fire-and-forget) so response time is unaffected.
 *  - Sensitive fields (passwords, keys, tokens) are redacted; patient names / CID are
 *    never expected here (only VN / AN / HN identifiers for traceability).
 *  - On DB failure the event is written to stdout as structured JSON (fallback).
 */

export type AuditCategory =
  | 'AUDIT'
  | 'SAMPLING'
  | 'BATCH'
  | 'SETTINGS'
  | 'BACKUP'
  | 'SECURITY'
  | 'EXPORT'
  | 'ACCESS'
  | 'AUTH'
  | 'SYSTEM';

export type AuditStatus = 'success' | 'failed' | 'denied';
export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditActor {
  loginname?: string | null;
  fullName?: string | null;
  role?: string | null;
}

export interface LogAuditParams {
  category: AuditCategory;
  action: string;
  summary: string;
  status?: AuditStatus;
  severity?: AuditSeverity;
  /** Explicit actor. When omitted, the actor is resolved from the current session. */
  actor?: AuditActor | null;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
  /** Incoming request, used for IP / user-agent / path / method. */
  req?: Request | null;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS mra_audit_trail (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    category VARCHAR(20) NOT NULL,
    action VARCHAR(60) NOT NULL,
    status ENUM('success','failed','denied') NOT NULL DEFAULT 'success',
    severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
    actor_loginname VARCHAR(50) NULL,
    actor_fullname VARCHAR(150) NULL,
    actor_role VARCHAR(30) NULL,
    target_type VARCHAR(40) NULL,
    target_id VARCHAR(100) NULL,
    summary VARCHAR(500) NOT NULL,
    details LONGTEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    request_method VARCHAR(10) NULL,
    request_path VARCHAR(200) NULL,
    INDEX idx_audit_trail_time (event_time),
    INDEX idx_audit_trail_actor (actor_loginname, event_time),
    INDEX idx_audit_trail_cat_action (category, action, event_time),
    INDEX idx_audit_trail_target (target_type, target_id),
    INDEX idx_audit_trail_status (status, severity)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let ensurePromise: Promise<void> | null = null;

function ensureAuditTrailTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = executeMra(CREATE_TABLE_SQL)
      .then(() => undefined)
      .catch((err) => {
        ensurePromise = null; // allow retry later (e.g. after pool reload)
        throw err;
      });
  }
  return ensurePromise;
}

const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|cookie|adminkey|key_value|apikey|api_key)/i;
const MAX_STRING = 500;
const MAX_DEPTH = 4;
const MAX_DETAILS_CHARS = 8000;

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…(+${value.length - MAX_STRING})` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[depth-limit]';
  if (Array.isArray(value)) {
    const items = value.slice(0, 50).map((v) => sanitize(v, depth + 1));
    if (value.length > 50) items.push(`[+${value.length - 50} more]`);
    return items;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : sanitize(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function serializeDetails(details?: Record<string, unknown>): string | null {
  if (!details || Object.keys(details).length === 0) return null;
  try {
    const json = JSON.stringify(sanitize(details));
    if (json.length <= MAX_DETAILS_CHARS) return json;
    return JSON.stringify({ truncated: true, preview: json.slice(0, MAX_DETAILS_CHARS) });
  } catch {
    return null;
  }
}

/**
 * Normalizes an IP address according to enterprise logging standards:
 * - Trims whitespace and extracts first client IP from comma-separated proxy chains
 * - Strips IPv4/IPv6 port numbers if attached (e.g. 192.168.1.1:52100 -> 192.168.1.1)
 * - Converts IPv4-mapped IPv6 address (::ffff:192.168.1.100) to IPv4 (192.168.1.100)
 * - Converts IPv6 loopback (::1 or 0:0:0:0:0:0:0:1) to standard readable IPv4 loopback (127.0.0.1)
 */
export function normalizeIp(rawIp?: string | null): string {
  if (!rawIp) return '127.0.0.1';
  let ip = rawIp.trim();

  // If comma-separated list (e.g. from X-Forwarded-For: client, proxy1, proxy2), pick the first (client)
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  // Strip port from IPv4 with port (e.g., 192.168.1.100:54321)
  if (/^(\d{1,3}\.){3}\d{1,3}:\d+$/.test(ip)) {
    ip = ip.split(':')[0];
  }

  // Strip brackets and port from IPv6 (e.g., [::1]:54321 or [2001:db8::1]:80)
  if (/^\[.+\]:\d+$/.test(ip)) {
    ip = ip.replace(/^\[(.*)\]:\d+$/, '$1');
  }

  // Strip IPv4-mapped IPv6 prefix (e.g. ::ffff:192.168.1.100 -> 192.168.1.100)
  if (ip.toLowerCase().startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Normalize IPv6 loopback to readable IPv4 localhost (::1 -> 127.0.0.1)
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') {
    return '127.0.0.1';
  }

  return ip.slice(0, 45) || '127.0.0.1';
}

/**
 * Extracts the real client IP address with comprehensive reverse proxy, load balancer, and cloud support:
 * 1. Cloudflare (CF-Connecting-IP, True-Client-IP)
 * 2. Nginx / Apache / Traefik / HAProxy / IIS (X-Forwarded-For, X-Real-IP)
 * 3. RFC 7239 Forwarded header
 * 4. NextRequest IP property
 * 5. Normalizes ::1 and ::ffff: prefixes to standard clean format
 */
export function getClientIp(req?: Request | null): string {
  if (!req) return '127.0.0.1';

  const headers = req.headers;
  const rawCandidate =
    headers.get('cf-connecting-ip') ||
    headers.get('true-client-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-client-ip') ||
    headers.get('x-forwarded-for') ||
    headers.get('x-cluster-client-ip') ||
    headers.get('forwarded')?.match(/for="?([^;,"]+)/i)?.[1] ||
    (req as { ip?: string }).ip ||
    null;

  return normalizeIp(rawCandidate);
}

export function getClientInfo(req?: Request | null): {
  ipAddress: string | null;
  userAgent: string | null;
  method: string | null;
  path: string | null;
} {
  if (!req) return { ipAddress: null, userAgent: null, method: null, path: null };
  const ipAddress = getClientIp(req);
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 255) || null;
  let path: string | null = null;
  try {
    path = new URL(req.url).pathname.slice(0, 200);
  } catch {
    path = null;
  }
  return { ipAddress, userAgent, method: req.method || null, path };
}

async function insertEvent(params: unknown[]): Promise<void> {
  await executeMra(
    `INSERT INTO mra_audit_trail
      (category, action, status, severity, actor_loginname, actor_fullname, actor_role,
       target_type, target_id, summary, details, ip_address, user_agent, request_method, request_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params
  );
}

/**
 * Record an audit event. Safe to call without await: `void logAuditEvent({...})`.
 */
export async function logAuditEvent(p: LogAuditParams): Promise<void> {
  let record: Record<string, unknown> = { category: p.category, action: p.action };
  try {
    let actor = p.actor;
    if (actor === undefined) {
      try {
        const session = await getServerSession();
        actor = session
          ? { loginname: session.loginname, fullName: session.fullName, role: session.role }
          : null;
      } catch {
        actor = null;
      }
    }

    const info = getClientInfo(p.req);
    const params = [
      p.category,
      p.action.slice(0, 60),
      p.status || 'success',
      p.severity || 'info',
      actor?.loginname ? String(actor.loginname).slice(0, 50) : null,
      actor?.fullName ? String(actor.fullName).slice(0, 150) : null,
      actor?.role ? String(actor.role).slice(0, 30) : null,
      p.targetType ? p.targetType.slice(0, 40) : null,
      p.targetId ? String(p.targetId).slice(0, 100) : null,
      p.summary.slice(0, 500),
      serializeDetails(p.details),
      info.ipAddress,
      info.userAgent,
      info.method,
      info.path,
    ];
    record = { ...record, params };

    try {
      await ensureAuditTrailTable();
      await insertEvent(params);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'ER_NO_SUCH_TABLE') {
        ensurePromise = null;
        await ensureAuditTrailTable();
        await insertEvent(params);
      } else {
        throw err;
      }
    }
  } catch (err) {
    // Fallback: never lose the event entirely, never break the caller.
    console.error('[AUDIT TRAIL FALLBACK]', JSON.stringify(record), (err as Error)?.message || err);
  }
}

// ── Query side (Administrator viewer API) ───────────────────────────────────

export interface AuditTrailFilters {
  category?: string;
  action?: string;
  status?: string;
  severity?: string;
  actor?: string;
  target?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function queryAuditTrail(f: AuditTrailFilters) {
  await ensureAuditTrailTable().catch(() => undefined);

  const where: string[] = [];
  const args: unknown[] = [];

  if (f.category) {
    where.push('category = ?');
    args.push(f.category);
  }
  if (f.action) {
    where.push('action = ?');
    args.push(f.action);
  }
  if (f.status && ['success', 'failed', 'denied'].includes(f.status)) {
    where.push('status = ?');
    args.push(f.status);
  }
  if (f.severity && ['info', 'warning', 'critical'].includes(f.severity)) {
    where.push('severity = ?');
    args.push(f.severity);
  }
  if (f.actor) {
    where.push('(actor_loginname = ? OR actor_fullname LIKE ?)');
    args.push(f.actor, `%${f.actor}%`);
  }
  if (f.target) {
    where.push('target_id LIKE ?');
    args.push(`%${f.target}%`);
  }
  if (f.q && f.q.trim()) {
    const term = `%${f.q.trim()}%`;
    where.push('(summary LIKE ? OR target_id LIKE ? OR actor_loginname LIKE ? OR actor_fullname LIKE ? OR action LIKE ? OR ip_address LIKE ?)');
    args.push(term, term, term, term, term, term);
  }
  if (f.dateFrom) {
    where.push('event_time >= ?');
    args.push(`${f.dateFrom} 00:00:00`);
  }
  if (f.dateTo) {
    where.push('event_time <= ?');
    args.push(`${f.dateTo} 23:59:59.999`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pageSize = Math.min(Math.max(Number(f.pageSize) || 50, 1), 100);
  const page = Math.max(Number(f.page) || 1, 1);
  const offset = (page - 1) * pageSize;

  const [countRow] = await queryMra<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM mra_audit_trail ${whereSql}`,
    args
  );
  const rows = await queryMra<RowDataPacket[]>(
    `SELECT id, DATE_FORMAT(event_time, '%Y-%m-%d %H:%i:%s') AS eventTime, category, action, status, severity,
            actor_loginname AS actorLoginname, actor_fullname AS actorFullname, actor_role AS actorRole,
            target_type AS targetType, target_id AS targetId, summary, details,
            ip_address AS ipAddress, user_agent AS userAgent, request_method AS requestMethod, request_path AS requestPath
     FROM mra_audit_trail ${whereSql}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, offset]
  );

  const [statsRow] = await queryMra<RowDataPacket[]>(
    `SELECT 
      COUNT(*) AS totalAll,
      COUNT(CASE WHEN DATE(event_time) = CURDATE() THEN 1 END) AS todayCount,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failedCount,
      COUNT(CASE WHEN status = 'denied' THEN 1 END) AS deniedCount,
      COUNT(CASE WHEN severity = 'critical' THEN 1 END) AS criticalCount
     FROM mra_audit_trail`
  ).catch(() => [null]);

  return {
    rows,
    total: Number(countRow?.total || 0),
    page,
    pageSize,
    stats: statsRow
      ? {
          totalAll: Number(statsRow.totalAll || 0),
          todayCount: Number(statsRow.todayCount || 0),
          failedCount: Number(statsRow.failedCount || 0),
          deniedCount: Number(statsRow.deniedCount || 0),
          criticalCount: Number(statsRow.criticalCount || 0),
        }
      : undefined,
  };
}
