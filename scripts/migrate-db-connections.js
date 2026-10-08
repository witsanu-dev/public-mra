const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Reversible encryption key for passwords stored in database
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.SESSION_SECRET || 'mra-hospital-audit-secret-key-2026').digest();
const IV_LENGTH = 16;

function encryptPassword(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function parseEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  const config = {
    his: { host: '10.250.100.201', port: 3306, database: 'hos', user: 'hxpkt', password: 'servkt' },
    mra: { host: '127.0.0.1', port: 3306, database: 'db_mra', user: 'root', password: 'password' },
  };

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...rest] = trimmed.split('=');
      const v = rest.join('=').trim();
      if (k === 'HIS_DB_HOST') config.his.host = v;
      if (k === 'HIS_DB_PORT') config.his.port = parseInt(v, 10);
      if (k === 'HIS_DB_DATABASE') config.his.database = v;
      if (k === 'HIS_DB_USER') config.his.user = v;
      if (k === 'HIS_DB_PASSWORD') config.his.password = v;

      if (k === 'MRA_DB_HOST') config.mra.host = v;
      if (k === 'MRA_DB_PORT') config.mra.port = parseInt(v, 10);
      if (k === 'MRA_DB_DATABASE') config.mra.database = v;
      if (k === 'MRA_DB_USER') config.mra.user = v;
      if (k === 'MRA_DB_PASSWORD') config.mra.password = v;
    }
  }
  return config;
}

async function run() {
  const envConfig = parseEnvFile();

  const conn = await mysql.createConnection({
    host: envConfig.mra.host || '127.0.0.1',
    port: envConfig.mra.port || 3306,
    database: envConfig.mra.database || 'db_mra',
    user: envConfig.mra.user || 'root',
    password: envConfig.mra.password || 'password',
    charset: 'utf8mb4',
  });

  console.log('Connected to local db_mra');

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS sys_db_connections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      connection_key VARCHAR(50) NOT NULL UNIQUE,
      db_type ENUM('his', 'mra') NOT NULL,
      profile_name VARCHAR(100) NOT NULL,
      host VARCHAR(255) NOT NULL,
      port INT NOT NULL DEFAULT 3306,
      database_name VARCHAR(100) NOT NULL,
      username VARCHAR(100) NOT NULL,
      password_encrypted TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_tested_at DATETIME NULL,
      last_latency_ms INT NULL,
      last_status ENUM('online', 'offline', 'unknown') DEFAULT 'unknown',
      notes VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_db_type_active (db_type, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await conn.query(createTableSql);
  console.log('✓ Successfully created or verified sys_db_connections table');

  // Seed or update HIS primary connection
  const hisPassEnc = encryptPassword(envConfig.his.password);
  await conn.query(
    `INSERT INTO sys_db_connections 
      (connection_key, db_type, profile_name, host, port, database_name, username, password_encrypted, is_active, last_status, notes)
     VALUES (?, 'his', 'HIS Primary Database', ?, ?, ?, ?, ?, 1, 'online', 'Main hospital HIS database')
     ON DUPLICATE KEY UPDATE
      host = VALUES(host),
      port = VALUES(port),
      database_name = VALUES(database_name),
      username = VALUES(username),
      password_encrypted = VALUES(password_encrypted),
      updated_at = NOW()`,
    [
      'his_primary',
      envConfig.his.host,
      envConfig.his.port,
      envConfig.his.database,
      envConfig.his.user,
      hisPassEnc,
    ]
  );
  console.log('✓ Synced his_primary into sys_db_connections');

  // Seed or update MRA primary connection
  const mraPassEnc = encryptPassword(envConfig.mra.password);
  await conn.query(
    `INSERT INTO sys_db_connections 
      (connection_key, db_type, profile_name, host, port, database_name, username, password_encrypted, is_active, last_status, notes)
     VALUES (?, 'mra', 'MRA Audit Database', ?, ?, ?, ?, ?, 1, 'online', 'Local audit and evaluation database')
     ON DUPLICATE KEY UPDATE
      host = VALUES(host),
      port = VALUES(port),
      database_name = VALUES(database_name),
      username = VALUES(username),
      password_encrypted = VALUES(password_encrypted),
      updated_at = NOW()`,
    [
      'mra_primary',
      envConfig.mra.host,
      envConfig.mra.port,
      envConfig.mra.database,
      envConfig.mra.user,
      mraPassEnc,
    ]
  );
  console.log('✓ Synced mra_primary into sys_db_connections');

  const [rows] = await conn.query('SELECT connection_key, db_type, host, port, database_name, username, is_active FROM sys_db_connections');
  console.log('Active connections in sys_db_connections:');
  console.table(rows);

  await conn.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
