import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import { queryHis } from '@/lib/db-his';
import { executeMra } from '@/lib/db-mra';
import {
  AuthUser,
  mapDoctorPositionToRole,
  verifyHosPassword,
  signSession,
  sign2FaTempToken,
  logAuthEvent,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
} from '@/lib/auth';
import { is2FaEnabledForUser } from '@/lib/totp';
import { getClientIp } from '@/lib/audit-trail';
import { syncUserFromHisBackground, authenticateLocalUser } from '@/lib/user-sync';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const username = (body.username || '').trim();
    const password = (body.password || '').trim();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' },
        { status: 400 }
      );
    }

    let authUser: AuthUser | null = null;
    let authSource: 'his' | 'local_fallback' = 'his';
    let isHisAvailable = true;

    // ── STEP 1: Attempt HIS Database Authentication (Online Mode) ────────────
    try {
      const hisUsers = await queryHis<RowDataPacket[]>(
        `SELECT 
          u.loginname,
          u.name as full_name,
          u.password as stored_password,
          u.passweb as stored_passweb,
          u.accessright,
          u.account_disable,
          u.doctorcode,
          u.entryposition,
          u.departmentposition,
          u.groupname,
          d.code as doctor_code,
          d.name as doctor_name,
          d.position_id,
          d.jobposition,
          d.provider_id_position,
          p.doctor_position_std_name
        FROM opduser u
        LEFT JOIN doctor d ON d.code = u.doctorcode
        LEFT JOIN doctor_position_std p ON p.doctor_position_std_id = d.position_id
        WHERE u.loginname = ?
        LIMIT 1`,
        [username]
      );

      if (hisUsers && hisUsers.length > 0) {
        const u = hisUsers[0];

        // Check account disable in HOSxP
        const isAccountDisabled = u.account_disable && u.account_disable.toString().trim().toUpperCase() === 'Y';
        if (isAccountDisabled) {
          try {
            await executeMra(`DELETE FROM users WHERE username = ? AND auth_source = 'his_synced'`, [username]);
          } catch {}

          await logAuthEvent({
            loginname: username,
            userFullname: u.full_name || u.doctor_name,
            doctorCode: u.doctorcode,
            positionId: u.position_id,
            positionName: 'เจ้าหน้าที่โรงพยาบาล',
            role: 'Disabled',
            action: 'failed',
            ipAddress,
            userAgent,
            status: 'failed',
            failReason: 'บัญชีผู้ใช้งานถูกระงับการใช้งานใน HOSxP (account_disable = Y)',
          });

          return NextResponse.json(
            { success: false, error: 'บัญชีผู้ใช้งานนี้ถูกระงับการใช้งานในระบบ HOSxP' },
            { status: 403 }
          );
        }

        // Validate password against HIS
        const isPasswordValid = verifyHosPassword(password, u.stored_password, u.stored_passweb);
        if (!isPasswordValid) {
          await logAuthEvent({
            loginname: username,
            userFullname: u.full_name || u.doctor_name,
            doctorCode: u.doctorcode,
            positionId: u.position_id,
            positionName: 'เจ้าหน้าที่โรงพยาบาล',
            role: 'Unknown',
            action: 'failed',
            ipAddress,
            userAgent,
            status: 'failed',
            failReason: 'รหัสผ่านไม่ถูกต้อง (HOSxP)',
          });

          return NextResponse.json(
            { success: false, error: 'รหัสผ่านไม่ถูกต้อง' },
            { status: 401 }
          );
        }

        // Resolve title & role from HIS
        const fullPositionName = (
          (u.entryposition && u.entryposition.trim()) ||
          (u.provider_id_position && u.provider_id_position.trim()) ||
          (u.doctor_position_std_name && u.doctor_position_std_name.trim()) ||
          (u.jobposition && u.jobposition.trim()) ||
          (u.departmentposition && u.departmentposition.trim()) ||
          (u.groupname && u.groupname.trim()) ||
          ''
        ).trim();

        const { role, roleDescription } = mapDoctorPositionToRole(
          u.position_id,
          u.loginname,
          u.accessright,
          fullPositionName
        );

        const displayName = (u.full_name || u.doctor_name || username).trim();
        const finalPositionName =
          fullPositionName ||
          (role === 'Administrator'
            ? 'ผู้ดูแลระบบ'
            : role === 'Auditor'
            ? 'ผู้ตรวจประเมินเวชระเบียน'
            : 'เจ้าหน้าที่โรงพยาบาล');

        authUser = {
          loginname: u.loginname,
          fullName: displayName,
          doctorCode: u.doctorcode || null,
          positionId: u.position_id !== null && u.position_id !== undefined ? Number(u.position_id) : null,
          positionName: finalPositionName,
          role,
          roleDescription,
          loginAt: Date.now(),
        };

        authSource = 'his';

        // ── Background Sync: asynchronously update local users table ─────────
        void syncUserFromHisBackground(authUser, password);
      }
    } catch {
      isHisAvailable = false;
    }

    // ── STEP 2: Fallback to Local Users in db_mra (Offline / Standalone Mode) ──
    if (!authUser) {
      const localRes = await authenticateLocalUser(username, password);

      if (localRes.success && localRes.user) {
        authUser = localRes.user;
        authSource = 'local_fallback';
      } else {
        // Log failed attempt
        await logAuthEvent({
          loginname: username,
          role: 'Unknown',
          action: 'failed',
          ipAddress,
          userAgent,
          status: 'failed',
          failReason: isHisAvailable
            ? 'ไม่พบบัญชีผู้ใช้งานในระบบ HOSxP หรือระบบท้องถิ่น'
            : 'ฐานข้อมูล HIS ออฟไลน์ และไม่พบบัญชีหรือรหัสผ่านไม่ถูกต้องในระบบท้องถิ่น',
        });

        const errorMsg = isHisAvailable
          ? (localRes.error || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง')
          : 'ไม่สามารถเชื่อมต่อฐานข้อมูล HIS ได้ และไม่พบบัญชีผู้ใช้งานในระบบท้องถิ่น (หรือรหัสผ่านไม่ถูกต้อง)';

        return NextResponse.json({ success: false, error: errorMsg }, { status: 401 });
      }
    }

    // ── STEP 3: Two-Factor Authentication Check ──────────────────────────────
    const is2FaActive = await is2FaEnabledForUser(authUser.loginname);
    if (is2FaActive) {
      const tempToken = sign2FaTempToken(authUser);
      return NextResponse.json({
        success: true,
        require2FA: true,
        tempToken,
        user: {
          loginname: authUser.loginname,
          fullName: authUser.fullName,
          role: authUser.role,
          roleDescription: authUser.roleDescription,
        },
      });
    }

    // ── STEP 4: Standard Login Success & Session Issuance ────────────────────
    await logAuthEvent({
      loginname: authUser.loginname,
      userFullname: authUser.fullName,
      doctorCode: authUser.doctorCode,
      positionId: authUser.positionId,
      positionName: authUser.positionName,
      role: authUser.role,
      action: 'login',
      ipAddress,
      userAgent,
      status: 'success',
      details: {
        authSource,
        hisConnected: isHisAvailable,
      },
    });

    const token = signSession(authUser);
    const response = NextResponse.json({
      success: true,
      require2FA: false,
      user: authUser,
      authMode: authSource,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: false, // Must be false for hospital internal HTTP intranet (10.250.101.18)
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SEC,
    });

    return response;
  } catch (error: unknown) {
    console.error('[Error during login]:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
