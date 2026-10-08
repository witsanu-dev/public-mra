import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

let pool: Pool | null = null;
let activeMraConfig: {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
} | null = null;

/**
 * Gracefully reloads the MRA connection pool in memory with new configuration.
 */
export async function reloadMraPool(newConfig?: {
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
      console.warn('[MRA Pool End Warning]:', err);
    }
    pool = null;
  }
  if (newConfig) {
    activeMraConfig = newConfig;
  }
  getMraPool();
}

export function getMraPool(): Pool {
  if (!pool) {
    const host = activeMraConfig?.host || process.env.MRA_DB_HOST || '127.0.0.1';
    const port = activeMraConfig?.port || parseInt(process.env.MRA_DB_PORT || '3306', 10);
    const database = activeMraConfig?.database || process.env.MRA_DB_DATABASE || 'db_mra';
    const user = activeMraConfig?.user || process.env.MRA_DB_USER || 'root';
    const password = activeMraConfig?.password !== undefined
      ? activeMraConfig.password
      : (process.env.MRA_DB_PASSWORD || 'password');

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
 * Execute Read queries on db_mra with guaranteed UTF-8 charset
 */
export async function queryMra<T extends RowDataPacket[]>(
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const p = getMraPool();
  const conn = await p.getConnection();
  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    const [rows] = await conn.query<T>(sql, params);
    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Execute Write (INSERT / UPDATE / DELETE) queries on db_mra with guaranteed UTF-8 charset
 */
export async function executeMra(
  sql: string,
  params: unknown[] = []
): Promise<ResultSetHeader> {
  const p = getMraPool();
  const conn = await p.getConnection();
  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    const [result] = await conn.execute<ResultSetHeader>(sql, params as any);
    return result;
  } finally {
    conn.release();
  }
}
