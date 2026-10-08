/**
 * Script to safely migrate historical data from mra_auth_logs to mra_audit_trail,
 * create a backup SQL dump of mra_auth_logs, and drop mra_auth_logs cleanly.
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

function getDbConfig() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const env = fs.readFileSync(envPath, 'utf8');
  const lines = env.split('\n');
  const m = {};
  lines.forEach((l) => {
    const trimmed = l.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        m[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  });

  return {
    host: m.MRA_DB_HOST || 'localhost',
    port: Number(m.MRA_DB_PORT) || 3306,
    user: m.MRA_DB_USER || 'root',
    password: m.MRA_DB_PASSWORD || '',
    database: m.MRA_DB_DATABASE || 'db_mra',
  };
}

async function run() {
  const config = getDbConfig();
  console.log(`Connecting to ${config.database} on ${config.host}:${config.port}...`);
  const conn = await mysql.createConnection(config);

  try {
    // 1. Check if mra_auth_logs exists
    const [tables] = await conn.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = 'mra_auth_logs'`,
      [config.database]
    );

    if (tables.length === 0) {
      console.log('Table mra_auth_logs does not exist. Nothing to migrate.');
      return;
    }

    // 2. Fetch all rows from mra_auth_logs
    const [rows] = await conn.query(`SELECT * FROM mra_auth_logs ORDER BY id ASC`);
    console.log(`Found ${rows.length} rows in mra_auth_logs.`);

    // 3. Create a safety backup file in database/
    const backupDir = path.resolve(process.cwd(), 'database');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFile = path.join(backupDir, 'backup_mra_auth_logs_archive.sql');

    let sqlDump = `-- Backup of mra_auth_logs before dropping table\n-- Generated on ${new Date().toISOString()}\n\n`;
    sqlDump += `DROP TABLE IF EXISTS \`mra_auth_logs_archived\`;\n`;
    sqlDump += `CREATE TABLE \`mra_auth_logs_archived\` (\n`;
    sqlDump += `  \`id\` int(11) NOT NULL AUTO_INCREMENT,\n`;
    sqlDump += `  \`loginname\` varchar(50) NOT NULL,\n`;
    sqlDump += `  \`user_fullname\` varchar(150) DEFAULT NULL,\n`;
    sqlDump += `  \`doctor_code\` varchar(20) DEFAULT NULL,\n`;
    sqlDump += `  \`position_id\` int(11) DEFAULT NULL,\n`;
    sqlDump += `  \`position_name\` varchar(150) DEFAULT NULL,\n`;
    sqlDump += `  \`role\` varchar(50) NOT NULL,\n`;
    sqlDump += `  \`action\` enum('login','logout','failed') NOT NULL,\n`;
    sqlDump += `  \`ip_address\` varchar(45) DEFAULT NULL,\n`;
    sqlDump += `  \`user_agent\` text DEFAULT NULL,\n`;
    sqlDump += `  \`status\` enum('success','failed') NOT NULL,\n`;
    sqlDump += `  \`fail_reason\` varchar(255) DEFAULT NULL,\n`;
    sqlDump += `  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,\n`;
    sqlDump += `  PRIMARY KEY (\`id\`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

    if (rows.length > 0) {
      sqlDump += `INSERT INTO \`mra_auth_logs_archived\` VALUES \n`;
      const valStrings = rows.map((r) => {
        const escapeVal = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
        const dateStr = r.created_at instanceof Date ? r.created_at.toISOString().slice(0, 19).replace('T', ' ') : String(r.created_at);
        return `(${r.id}, ${escapeVal(r.loginname)}, ${escapeVal(r.user_fullname)}, ${escapeVal(r.doctor_code)}, ${r.position_id !== null ? r.position_id : 'NULL'}, ${escapeVal(r.position_name)}, ${escapeVal(r.role)}, ${escapeVal(r.action)}, ${escapeVal(r.ip_address)}, ${escapeVal(r.user_agent)}, ${escapeVal(r.status)}, ${escapeVal(r.fail_reason)}, '${dateStr}')`;
      });
      sqlDump += valStrings.join(',\n') + ';\n';
    }

    fs.writeFileSync(backupFile, sqlDump, 'utf8');
    console.log(`Backup saved to ${backupFile}`);

    // 4. Migrate rows into mra_audit_trail
    let migratedCount = 0;
    for (const r of rows) {
      const normalizedAction = r.action === 'failed' ? 'login_failed' : r.action;
      const severity = r.status === 'success' ? 'info' : 'warning';
      const summary =
        r.action === 'login'
          ? 'เข้าสู่ระบบสำเร็จ'
          : r.action === 'logout'
          ? 'ออกจากระบบ'
          : `เข้าสู่ระบบไม่สำเร็จ: ${r.fail_reason || 'รหัสผ่านหรือข้อมูลไม่ถูกต้อง'}`;

      const details = JSON.stringify({
        doctorCode: r.doctor_code || undefined,
        positionId: r.position_id !== null ? r.position_id : undefined,
        positionName: r.position_name || undefined,
        failReason: r.fail_reason || undefined,
        legacyAuthLogId: r.id,
      });

      const eventTime = r.created_at instanceof Date ? r.created_at : new Date(r.created_at);

      await conn.query(
        `INSERT INTO mra_audit_trail 
          (event_time, category, action, status, severity, actor_loginname, actor_fullname, actor_role, target_type, target_id, summary, details, ip_address, user_agent, request_method, request_path)
         VALUES (?, 'AUTH', ?, ?, ?, ?, ?, ?, 'user', ?, ?, ?, ?, ?, 'POST', ?)`,
        [
          eventTime,
          normalizedAction,
          r.status,
          severity,
          r.loginname,
          r.user_fullname || null,
          r.role || 'Unknown',
          r.loginname,
          summary,
          details,
          r.ip_address || null,
          r.user_agent || null,
          r.action === 'logout' ? '/api/auth/logout' : '/api/auth/login',
        ]
      );
      migratedCount++;
    }
    console.log(`Successfully migrated ${migratedCount} rows into mra_audit_trail.`);

    // 5. Drop table mra_auth_logs safely
    await conn.query(`DROP TABLE mra_auth_logs`);
    console.log('Successfully dropped old table mra_auth_logs.');

    // 6. Verify count in mra_audit_trail
    const [cnt] = await conn.query(`SELECT COUNT(*) as total FROM mra_audit_trail WHERE category = 'AUTH'`);
    console.log(`Total AUTH records in mra_audit_trail: ${cnt[0].total}`);
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
