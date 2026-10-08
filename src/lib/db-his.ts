import mysql, { Pool, RowDataPacket } from 'mysql2/promise';

let pool: Pool | null = null;
let activeHisConfig: {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
} | null = null;

/**
 * Gracefully reloads the HIS connection pool in memory with new configuration.
 */
export async function reloadHisPool(newConfig?: {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } catch (err) {
      console.warn('[HIS Pool End Warning]:', err);
    }
    pool = null;
  }
  cachedHospitalInfo = null;
  if (newConfig) {
    activeHisConfig = newConfig;
  }
  // Immediately initialize new pool
  getHisPool();
}

function getHisPool(): Pool {
  if (!pool) {
    const host = activeHisConfig?.host || process.env.HIS_DB_HOST || '10.250.100.201';
    const port = activeHisConfig?.port || parseInt(process.env.HIS_DB_PORT || '3306', 10);
    const database = activeHisConfig?.database || process.env.HIS_DB_DATABASE || 'hos';
    const user = activeHisConfig?.user || process.env.HIS_DB_USER || 'hxpkt';
    const password = activeHisConfig?.password !== undefined
      ? activeHisConfig.password
      : (process.env.HIS_DB_PASSWORD || 'servkt');

    pool = mysql.createPool({
      host,
      port,
      database,
      user,
      password,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 8000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return pool;
}

/**
 * Forbidden SQL keywords for HIS Database.
 * The system MUST NOT perform any writes, modifications, or schema changes on HIS.
 */
const FORBIDDEN_SQL_REGEX = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|CREATE|GRANT|REVOKE|LOCK|RENAME)\b/i;

/**
 * Strict Read-Only Query Executor for Hospital HIS database.
 * Enforces that only SELECT / SHOW / EXPLAIN queries can be executed.
 * Automatically enforces SET NAMES utf8mb4 for flawless Thai encoding.
 */
export async function queryHis<T extends RowDataPacket[]>(
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const trimmed = sql.trim();

  // 1. Enforce SELECT / SHOW / EXPLAIN / DESCRIBE only
  if (!/^(SELECT|SHOW|EXPLAIN|DESCRIBE)\b/i.test(trimmed)) {
    throw new Error(
      `[SECURITY ERROR] HIS Database is strictly READ-ONLY. Only SELECT/SHOW statements are allowed. Attempted: "${trimmed.slice(0, 30)}..."`
    );
  }

  // 2. Reject any nested forbidden keyword
  if (FORBIDDEN_SQL_REGEX.test(trimmed)) {
    throw new Error(
      `[SECURITY ERROR] HIS Database is strictly READ-ONLY. Write keyword detected in statement.`
    );
  }

  const p = getHisPool();
  const conn = await p.getConnection();
  try {
    // Enforce UTF-8 communication on server
    await conn.query('SET NAMES utf8mb4');
    const [rows] = await conn.query<T>(trimmed, params);
    return rows;
  } finally {
    conn.release();
  }
}

export interface HisHospitalInfo {
  hcode: string;
  hname: string;
}

let cachedHospitalInfo: HisHospitalInfo | null = null;

/**
 * Automatically fetch Hospital Code and Hospital Name from the connected HIS database.
 * Supports multiple standard table schemas in Thai HIS (opdconfig, hospcode, sys_var).
 * Results are cached in memory to minimize database roundtrips.
 */
export async function getHisHospitalInfo(): Promise<HisHospitalInfo> {
  if (cachedHospitalInfo) {
    return cachedHospitalInfo;
  }

  let hcode = '';
  let hname = '';

  try {
    // 1. Primary standard in HOSxP: opdconfig table
    const opdRows = await queryHis<RowDataPacket[]>(
      `SELECT hospitalcode, hospitalname FROM opdconfig LIMIT 1`
    );
    if (opdRows.length > 0) {
      hcode = (opdRows[0].hospitalcode || '').trim();
      hname = (opdRows[0].hospitalname || '').trim();
    }
  } catch (err: any) {
    const isConn =
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ENOTFOUND' ||
      err?.message?.includes('connect') ||
      err?.message?.includes('ETIMEDOUT');

    if (isConn) {
      throw err;
    }
    // Only attempt fallbacks if connection is active but table schema is different
  }

  // 2. If hospital name is missing, attempt lookup from hospcode master table
  if (hcode && !hname) {
    try {
      const hospRows = await queryHis<RowDataPacket[]>(
        `SELECT name FROM hospcode WHERE hospcode = ? LIMIT 1`,
        [hcode]
      );
      if (hospRows.length > 0 && hospRows[0].name) {
        hname = hospRows[0].name.trim();
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback to sys_var table if opdconfig didn't yield both
  if (!hcode || !hname) {
    try {
      const sysRows = await queryHis<RowDataPacket[]>(
        `SELECT sys_name, sys_value FROM sys_var WHERE sys_name IN ('hospitalcode', 'hospitalname', 'hospcode', 'hospname')`
      );
      for (const row of sysRows) {
        if ((row.sys_name === 'hospitalcode' || row.sys_name === 'hospcode') && !hcode) {
          hcode = (row.sys_value || '').trim();
        }
        if ((row.sys_name === 'hospitalname' || row.sys_name === 'hospname') && !hname) {
          hname = (row.sys_value || '').trim();
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Fallback to environment variables if specified by deployer
  if (!hcode && (process.env.NEXT_PUBLIC_DEFAULT_HCODE || process.env.HIS_HOSPITAL_CODE)) {
    hcode = (process.env.NEXT_PUBLIC_DEFAULT_HCODE || process.env.HIS_HOSPITAL_CODE || '').trim();
  }
  if (!hname && (process.env.NEXT_PUBLIC_DEFAULT_HNAME || process.env.HIS_HOSPITAL_NAME)) {
    hname = (process.env.NEXT_PUBLIC_DEFAULT_HNAME || process.env.HIS_HOSPITAL_NAME || '').trim();
  }

  // 5. Final result (no site-specific hardcode so any hospital can deploy this system)
  const result: HisHospitalInfo = {
    hcode,
    hname,
  };

  if (hcode && hname) {
    cachedHospitalInfo = result;
  }

  return result;
}
