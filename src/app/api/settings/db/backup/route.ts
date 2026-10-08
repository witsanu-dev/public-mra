import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, verifyAdminOrEmergencyKey } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit-trail';
import { getMraPool } from '@/lib/db-mra';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function escapeSqlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = value.getFullYear();
    const m = pad(value.getMonth() + 1);
    const d = pad(value.getDate());
    const h = pad(value.getHours());
    const mi = pad(value.getMinutes());
    const s = pad(value.getSeconds());
    return `'${y}-${m}-${d} ${h}:${mi}:${s}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString('hex')}'`;
  }
  if (typeof value === 'object') {
    const jsonStr = JSON.stringify(value);
    return `'${jsonStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }

  // String escaping compatible with all MySQL tools
  const str = String(value);
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');

  return `'${escaped}'`;
}

export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyAdminOrEmergencyKey(req);
    if (!authCheck.authorized) {
      void logAuditEvent({
        req,
        category: 'BACKUP',
        action: 'db_backup_download',
        status: 'denied',
        severity: 'warning',
        summary: 'ถูกปฏิเสธ: พยายามสำรองข้อมูลฐานข้อมูลโดยไม่มีสิทธิ์',
      });
      return NextResponse.json(
        {
          success: false,
          error: authCheck.reason || 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์สำรองข้อมูลฐานข้อมูล',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const pool = getMraPool();
    const conn = await pool.getConnection();

    try {
      await conn.query('SET NAMES utf8mb4');

      const dbName = process.env.MRA_DB_HOST ? (process.env.MRA_DB_DATABASE || 'db_mra') : 'db_mra';

      // ── Sub-mode: Return Quick Info Metadata ──
      const isInfoMode = req.nextUrl.searchParams.get('info') === 'true';
      if (isInfoMode) {
        const [tableInfoRows] = await conn.query<RowDataPacket[]>(
          `SELECT 
            TABLE_NAME, 
            TABLE_TYPE, 
            TABLE_ROWS, 
            DATA_LENGTH, 
            INDEX_LENGTH, 
            UPDATE_TIME 
           FROM information_schema.TABLES 
           WHERE TABLE_SCHEMA = ?
           ORDER BY TABLE_TYPE ASC, TABLE_NAME ASC`,
          [dbName]
        );

        let totalRows = 0;
        let totalBytes = 0;
        let baseTableCount = 0;
        let viewCount = 0;

        for (const row of tableInfoRows) {
          if (row.TABLE_TYPE === 'BASE TABLE') {
            baseTableCount++;
            totalRows += Number(row.TABLE_ROWS || 0);
            totalBytes += Number(row.DATA_LENGTH || 0) + Number(row.INDEX_LENGTH || 0);
          } else {
            viewCount++;
          }
        }

        // Query real character set and collation from database schema
        let charset = 'utf8mb4';
        let collation = 'utf8mb4_unicode_ci';
        try {
          const [schemaRows] = await conn.query<RowDataPacket[]>(
            `SELECT DEFAULT_CHARACTER_SET_NAME as charset, DEFAULT_COLLATION_NAME as collation 
             FROM information_schema.SCHEMATA 
             WHERE SCHEMA_NAME = ?`,
            [dbName]
          );
          if (schemaRows.length > 0 && schemaRows[0].charset) {
            charset = String(schemaRows[0].charset);
            collation = String(schemaRows[0].collation || '');
          }
        } catch {
          // Fallback to query system variables if schema query fails
          try {
            const [varRows] = await conn.query<RowDataPacket[]>(
              "SHOW VARIABLES WHERE Variable_name IN ('character_set_database', 'collation_database')"
            );
            for (const v of varRows) {
              if (v.Variable_name === 'character_set_database') charset = String(v.Value);
              if (v.Variable_name === 'collation_database') collation = String(v.Value);
            }
          } catch {
            // ignore
          }
        }

        // Get server version
        let serverVersion = '8.0.17';
        try {
          const [verRows] = await conn.query<RowDataPacket[]>('SELECT VERSION() as ver');
          if (verRows.length > 0 && verRows[0].ver) {
            serverVersion = String(verRows[0].ver);
          }
        } catch {
          // ignore
        }

        const navVersionMatch = serverVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
        const navicatVersionNum = navVersionMatch
          ? String(parseInt(navVersionMatch[1], 10) * 10000 + parseInt(navVersionMatch[2], 10) * 100 + parseInt(navVersionMatch[3], 10))
          : '80000';

        return NextResponse.json({
          success: true,
          data: {
            database: dbName,
            host: process.env.MRA_DB_HOST || '127.0.0.1',
            port: Number(process.env.MRA_DB_PORT || 3306),
            charset,
            collation,
            baseTableCount,
            viewCount,
            totalRows,
            totalBytes,
            totalSizeFormatted: (totalBytes / (1024 * 1024)).toFixed(2) + ' MB',
            serverVersion,
            navicatVersionNum,
            tables: tableInfoRows.map((r) => ({
              name: r.TABLE_NAME,
              type: r.TABLE_TYPE,
              rows: Number(r.TABLE_ROWS || 0),
            })),
          },
        });
      }

      // ── Main Mode: Generate Standard Navicat Dump SQL File ──
      const mode = (req.nextUrl.searchParams.get('mode') || 'structure_data').toLowerCase();
      const includeData = mode !== 'structure_only';

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      
      // Navicat standard date: DD/MM/YYYY HH:mm:ss
      const navicatDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      // Query server version for Navicat header
      let serverVersion = '8.0.17';
      try {
        const [verRows] = await conn.query<RowDataPacket[]>('SELECT VERSION() as ver');
        if (verRows.length > 0 && verRows[0].ver) {
          serverVersion = String(verRows[0].ver);
        }
      } catch {
        // ignore
      }

      const navVersionMatch = serverVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
      const navicatVersionNum = navVersionMatch
        ? String(parseInt(navVersionMatch[1], 10) * 10000 + parseInt(navVersionMatch[2], 10) * 100 + parseInt(navVersionMatch[3], 10))
        : '80000';

      const host = process.env.MRA_DB_HOST || '127.0.0.1';
      const port = process.env.MRA_DB_PORT || '3306';
      const sourceHost = `${host}:${port}`;
      const sourceServerName = `${host}_${port}`;

      const [tables] = await conn.query<RowDataPacket[]>(
        `SELECT TABLE_NAME, TABLE_TYPE 
         FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_TYPE ASC, TABLE_NAME ASC`,
        [dbName]
      );

      const baseTables = tables.filter((t) => t.TABLE_TYPE === 'BASE TABLE').map((t) => t.TABLE_NAME);
      const views = tables.filter((t) => t.TABLE_TYPE === 'VIEW').map((t) => t.TABLE_NAME);

      const dumpParts: string[] = [];

      // 1. Exact Navicat Premium Data Transfer Header Comment
      dumpParts.push(`/*
 Navicat Premium Data Transfer

 Source Server         : ${sourceServerName}
 Source Server Type    : MySQL
 Source Server Version : ${navicatVersionNum}
 Source Host           : ${sourceHost}
 Source Schema         : ${dbName}

 Target Server Type    : MySQL
 Target Server Version : ${navicatVersionNum}
 File Encoding         : 65001

 Date: ${navicatDate}
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
`);

      // 2. Dump Base Tables (DDL and optional Records DML)
      for (const table of baseTables) {
        // Table structure DDL
        dumpParts.push(`-- ----------------------------`);
        dumpParts.push(`-- Table structure for ${table}`);
        dumpParts.push(`-- ----------------------------`);
        dumpParts.push(`DROP TABLE IF EXISTS \`${table}\`;`);

        const [createRows] = await conn.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${table}\``);
        if (createRows.length > 0 && createRows[0]['Create Table']) {
          dumpParts.push(`${createRows[0]['Create Table']};\n`);
        }

        // Records DML (Only in Structure and Data mode)
        if (includeData) {
          dumpParts.push(`-- ----------------------------`);
          dumpParts.push(`-- Records of ${table}`);
          dumpParts.push(`-- ----------------------------`);
          dumpParts.push(`BEGIN;`);

          const [rows] = await conn.query<RowDataPacket[]>(`SELECT * FROM \`${table}\``);
          if (rows.length > 0) {
            const columns = Object.keys(rows[0]);
            const colList = columns.map((c) => `\`${c}\``).join(', ');

            // Multi-row INSERT batches (100 rows per statement for high performance import)
            const chunkSize = 100;
            for (let i = 0; i < rows.length; i += chunkSize) {
              const chunk = rows.slice(i, i + chunkSize);
              const valueLines = chunk.map((r) => {
                const vals = columns.map((col) => escapeSqlValue(r[col]));
                return `  (${vals.join(', ')})`;
              });

              dumpParts.push(`INSERT INTO \`${table}\` (${colList}) VALUES\n${valueLines.join(',\n')};`);
            }
          }

          dumpParts.push(`COMMIT;\n`);
        }
      }

      // 3. Dump Views
      for (const view of views) {
        dumpParts.push(`-- ----------------------------`);
        dumpParts.push(`-- View structure for ${view}`);
        dumpParts.push(`-- ----------------------------`);
        dumpParts.push(`DROP VIEW IF EXISTS \`${view}\`;`);

        const [createViewRows] = await conn.query<RowDataPacket[]>(`SHOW CREATE VIEW \`${view}\``);
        if (createViewRows.length > 0 && createViewRows[0]['Create View']) {
          dumpParts.push(`${createViewRows[0]['Create View']};\n`);
        }
      }

      // 4. Exact Navicat Standard Footer
      dumpParts.push(`SET FOREIGN_KEY_CHECKS = 1;
`);

      const fullDumpContent = dumpParts.join('\n');
      const filename = includeData
        ? `db_mra_dump_structure_and_data_${timestampStr}.sql`
        : `db_mra_dump_structure_only_${timestampStr}.sql`;

      // Log successful backup event (central audit trail)
      const session = await getServerSession();
      void logAuditEvent({
        req,
        actor: session
          ? { loginname: session.loginname, fullName: session.fullName, role: session.role }
          : { loginname: 'emergency_admin', fullName: 'ผู้ดูแลระบบฉุกเฉิน (Admin Security Key)', role: 'Administrator' },
        category: 'BACKUP',
        action: 'db_backup_download',
        severity: 'warning',
        targetType: 'database',
        targetId: dbName,
        summary: `สำรองข้อมูล SQL Dump สำเร็จ [${includeData ? 'Structure & Data' : 'Structure Only'}]`,
        details: {
          mode: includeData ? 'structure_data' : 'structure_only',
          filename,
          sizeKB: Number((fullDumpContent.length / 1024).toFixed(1)),
          tableCount: baseTables.length,
          viewCount: views.length,
          viaEmergencyKey: !session,
        },
      });

      // Return streamable response with appropriate download headers
      return new NextResponse(fullDumpContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/sql; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(Buffer.byteLength(fullDumpContent, 'utf8')),
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
        },
      });
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.error('[Database Backup Error]:', err);
    void logAuditEvent({
      req,
      category: 'BACKUP',
      action: 'db_backup_download',
      status: 'failed',
      severity: 'warning',
      summary: 'สำรองข้อมูลฐานข้อมูลไม่สำเร็จ',
      details: { error: err?.message || String(err) },
    });
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการสำรองข้อมูลฐานข้อมูล: ' + (err?.message || err),
      },
      { status: 500 }
    );
  }
}
