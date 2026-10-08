import crypto from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { RowDataPacket } from 'mysql2';
import { queryMra, executeMra } from '@/lib/db-mra';
import { SESSION_SECRET } from './auth-token';

export interface User2FaRecord extends RowDataPacket {
  id: number;
  loginname: string;
  user_fullname: string | null;
  secret_encrypted: string;
  is_enabled: number;
  backup_codes: string | null;
  last_used_step: number | null;
  failed_attempts: number;
  locked_until: Date | null;
  enrolled_at: Date | null;
  updated_at: Date;
}

// ── AES-256-GCM Encryption Utilities ─────────────────────────────────────────

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(SESSION_SECRET).digest();
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptSecret(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ── Backup Recovery Code Helpers ─────────────────────────────────────────────

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function generateBackupCodes(count = 8): { rawCodes: string[]; hashedCodes: string[] } {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code with a hyphen: XXXX-XXXX
    const p1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const p2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `${p1}-${p2}`;
    rawCodes.push(code);
    hashedCodes.push(hashBackupCode(code));
  }

  return { rawCodes, hashedCodes };
}

// ── 2FA Database Operations ──────────────────────────────────────────────────

/**
 * Check if 2FA is active and enabled for the given loginname
 */
export async function is2FaEnabledForUser(loginname: string): Promise<boolean> {
  if (!loginname) return false;
  try {
    const rows = await queryMra<User2FaRecord[]>(
      `SELECT is_enabled FROM mra_user_2fa WHERE loginname = ? LIMIT 1`,
      [loginname.trim()]
    );
    return rows.length > 0 && rows[0].is_enabled === 1;
  } catch (err) {
    console.error('[2FA Status Check Error]:', err);
    return false;
  }
}

/**
 * Get full 2FA metadata for the user
 */
export async function getUser2FaInfo(loginname: string): Promise<{
  isEnabled: boolean;
  enrolledAt: string | null;
  backupCodesRemaining: number;
}> {
  if (!loginname) {
    return { isEnabled: false, enrolledAt: null, backupCodesRemaining: 0 };
  }

  try {
    const rows = await queryMra<User2FaRecord[]>(
      `SELECT is_enabled, enrolled_at, backup_codes FROM mra_user_2fa WHERE loginname = ? LIMIT 1`,
      [loginname.trim()]
    );

    if (rows.length === 0 || rows[0].is_enabled !== 1) {
      return { isEnabled: false, enrolledAt: null, backupCodesRemaining: 0 };
    }

    let remaining = 0;
    if (rows[0].backup_codes) {
      try {
        const parsed = JSON.parse(rows[0].backup_codes);
        if (Array.isArray(parsed)) remaining = parsed.length;
      } catch {
        remaining = 0;
      }
    }

    return {
      isEnabled: true,
      enrolledAt: rows[0].enrolled_at ? new Date(rows[0].enrolled_at).toISOString() : null,
      backupCodesRemaining: remaining,
    };
  } catch (err) {
    console.error('[Get 2FA Info Error]:', err);
    return { isEnabled: false, enrolledAt: null, backupCodesRemaining: 0 };
  }
}

/**
 * Start or refresh 2FA registration setup for a user
 * Generates a fresh secret and returns QR code data URL
 */
export async function start2FaEnrollment(
  loginname: string,
  userFullname?: string
): Promise<{
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}> {
  const normLogin = loginname.trim();
  const secret = generateSecret();
  const issuer = 'e-MRA Hospital';
  const label = `${normLogin} (e-MRA)`;
  const otpauthUrl = generateURI({
    issuer,
    label,
    secret,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 220,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  const encrypted = encryptSecret(secret);

  // Store in pending state (is_enabled = 0)
  await executeMra(
    `INSERT INTO mra_user_2fa 
      (loginname, user_fullname, secret_encrypted, is_enabled, backup_codes, failed_attempts, created_at, updated_at)
     VALUES (?, ?, ?, 0, NULL, 0, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
      user_fullname = VALUES(user_fullname),
      secret_encrypted = VALUES(secret_encrypted),
      is_enabled = 0,
      backup_codes = NULL,
      failed_attempts = 0,
      updated_at = NOW()`,
    [normLogin, userFullname || normLogin, encrypted]
  );

  return {
    secret,
    otpauthUrl,
    qrCodeDataUrl,
  };
}

/**
 * Confirm and activate 2FA using the first valid OTP code
 * Generates and returns 8 single-use backup recovery codes
 */
export async function confirmAndActivate2Fa(
  loginname: string,
  code: string
): Promise<{
  success: boolean;
  backupCodes?: string[];
  error?: string;
}> {
  const normLogin = loginname.trim();
  const cleanCode = code.trim().replace(/\s+/g, '');

  const rows = await queryMra<User2FaRecord[]>(
    `SELECT * FROM mra_user_2fa WHERE loginname = ? LIMIT 1`,
    [normLogin]
  );

  if (rows.length === 0) {
    return { success: false, error: 'ไม่พบข้อมูลการลงทะเบียน 2FA กรุณาเริ่มใหม่อีกครั้ง' };
  }

  const record = rows[0];
  let plainSecret = '';
  try {
    plainSecret = decryptSecret(record.secret_encrypted);
  } catch {
    return { success: false, error: 'เกิดข้อผิดพลาดในการถอดรหัสกุญแจความปลอดภัย' };
  }

  // Verify OTP
  const result = verifySync({ secret: plainSecret, token: cleanCode });
  if (!result || !result.valid) {
    return { success: false, error: 'รหัส OTP 6 หลักไม่ถูกต้อง กรุณาตรวจสอบเวลาบนมือถือและลองใหม่อีกครั้ง' };
  }

  // Generate 8 single-use backup recovery codes
  const { rawCodes, hashedCodes } = generateBackupCodes(8);

  await executeMra(
    `UPDATE mra_user_2fa
     SET is_enabled = 1,
         backup_codes = ?,
         enrolled_at = NOW(),
         failed_attempts = 0,
         locked_until = NULL,
         updated_at = NOW()
     WHERE loginname = ?`,
    [JSON.stringify(hashedCodes), normLogin]
  );

  return {
    success: true,
    backupCodes: rawCodes,
  };
}

/**
 * Verify 2FA code during user login (supports both 6-digit TOTP and 8-character Backup Code)
 */
export async function verifyLogin2Fa(
  loginname: string,
  codeOrBackup: string
): Promise<{
  success: boolean;
  method?: 'totp' | 'backup_code';
  remainingBackupCodes?: number;
  error?: string;
}> {
  const normLogin = loginname.trim();
  const input = codeOrBackup.trim().replace(/\s+/g, '');

  const rows = await queryMra<User2FaRecord[]>(
    `SELECT * FROM mra_user_2fa WHERE loginname = ? AND is_enabled = 1 LIMIT 1`,
    [normLogin]
  );

  if (rows.length === 0) {
    return { success: false, error: 'ไม่พบบัญชีที่เปิดใช้งาน 2FA' };
  }

  const record = rows[0];

  // 1. Check brute-force lockout
  if (record.locked_until && new Date(record.locked_until).getTime() > Date.now()) {
    const remainingMin = Math.ceil((new Date(record.locked_until).getTime() - Date.now()) / 60000);
    return {
      success: false,
      error: `บัญชีถูกระงับการยืนยันตัวตนชั่วคราวเนื่องจากกรอกรหัสผิดเกินกำหนด กรุณารออีก ${remainingMin} นาที`,
    };
  }

  // 2. Try verifying as 6-digit TOTP code
  if (/^\d{6}$/.test(input)) {
    let plainSecret = '';
    try {
      plainSecret = decryptSecret(record.secret_encrypted);
    } catch {
      return { success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบกุญแจความปลอดภัย' };
    }

    const currentStep = Math.floor(Date.now() / 30000);

    // Replay prevention: reject if this exact time window was already consumed
    if (record.last_used_step && record.last_used_step === currentStep) {
      return {
        success: false,
        error: 'รหัส OTP นี้ถูกใช้งานไปแล้ว กรุณารอรหัสชุดถัดไปใน Google Authenticator',
      };
    }

    const result = verifySync({ secret: plainSecret, token: input });
    if (result && result.valid) {
      // Success! Update last used step and reset failures
      await executeMra(
        `UPDATE mra_user_2fa 
         SET last_used_step = ?, failed_attempts = 0, locked_until = NULL 
         WHERE loginname = ?`,
        [currentStep, normLogin]
      );
      return { success: true, method: 'totp' };
    }
  }

  // 3. Try verifying as single-use Backup Recovery Code
  if (record.backup_codes) {
    let hashedList: string[] = [];
    try {
      hashedList = JSON.parse(record.backup_codes);
    } catch {
      hashedList = [];
    }

    const inputHash = hashBackupCode(input);
    const codeIndex = hashedList.indexOf(inputHash);

    if (codeIndex !== -1) {
      // Valid backup code! Remove this single-use code from the list
      hashedList.splice(codeIndex, 1);
      await executeMra(
        `UPDATE mra_user_2fa 
         SET backup_codes = ?, failed_attempts = 0, locked_until = NULL 
         WHERE loginname = ?`,
        [JSON.stringify(hashedList), normLogin]
      );

      return {
        success: true,
        method: 'backup_code',
        remainingBackupCodes: hashedList.length,
      };
    }
  }

  // 4. Failed attempt: increment failed counter and check lockout threshold (5 attempts -> 15 min lock)
  const newFailures = (record.failed_attempts || 0) + 1;
  if (newFailures >= 5) {
    await executeMra(
      `UPDATE mra_user_2fa 
       SET failed_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) 
       WHERE loginname = ?`,
      [newFailures, normLogin]
    );
    return {
      success: false,
      error: 'กรอกรหัสยืนยันผิดเกิน 5 ครั้ง ระบบได้ระงับการลองใหม่ชั่วคราวเป็นเวลา 15 นาที เพื่อความปลอดภัย',
    };
  } else {
    await executeMra(
      `UPDATE mra_user_2fa SET failed_attempts = ? WHERE loginname = ?`,
      [newFailures, normLogin]
    );
    const attemptsLeft = 5 - newFailures;
    return {
      success: false,
      error: `รหัส OTP หรือรหัสสำรองไม่ถูกต้อง (สามารถลองได้อีก ${attemptsLeft} ครั้ง)`,
    };
  }
}

/**
 * Disable 2FA for a user (can be performed by the user or an Administrator)
 */
export async function disableUser2Fa(loginname: string): Promise<boolean> {
  const normLogin = loginname.trim();
  try {
    await executeMra(
      `UPDATE mra_user_2fa 
       SET is_enabled = 0, backup_codes = NULL, failed_attempts = 0, locked_until = NULL, updated_at = NOW() 
       WHERE loginname = ?`,
      [normLogin]
    );
    return true;
  } catch (err) {
    console.error('[Disable 2FA Error]:', err);
    return false;
  }
}

/**
 * List all users with 2FA status for the Admin Settings dashboard
 */
export async function listAll2FaUsers(): Promise<
  Array<{
    loginname: string;
    userFullname: string | null;
    isEnabled: boolean;
    enrolledAt: string | null;
    backupRemaining: number;
    lockedUntil: string | null;
  }>
> {
  try {
    const rows = await queryMra<User2FaRecord[]>(
      `SELECT loginname, user_fullname, is_enabled, enrolled_at, backup_codes, locked_until 
       FROM mra_user_2fa 
       ORDER BY is_enabled DESC, updated_at DESC`
    );

    return rows.map((r) => {
      let remaining = 0;
      if (r.backup_codes) {
        try {
          const parsed = JSON.parse(r.backup_codes);
          if (Array.isArray(parsed)) remaining = parsed.length;
        } catch {
          remaining = 0;
        }
      }

      return {
        loginname: r.loginname,
        userFullname: r.user_fullname,
        isEnabled: r.is_enabled === 1,
        enrolledAt: r.enrolled_at ? new Date(r.enrolled_at).toISOString() : null,
        backupRemaining: remaining,
        lockedUntil: r.locked_until ? new Date(r.locked_until).toISOString() : null,
      };
    });
  } catch (err) {
    console.error('[List 2FA Users Error]:', err);
    return [];
  }
}
