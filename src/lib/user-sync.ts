import crypto from 'crypto';
import { RowDataPacket } from 'mysql2';
import { executeMra, queryMra } from '@/lib/db-mra';
import { queryHis } from '@/lib/db-his';
import { AuthUser, mapDoctorPositionToRole, verifyHosPassword } from '@/lib/auth';

export interface LocalUserRow extends RowDataPacket {
  id: number;
  username: string;
  full_name: string;
  doctor_code: string | null;
  position_id: number | null;
  position_name: string | null;
  password_hash: string;
  salt: string | null;
  role: 'Administrator' | 'Auditor' | 'Officer';
  role_description: string | null;
  auth_source: 'his_synced' | 'local';
  is_active: number;
  last_sync_at: Date | null;
  last_login_at: Date | null;
}

// ── Secure Password Hashing (PBKDF2-HMAC-SHA256) ─────────────────────────────

export function hashPassword(plainText: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plainText, salt, 10000, 64, 'sha256').toString('hex');
  return { hash, salt };
}

export function verifyPassword(plainText: string, hash: string, salt: string | null): boolean {
  if (!plainText || !hash) return false;

  // 1. Salted PBKDF2 verification
  if (salt) {
    const computed = crypto.pbkdf2Sync(plainText, salt, 10000, 64, 'sha256').toString('hex');
    const b1 = Buffer.from(computed);
    const b2 = Buffer.from(hash);
    if (b1.length === b2.length && crypto.timingSafeEqual(b1, b2)) {
      return true;
    }
  }

  // 2. Fallback check for MD5 / Legacy passwords
  return verifyHosPassword(plainText, hash, null);
}

// ── Background User Synchronization on Login ─────────────────────────────────

/**
 * Silently synchronizes the authenticated HIS user into local `users` in db_mra.
 * This ensures that if the HIS database is later disconnected, this user can still
 * log in and use the entire application in Standalone / Offline mode.
 */
export async function syncUserFromHisBackground(
  authUser: AuthUser,
  plainPassword?: string
): Promise<void> {
  if (!authUser || !authUser.loginname) return;

  try {
    const username = authUser.loginname.trim();
    const fullName = authUser.fullName || username;
    const doctorCode = authUser.doctorCode || null;
    const positionId = authUser.positionId !== undefined ? authUser.positionId : null;
    const positionName = authUser.positionName || null;
    const role = authUser.role || 'Auditor';
    const roleDescription = authUser.roleDescription || null;

    if (plainPassword && plainPassword.trim()) {
      const { hash, salt } = hashPassword(plainPassword.trim());
      await executeMra(
        `INSERT INTO users 
          (username, full_name, doctor_code, position_id, position_name, password_hash, salt, role, role_description, auth_source, is_active, last_sync_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'his_synced', 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
          full_name = VALUES(full_name),
          doctor_code = VALUES(doctor_code),
          position_id = VALUES(position_id),
          position_name = VALUES(position_name),
          password_hash = VALUES(password_hash),
          salt = VALUES(salt),
          role = VALUES(role),
          role_description = VALUES(role_description),
          is_active = 1,
          last_sync_at = NOW(),
          last_login_at = NOW()`,
        [username, fullName, doctorCode, positionId, positionName, hash, salt, role, roleDescription]
      );
    } else {
      await executeMra(
        `INSERT INTO users 
          (username, full_name, doctor_code, position_id, position_name, role, role_description, auth_source, is_active, last_sync_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'his_synced', 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
          full_name = VALUES(full_name),
          doctor_code = VALUES(doctor_code),
          position_id = VALUES(position_id),
          position_name = VALUES(position_name),
          role = VALUES(role),
          role_description = VALUES(role_description),
          is_active = 1,
          last_sync_at = NOW(),
          last_login_at = NOW()`,
        [username, fullName, doctorCode, positionId, positionName, role, roleDescription]
      );
    }
  } catch (err) {
    console.warn('[User Sync Warning - Non-blocking]:', err);
  }
}

// ── Local User Authentication (Fallback for Offline / Standalone Mode) ────────

/**
 * Authenticates a user against the local `users` table in db_mra when HIS is offline or disconnected.
 */
export async function authenticateLocalUser(
  username: string,
  plainPassword: string
): Promise<{
  success: boolean;
  user?: AuthUser;
  error?: string;
}> {
  const normUser = (username || '').trim();
  if (!normUser || !plainPassword) {
    return { success: false, error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' };
  }

  try {
    const rows = await queryMra<LocalUserRow[]>(
      `SELECT * FROM users WHERE username = ? LIMIT 1`,
      [normUser]
    );

    if (rows.length === 0) {
      return { success: false, error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบฐานข้อมูลท้องถิ่น' };
    }

    const u = rows[0];

    if (u.is_active !== 1) {
      return { success: false, error: 'บัญชีผู้ใช้งานนี้ถูกระงับการใช้งานในระบบ' };
    }

    // Verify password hash
    const isValid = verifyPassword(plainPassword, u.password_hash, u.salt);
    if (!isValid) {
      return { success: false, error: 'รหัสผ่านไม่ถูกต้อง (โหมดออฟไลน์)' };
    }

    // Update last_login_at
    await executeMra(
      `UPDATE users SET last_login_at = NOW() WHERE username = ?`,
      [normUser]
    );

    const authUser: AuthUser = {
      loginname: u.username,
      fullName: u.full_name || u.username,
      doctorCode: u.doctor_code || null,
      positionId: u.position_id !== null ? Number(u.position_id) : null,
      positionName: u.position_name || (u.role === 'Administrator' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่โรงพยาบาล'),
      role: u.role,
      roleDescription: u.role_description || (u.role === 'Administrator' ? 'ผู้ดูแลระบบ' : 'ผู้ตรวจประเมินเวชระเบียน'),
      loginAt: Date.now(),
    };

    return { success: true, user: authUser };
  } catch (err) {
    console.error('[Authenticate Local User Error]:', err);
    return { success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบผู้ใช้งานท้องถิ่น' };
  }
}

// ── Bulk Sync from HIS (Administrator Feature) ───────────────────────────────

/**
 * Bulk copy active hospital staff from HOSxP (`opduser` + `doctor` + `doctor_position_std`)
 * into `users` table in `db_mra`.
 */
export async function syncAllUsersFromHis(): Promise<{
  success: boolean;
  syncedCount: number;
  disabledSkippedCount?: number;
  error?: string;
}> {
  try {
    // 1. Fetch only active hospital staff from HOSxP (strictly exclude account_disable = 'Y')
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
      WHERE u.loginname IS NOT NULL 
        AND u.loginname != ''
        AND (u.account_disable IS NULL OR UPPER(TRIM(u.account_disable)) != 'Y')`
    );

    // 2. Fetch all disabled accounts from HOSxP (account_disable = 'Y') to purge any previously synced records in db_mra
    const hisDisabled = await queryHis<RowDataPacket[]>(
      `SELECT loginname 
       FROM opduser 
       WHERE UPPER(TRIM(account_disable)) = 'Y' 
         AND loginname IS NOT NULL 
         AND loginname != ''`
    );

    const disabledLogins = hisDisabled.map((r: any) => (r.loginname || '').trim()).filter(Boolean);
    if (disabledLogins.length > 0) {
      // Chunk delete in db_mra with individual placeholders for prepared statement
      const CHUNK_SIZE = 100;
      for (let i = 0; i < disabledLogins.length; i += CHUNK_SIZE) {
        const chunk = disabledLogins.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(', ');
        await executeMra(
          `DELETE FROM users WHERE auth_source = 'his_synced' AND username IN (${placeholders})`,
          chunk
        );
      }
    }

    let count = 0;

    for (const u of hisUsers) {
      const username = (u.loginname || '').trim();
      if (!username) continue;

      // Defensive guard against disabled accounts
      if (u.account_disable && u.account_disable.toString().trim().toUpperCase() === 'Y') {
        continue;
      }

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
        fullPositionName,
        {
          doctor_position_std_name: u.doctor_position_std_name,
          jobposition: u.jobposition,
          provider_id_position: u.provider_id_position,
          entryposition: u.entryposition,
          departmentposition: u.departmentposition,
          groupname: u.groupname,
          name: u.name,
          full_name: u.full_name,
          doctor_name: u.doctor_name,
        }
      );

      const displayName = (u.full_name || u.doctor_name || username).trim();
      const storedPw = (u.stored_passweb && u.stored_passweb.trim()) || (u.stored_password && u.stored_password.trim()) || '';

      await executeMra(
        `INSERT INTO users 
          (username, full_name, doctor_code, position_id, position_name, password_hash, salt, role, role_description, auth_source, is_active, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 'his_synced', 1, NOW())
         ON DUPLICATE KEY UPDATE
          full_name = VALUES(full_name),
          doctor_code = VALUES(doctor_code),
          position_id = VALUES(position_id),
          position_name = VALUES(position_name),
          role = VALUES(role),
          role_description = VALUES(role_description),
          is_active = 1,
          last_sync_at = NOW()`,
        [
          username,
          displayName,
          u.doctorcode || null,
          u.position_id !== null && u.position_id !== undefined ? Number(u.position_id) : null,
          fullPositionName || null,
          storedPw || 'legacy_hosxp_hash',
          role,
          roleDescription,
        ]
      );
      count++;
    }

    return { 
      success: true, 
      syncedCount: count, 
      disabledSkippedCount: disabledLogins.length 
    };
  } catch (err: any) {
    console.error('[Sync All Users Error]:', err);
    return { success: false, syncedCount: 0, error: err?.message || 'ไม่สามารถซิงค์ผู้ใช้งานจาก HIS ได้' };
  }
}
