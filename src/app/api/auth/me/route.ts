import { NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import {
  getServerSession,
  signSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  mapDoctorPositionToRole,
} from '@/lib/auth';
import { queryHis } from '@/lib/db-his';

export async function GET() {
  try {
    const user = await getServerSession();
    if (!user) {
      return NextResponse.json({ success: true, authenticated: false, user: null }, { status: 200 });
    }

    // If user's positionName is generic or missing, refresh from HIS
    if (
      !user.positionName ||
      user.positionName === 'เจ้าหน้าที่โรงพยาบาล' ||
      user.positionName === 'ผู้ดูแลระบบ'
    ) {
      try {
        const users = await queryHis<RowDataPacket[]>(
          `SELECT 
            u.name as full_name,
            u.accessright,
            u.entryposition,
            u.departmentposition,
            u.groupname,
            d.name as doctor_name,
            d.jobposition,
            d.provider_id_position,
            p.doctor_position_std_name
          FROM opduser u
          LEFT JOIN doctor d ON d.code = u.doctorcode
          LEFT JOIN doctor_position_std p ON p.doctor_position_std_id = d.position_id
          WHERE u.loginname = ?
          LIMIT 1`,
          [user.loginname]
        );

        if (users && users.length > 0) {
          const u = users[0];
          const fullPositionName = (
            (u.entryposition && u.entryposition.trim()) ||
            (u.provider_id_position && u.provider_id_position.trim()) ||
            (u.doctor_position_std_name && u.doctor_position_std_name.trim()) ||
            (u.jobposition && u.jobposition.trim()) ||
            (u.departmentposition && u.departmentposition.trim()) ||
            (u.groupname && u.groupname.trim()) ||
            ''
          ).trim();

          if (fullPositionName) {
            user.positionName = fullPositionName;
            const { role, roleDescription } = mapDoctorPositionToRole(
              user.positionId,
              user.loginname,
              u.accessright,
              fullPositionName
            );
            user.role = role;
            user.roleDescription = roleDescription;

            // Update display name if missing
            if (!user.fullName) {
              user.fullName = (u.full_name || u.doctor_name || user.loginname).trim();
            }

            // Re-sign session cookie
            const token = signSession(user);
            const { getSecurityKey } = await import('@/lib/security-keys');
            const securityKey = await getSecurityKey('ADMIN_SETUP_KEY');
            const res = NextResponse.json({ success: true, user, securityKey });
            res.cookies.set({
              name: SESSION_COOKIE_NAME,
              value: token,
              httpOnly: true,
              secure: false, // Must be false for hospital internal HTTP intranet
              sameSite: 'lax',
              path: '/',
              maxAge: SESSION_MAX_AGE_SEC,
            });
            return res;
          }
        }
      } catch {
        // Silent fallback in offline / standalone mode
      }
    }

    const { getSecurityKey } = await import('@/lib/security-keys');
    const securityKey = await getSecurityKey('ADMIN_SETUP_KEY');
    return NextResponse.json({ success: true, user, securityKey });
  } catch (error) {
    console.error('Error fetching current session:', error);
    return NextResponse.json({ success: false, user: null }, { status: 500 });
  }
}
