import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { executeMra } from '@/lib/db-mra';
import { RBAC } from '@/lib/rbac';
import {
  AuthUser,
  UserRole,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  SESSION_SECRET,
} from './auth-token';

export * from './auth-token';

/**
 * Determine role according to hospital standards:
 * doctor.position_id / hos.doctor_position_std:
 * 0  = นักวิชาการคอมพิวเตอร์ = Administrator
 * 1  = แพทย์ = Auditor
 * 39 = พยาบาลวิชาชีพ = Auditor
 * 42 = เจ้าพนักงานเวชสถิติ = Auditor
 * 58 = เจ้าหน้าที่เวชระเบียน = Auditor
 * other = Officer
 */
export function mapDoctorPositionToRole(
  positionId: number | null | undefined,
  loginname?: string,
  accessright?: string,
  positionName?: string | null
): { role: UserRole; roleDescription: string } {
  const normLogin = (loginname || '').trim().toLowerCase();
  const posText = (positionName || '').trim().toLowerCase();

  // 1. Administrator: position_id 0, or positionName like คอมพิวเตอร์, or system admin accounts
  if (
    positionId === 0 ||
    posText.includes('คอมพิวเตอร์') ||
    normLogin === 'admin' ||
    normLogin === 'sa' ||
    (accessright && accessright.toUpperCase().includes('ADMIN'))
  ) {
    return {
      role: 'Administrator',
      roleDescription: 'ผู้ดูแลระบบ',
    };
  }

  // 2. Auditor:
  // 1=แพทย์, 39=พยาบาลวิชาชีพ, 42=เจ้าพนักงานเวชสถิติ, 58=เจ้าหน้าที่เวชระเบียน
  // or position name containing แพทย์, พยาบาล, เวชสถิติ, เวชระเบียน
  if (
    positionId === 1 ||
    positionId === 39 ||
    positionId === 42 ||
    positionId === 58 ||
    posText.includes('แพทย์') ||
    posText.includes('พยาบาล') ||
    posText.includes('เวชสถิติ') ||
    posText.includes('เวชระเบียน')
  ) {
    return {
      role: 'Auditor',
      roleDescription: 'ผู้ตรวจประเมินเวชระเบียน (Auditor)',
    };
  }

  // 3. Officer: All other hospital positions
  return {
    role: 'Officer',
    roleDescription: 'เจ้าหน้าที่ทั่วไป (Officer)',
  };
}

/**
 * Verify password against HOSxP opduser (supports MD5 / plain / passweb)
 */
export function verifyHosPassword(
  inputPass: string,
  storedPass: string | null,
  storedPassweb: string | null
): boolean {
  if (!inputPass) return false;

  const trimmed = inputPass.trim();
  const md5Lower = crypto.createHash('md5').update(trimmed).digest('hex').toLowerCase();
  const md5Upper = md5Lower.toUpperCase();
  const md5Raw = crypto.createHash('md5').update(inputPass).digest('hex').toLowerCase();

  const validSet = new Set([trimmed, inputPass, md5Lower, md5Upper, md5Raw]);

  if (storedPassweb && storedPassweb.trim()) {
    const web = storedPassweb.trim();
    if (validSet.has(web) || validSet.has(web.toLowerCase()) || validSet.has(web.toUpperCase())) {
      return true;
    }
  }

  if (storedPass && storedPass.trim()) {
    const pw = storedPass.trim();
    if (validSet.has(pw) || validSet.has(pw.toLowerCase()) || validSet.has(pw.toUpperCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Sign session payload into HMAC-SHA256 Token
 */
export function signSession(payload: AuthUser): string {
  const data = JSON.stringify({ ...payload, exp: Date.now() + SESSION_MAX_AGE_SEC * 1000 });
  const b64Data = Buffer.from(data, 'utf8').toString('base64url');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(b64Data).digest('base64url');
  return `${b64Data}.${hmac}`;
}

/**
 * Verify and decode HMAC-SHA256 Token
 */
export function verifySession(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [b64Data, hmac] = parts;
    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(b64Data).digest('base64url');

    const hmacBuf = Buffer.from(hmac);
    const expBuf = Buffer.from(expectedHmac);
    if (hmacBuf.length !== expBuf.length || !crypto.timingSafeEqual(hmacBuf, expBuf)) {
      return null;
    }

    const json = JSON.parse(Buffer.from(b64Data, 'base64url').toString('utf8'));
    if (!json.exp || Date.now() > json.exp) {
      return null;
    }
    return json as AuthUser;
  } catch {
    return null;
  }
}

export interface Pending2FaPayload {
  loginname: string;
  authUser: AuthUser;
  purpose: '2fa_pending';
  exp: number;
}

/**
 * Sign temporary 5-minute token for 2FA verification step
 */
export function sign2FaTempToken(authUser: AuthUser): string {
  const payload: Pending2FaPayload = {
    loginname: authUser.loginname,
    authUser,
    purpose: '2fa_pending',
    exp: Date.now() + 5 * 60 * 1000,
  };
  const data = JSON.stringify(payload);
  const b64Data = Buffer.from(data, 'utf8').toString('base64url');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(b64Data).digest('base64url');
  return `${b64Data}.${hmac}`;
}

/**
 * Verify temporary 5-minute token for 2FA verification step
 */
export function verify2FaTempToken(token: string): Pending2FaPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [b64Data, hmac] = parts;
    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(b64Data).digest('base64url');

    const hmacBuf = Buffer.from(hmac);
    const expBuf = Buffer.from(expectedHmac);
    if (hmacBuf.length !== expBuf.length || !crypto.timingSafeEqual(hmacBuf, expBuf)) {
      return null;
    }

    const json = JSON.parse(Buffer.from(b64Data, 'base64url').toString('utf8')) as Pending2FaPayload;
    if (json.purpose !== '2fa_pending' || !json.exp || Date.now() > json.exp) {
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

/**
 * Get current session user on server side (Server Components / API Route Handlers)
 */
export async function getServerSession(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySession(token);
  } catch {
    return null;
  }
}

/**
 * Record authentication events in db_mra centralized audit trail (table mra_audit_trail)
 */
export async function logAuthEvent(params: {
  loginname: string;
  userFullname?: string | null;
  doctorCode?: string | null;
  positionId?: number | null;
  positionName?: string | null;
  role: string;
  action: 'login' | 'logout' | 'failed';
  ipAddress?: string | null;
  userAgent?: string | null;
  status: 'success' | 'failed';
  failReason?: string | null;
  details?: Record<string, unknown> | null;
}) {
  try {
    const summary =
      params.action === 'login'
        ? 'เข้าสู่ระบบสำเร็จ'
        : params.action === 'logout'
        ? 'ออกจากระบบ'
        : `เข้าสู่ระบบไม่สำเร็จ: ${params.failReason || 'รหัสผ่านหรือข้อมูลไม่ถูกต้อง'}`;

    const normalizedAction = params.action === 'failed' ? 'login_failed' : params.action;
    const severity = params.status === 'success' ? 'info' : 'warning';

    const details = JSON.stringify({
      doctorCode: params.doctorCode || undefined,
      positionId: params.positionId !== undefined ? params.positionId : undefined,
      positionName: params.positionName || undefined,
      failReason: params.failReason || undefined,
      ...(params.details || {}),
    });

    await executeMra(
      `INSERT INTO mra_audit_trail 
        (event_time, category, action, status, severity, actor_loginname, actor_fullname, actor_role, target_type, target_id, summary, details, ip_address, user_agent, request_method, request_path)
       VALUES (NOW(3), 'AUTH', ?, ?, ?, ?, ?, ?, 'user', ?, ?, ?, ?, ?, 'POST', ?)`,
      [
        normalizedAction,
        params.status,
        severity,
        params.loginname,
        params.userFullname || null,
        params.role || 'Unknown',
        params.loginname,
        summary,
        details,
        params.ipAddress || null,
        params.userAgent || null,
        params.action === 'logout' ? '/api/auth/logout' : '/api/auth/login',
      ]
    );
  } catch (err) {
    console.error('[AUTH AUDIT TRAIL LOG ERROR]', err);
  }
}

/**
 * Audit-trail hook for Admin Security Key usage (success / invalid attempt).
 * Uses a dynamic import (audit-trail imports this module) and never throws.
 */
async function recordAdminKeyEvent(req: NextRequest | undefined, ok: boolean): Promise<void> {
  try {
    const { logAuditEvent } = await import('@/lib/audit-trail');
    await logAuditEvent({
      req,
      category: 'SECURITY',
      action: ok ? 'admin_key_used' : 'admin_key_invalid',
      status: ok ? 'success' : 'failed',
      severity: ok ? 'warning' : 'critical',
      summary: ok
        ? 'ใช้ Admin Security Key ยืนยันสิทธิ์ผู้ดูแลระบบ (ไม่ผ่าน session)'
        : 'กรอก Admin Security Key ไม่ถูกต้อง',
    });
  } catch {
    // never affect authorization flow
  }
}

/**
 * Verify administrator authorization via:
 * 1. Active server session with Administrator role, OR
 * 2. Valid Admin Security Key (ADMIN_SETUP_KEY)
 */
export async function verifyAdminOrEmergencyKey(
  req?: NextRequest,
  providedKey?: string
): Promise<{ authorized: boolean; reason?: string }> {
  // 1. Check active Administrator session
  try {
    const session = await getServerSession();
    if (session && RBAC.canManageSettings(session.role)) {
      return { authorized: true };
    }
  } catch {
    // Session check failed or non-existent
  }

  // 2. Check emergency security key (Check environment variable first, then fallback to sys_security_keys database)
  const inputKey = (
    providedKey ||
    (req ? req.headers.get('x-admin-key') : null) ||
    (req && req.nextUrl ? req.nextUrl.searchParams.get('adminKey') : null) ||
    ''
  ).trim();

  if (inputKey) {
    const expectedKey = (process.env.ADMIN_SETUP_KEY || 'mra@admin2026').trim();
    if (inputKey === expectedKey) {
      void recordAdminKeyEvent(req, true);
      return { authorized: true };
    }

    // Check database stored security key
    try {
      const { verifySecurityKey } = await import('@/lib/security-keys');
      const isDbValid = await verifySecurityKey('ADMIN_SETUP_KEY', inputKey);
      if (isDbValid) {
        void recordAdminKeyEvent(req, true);
        return { authorized: true };
      }
    } catch {
      // ignore
    }

    // A key was supplied but did not match: record the failed attempt (brute-force visibility)
    void recordAdminKeyEvent(req, false);
  }

  return {
    authorized: false,
    reason: inputKey
      ? 'รหัสความปลอดภัยผู้ดูแลระบบ (Admin Security Key) ไม่ถูกต้อง'
      : 'กรุณากรอกรหัสความปลอดภัยผู้ดูแลระบบ (Admin Security Key) เพื่อดำเนินการ',
  };
}

