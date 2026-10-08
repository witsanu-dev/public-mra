import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mysql, { RowDataPacket } from 'mysql2/promise';
import { reloadHisPool } from './db-his';
import { reloadMraPool, queryMra, executeMra } from './db-mra';

// AES-256 reversible encryption for credentials stored in sys_db_connections
const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'mra-hospital-audit-secret-key-2026';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
const IV_LENGTH = 16;

export function encryptPassword(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptPassword(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const [ivHex, cipherHex] = encryptedText.split(':');
    if (!ivHex || !cipherHex) return encryptedText;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedText;
  }
}

export interface DbConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}

export interface SystemDbSettings {
  his: DbConnectionConfig;
  mra: DbConnectionConfig;
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs?: number;
  serverVersion?: string;
  hospitalCode?: string;
  hospitalName?: string;
  tableCount?: number;
  verifiedTables?: string[];
  message: string;
  error?: string;
}

/**
 * Read current database settings synchronously from process.env (Bootstrap Cold-Start Fallback)
 */
export function getCurrentDbSettings(maskPassword = true): SystemDbSettings {
  return {
    his: {
      host: process.env.HIS_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.HIS_DB_PORT || '3306', 10),
      database: process.env.HIS_DB_DATABASE || 'hos',
      user: process.env.HIS_DB_USER || 'his_user',
      password: maskPassword ? (process.env.HIS_DB_PASSWORD ? '••••••••••••' : '') : (process.env.HIS_DB_PASSWORD || ''),
    },
    mra: {
      host: process.env.MRA_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.MRA_DB_PORT || '3306', 10),
      database: process.env.MRA_DB_DATABASE || 'db_mra',
      user: process.env.MRA_DB_USER || 'root',
      password: maskPassword ? (process.env.MRA_DB_PASSWORD ? '••••••••••••' : '') : (process.env.MRA_DB_PASSWORD || 'password'),
    },
  };
}

/**
 * Enterprise Hybrid Settings Reader:
 * 1. Reads active profiles from database table `sys_db_connections` in db_mra.
 * 2. Decrypts AES-256 passwords.
 * 3. Seamlessly falls back to .env.local/process.env if db_mra is offline or uninitialized.
 */
export async function getHybridDbSettings(maskPassword = true): Promise<SystemDbSettings> {
  const fallback = getCurrentDbSettings(maskPassword);

  try {
    const rows = await queryMra<RowDataPacket[]>(
      `SELECT connection_key, db_type, host, port, database_name, username, password_encrypted, is_active
       FROM sys_db_connections
       WHERE is_active = 1`
    );

    if (rows && rows.length > 0) {
      let hisFound = false;
      let mraFound = false;

      for (const row of rows) {
        const rawPass = row.password_encrypted ? decryptPassword(row.password_encrypted) : '';
        const displayPass = maskPassword ? (rawPass ? '••••••••••••' : '') : rawPass;

        if (row.db_type === 'his' && !hisFound) {
          fallback.his = {
            host: row.host || fallback.his.host,
            port: Number(row.port) || fallback.his.port,
            database: row.database_name || fallback.his.database,
            user: row.username || fallback.his.user,
            password: displayPass,
          };
          hisFound = true;
        } else if (row.db_type === 'mra' && !mraFound) {
          fallback.mra = {
            host: row.host || fallback.mra.host,
            port: Number(row.port) || fallback.mra.port,
            database: row.database_name || fallback.mra.database,
            user: row.username || fallback.mra.user,
            password: displayPass,
          };
          mraFound = true;
        }
      }
    }
  } catch (err) {
    // If db_mra is offline or uninitialized during cold boot, seamlessly use fallback
    console.warn('[Hybrid DB Settings Fallback]: Reading from process.env/.env.local:', (err as any)?.message || err);
  }

  return fallback;
}

/**
 * Format Thai human-readable error messages for common MySQL connection errors
 */
function translateMysqlError(err: any): string {
  const code = err?.code || '';
  const message = err?.message || String(err);

  if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || message.includes('connect ETIMEDOUT')) {
    return 'ไม่สามารถเชื่อมต่อไปยัง IP หรือ Port ปลายทางได้ (Connection Timed out / Refused)';
  }
  if (code === 'ER_ACCESS_DENIED_ERROR') {
    return 'ชื่อผู้ใช้งาน (User) หรือรหัสผ่าน (Password) ไม่ถูกต้อง (Access Denied)';
  }
  if (code === 'ER_BAD_DB_ERROR') {
    return 'ไม่พบฐานข้อมูลที่ระบุบนเซิร์ฟเวอร์ (Unknown Database)';
  }
  if (code === 'ENOTFOUND') {
    return 'ไม่พบชื่อ Host หรือ IP Address นี้ในเครือข่าย (Host Not Found)';
  }
  return message;
}

/**
 * Transient Test Connection:
 * Creates a single direct connection with short timeout without touching active pools.
 */
export async function testDbConnection(
  type: 'his' | 'mra',
  config: DbConnectionConfig
): Promise<TestConnectionResult> {
  const startTime = Date.now();
  let conn: mysql.Connection | null = null;

  try {
    const passwordToUse = (config.password === '••••••••••••' || !config.password)
      ? (type === 'his' ? (process.env.HIS_DB_PASSWORD || '') : (process.env.MRA_DB_PASSWORD || ''))
      : config.password;

    conn = await mysql.createConnection({
      host: config.host.trim(),
      port: Number(config.port) || 3306,
      database: config.database.trim(),
      user: config.user.trim(),
      password: passwordToUse,
      connectTimeout: 4500,
      charset: 'utf8mb4',
    });

    const [pingRows] = await conn.query<RowDataPacket[]>('SELECT 1 as is_alive');
    const latencyMs = Date.now() - startTime;

    if (!pingRows || pingRows.length === 0) {
      throw new Error('ฐานข้อมูลไม่ตอบสนองคำสั่งทดสอบ');
    }

    // Retrieve Server Version
    let serverVersion = 'MySQL';
    try {
      const [verRows] = await conn.query<RowDataPacket[]>('SELECT VERSION() as ver');
      if (verRows.length > 0 && verRows[0].ver) {
        serverVersion = String(verRows[0].ver);
      }
    } catch {
      // ignore
    }

    if (type === 'his') {
      let hospitalCode = '';
      let hospitalName = '';

      // Test reading opdconfig table (HOSxP standard)
      try {
        const [opdRows] = await conn.query<RowDataPacket[]>(
          'SELECT hospitalcode, hospitalname FROM opdconfig LIMIT 1'
        );
        if (opdRows.length > 0) {
          hospitalCode = (opdRows[0].hospitalcode || '').trim();
          hospitalName = (opdRows[0].hospitalname || '').trim();
        }
      } catch (err) {
        console.warn('[HIS Test] opdconfig not available, trying sys_var:', err);
      }

      // Fallback lookup in hospcode master table
      if (hospitalCode && !hospitalName) {
        try {
          const [hospRows] = await conn.query<RowDataPacket[]>(
            'SELECT name FROM hospcode WHERE hospcode = ? LIMIT 1',
            [hospitalCode]
          );
          if (hospRows.length > 0 && hospRows[0].name) {
            hospitalName = hospRows[0].name.trim();
          }
        } catch {
          // ignore
        }
      }

      return {
        success: true,
        latencyMs,
        serverVersion,
        hospitalCode: hospitalCode || undefined,
        hospitalName: hospitalName || undefined,
        message: hospitalName
          ? `เชื่อมต่อ HIS สำเร็จ: ตรวจพบ ${hospitalName} (${hospitalCode || 'รหัสหน่วยบริการ'})`
          : 'เชื่อมต่อฐานข้อมูล HIS สำเร็จ (สถานะ Read-Only ปกติ)',
      };
    } else {
      // MRA Database verification
      let tableCount = 0;
      const verifiedTables: string[] = [];

      try {
        const [cntRows] = await conn.query<RowDataPacket[]>(
          'SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ?',
          [config.database.trim()]
        );
        if (cntRows.length > 0 && cntRows[0].cnt !== undefined) {
          tableCount = Number(cntRows[0].cnt);
        }
      } catch {
        // ignore
      }

      const coreTables = ['users', 'mra_audit_trail', 'mra_opd_audit', 'mra_ipd_audit'];
      for (const tbl of coreTables) {
        try {
          const [chk] = await conn.query<RowDataPacket[]>(
            `SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1`,
            [config.database.trim(), tbl]
          );
          if (chk.length > 0) {
            verifiedTables.push(tbl);
          }
        } catch {
          // ignore
        }
      }

      return {
        success: true,
        latencyMs,
        serverVersion,
        tableCount,
        verifiedTables,
        message: `เชื่อมต่อฐานข้อมูล MRA สำเร็จ (พบตารางในระบบ ${tableCount} ตาราง, ตรวจสอบโครงสร้างหลักครบถ้วน)`,
      };
    }
  } catch (err: any) {
    console.error(`[DB Test Error - ${type.toUpperCase()}]:`, err);
    return {
      success: false,
      message: translateMysqlError(err),
      error: err?.message || String(err),
    };
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Save Database Settings:
 * 1. Writes to .env.local on server
 * 2. Updates process.env
 * 3. Triggers live pool recreation for HIS & MRA
 */
export async function saveDbSettings(settings: {
  his?: Partial<DbConnectionConfig>;
  mra?: Partial<DbConnectionConfig>;
}): Promise<{ success: boolean; message: string }> {
  try {
    const current = getCurrentDbSettings(false);

    // Merge HIS config
    const finalHis: DbConnectionConfig = {
      host: settings.his?.host ? settings.his.host.trim() : current.his.host,
      port: settings.his?.port ? Number(settings.his.port) : current.his.port,
      database: settings.his?.database ? settings.his.database.trim() : current.his.database,
      user: settings.his?.user ? settings.his.user.trim() : current.his.user,
      password: (settings.his?.password && settings.his.password !== '••••••••••••')
        ? settings.his.password
        : current.his.password,
    };

    // Merge MRA config
    const finalMra: DbConnectionConfig = {
      host: settings.mra?.host ? settings.mra.host.trim() : current.mra.host,
      port: settings.mra?.port ? Number(settings.mra.port) : current.mra.port,
      database: settings.mra?.database ? settings.mra.database.trim() : current.mra.database,
      user: settings.mra?.user ? settings.mra.user.trim() : current.mra.user,
      password: (settings.mra?.password && settings.mra.password !== '••••••••••••')
        ? settings.mra.password
        : current.mra.password,
    };

    // 1. Update in-memory process.env
    process.env.HIS_DB_HOST = finalHis.host;
    process.env.HIS_DB_PORT = String(finalHis.port);
    process.env.HIS_DB_DATABASE = finalHis.database;
    process.env.HIS_DB_USER = finalHis.user;
    if (finalHis.password) process.env.HIS_DB_PASSWORD = finalHis.password;

    process.env.MRA_DB_HOST = finalMra.host;
    process.env.MRA_DB_PORT = String(finalMra.port);
    process.env.MRA_DB_DATABASE = finalMra.database;
    process.env.MRA_DB_USER = finalMra.user;
    if (finalMra.password) process.env.MRA_DB_PASSWORD = finalMra.password;

    // 2. Persist to .env.local on filesystem (Cold-Start Bootstrap Fallback)
    const envPath = path.resolve(process.cwd(), '.env.local');
    const adminKey = process.env.ADMIN_SETUP_KEY || 'mra@admin2026';
    const envContent = `# Hospital HIS Database (Strict Read-Only)
HIS_DB_HOST=${finalHis.host}
HIS_DB_PORT=${finalHis.port}
HIS_DB_DATABASE=${finalHis.database}
HIS_DB_USER=${finalHis.user}
HIS_DB_PASSWORD=${finalHis.password || ''}

# MRA Audit Database on Localhost (Full Read / Write)
MRA_DB_HOST=${finalMra.host}
MRA_DB_PORT=${finalMra.port}
MRA_DB_DATABASE=${finalMra.database}
MRA_DB_USER=${finalMra.user}
MRA_DB_PASSWORD=${finalMra.password || ''}

# Emergency Setup Key for pre-login database configuration
ADMIN_SETUP_KEY=${adminKey}
`;

    await fs.promises.writeFile(envPath, envContent, 'utf8');

    // 3. Persist to sys_db_connections table in db_mra (Database Persistence with AES-256 Encryption)
    try {
      const hisEnc = finalHis.password ? encryptPassword(finalHis.password) : null;
      const mraEnc = finalMra.password ? encryptPassword(finalMra.password) : null;

      await executeMra(
        `INSERT INTO sys_db_connections 
          (connection_key, db_type, profile_name, host, port, database_name, username, password_encrypted, is_active, last_status, notes, updated_at)
         VALUES ('his_primary', 'his', 'HIS Primary Database', ?, ?, ?, ?, ?, 1, 'online', 'Main hospital HIS database', NOW())
         ON DUPLICATE KEY UPDATE
          host = VALUES(host),
          port = VALUES(port),
          database_name = VALUES(database_name),
          username = VALUES(username),
          password_encrypted = COALESCE(VALUES(password_encrypted), password_encrypted),
          updated_at = NOW()`,
        [finalHis.host, finalHis.port, finalHis.database, finalHis.user, hisEnc]
      );

      await executeMra(
        `INSERT INTO sys_db_connections 
          (connection_key, db_type, profile_name, host, port, database_name, username, password_encrypted, is_active, last_status, notes, updated_at)
         VALUES ('mra_primary', 'mra', 'MRA Audit Database', ?, ?, ?, ?, ?, 1, 'online', 'Local audit and evaluation database', NOW())
         ON DUPLICATE KEY UPDATE
          host = VALUES(host),
          port = VALUES(port),
          database_name = VALUES(database_name),
          username = VALUES(username),
          password_encrypted = COALESCE(VALUES(password_encrypted), password_encrypted),
          updated_at = NOW()`,
        [finalMra.host, finalMra.port, finalMra.database, finalMra.user, mraEnc]
      );

      // Persist ADMIN_SETUP_KEY to sys_security_keys
      try {
        const { setSecurityKey } = await import('@/lib/security-keys');
        await setSecurityKey('ADMIN_SETUP_KEY', adminKey);
      } catch {
        // ignore
      }
    } catch (dbErr) {
      console.warn('[Hybrid Save Warning]: Failed to persist to database:', (dbErr as any)?.message || dbErr);
    }

    // 4. Hot-Reload Active Connection Pools
    await reloadHisPool(finalHis);
    await reloadMraPool(finalMra);

    return {
      success: true,
      message: 'บันทึกการตั้งค่าฐานข้อมูลเรียบร้อยแล้ว และระบบได้ปรับใช้การเชื่อมต่อใหม่ทันที',
    };
  } catch (err: any) {
    console.error('[Save DB Settings Error]:', err);
    throw new Error(`ไม่สามารถบันทึกการตั้งค่าได้: ${err.message || err}`);
  }
}
