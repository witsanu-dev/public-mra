const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// AES-256 encryption compatible with src/lib/db-config.ts
const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'mra-hospital-audit-secret-key-2026';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
const IV_LENGTH = 16;

function encryptText(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptText(encryptedText) {
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
    return '';
  }
}

function generateKeyHint(key) {
  if (!key) return '';
  if (key.length <= 6) return key[0] + '***' + key[key.length - 1];
  const start = key.slice(0, 4);
  const end = key.slice(-4);
  return `${start}******${end}`;
}

function parseEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  const config = {
    mra: { host: '127.0.0.1', port: 3306, database: 'db_mra', user: 'root', password: 'password' },
    adminKey: 'mra@admin2026',
  };

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...rest] = trimmed.split('=');
      const v = rest.join('=').trim();
      if (k === 'MRA_DB_HOST') config.mra.host = v;
      if (k === 'MRA_DB_PORT') config.mra.port = parseInt(v, 10);
      if (k === 'MRA_DB_DATABASE') config.mra.database = v;
      if (k === 'MRA_DB_USER') config.mra.user = v;
      if (k === 'MRA_DB_PASSWORD') config.mra.password = v;
      if (k === 'ADMIN_SETUP_KEY') config.adminKey = v;
    }
  }
  return config;
}

async function run() {
  const envConfig = parseEnvFile();

  console.log('Connecting to db_mra on', `${envConfig.mra.host}:${envConfig.mra.port}...`);
  const conn = await mysql.createConnection({
    host: envConfig.mra.host || '127.0.0.1',
    port: envConfig.mra.port || 3306,
    database: envConfig.mra.database || 'db_mra',
    user: envConfig.mra.user || 'root',
    password: envConfig.mra.password || 'password',
    charset: 'utf8mb4',
  });

  try {
    // 1. Create table sys_security_keys if not exists
    console.log('1. Creating table `sys_security_keys` if not exists...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`sys_security_keys\` (
        \`id\` INT(11) NOT NULL AUTO_INCREMENT,
        \`key_name\` VARCHAR(50) NOT NULL COMMENT 'Key identifier name (e.g. ADMIN_SETUP_KEY)',
        \`key_value_encrypted\` TEXT NOT NULL COMMENT 'AES-256 encrypted security key value',
        \`key_hint\` VARCHAR(100) DEFAULT NULL COMMENT 'Masked hint to help Admin recall if forgotten',
        \`description\` VARCHAR(255) DEFAULT NULL COMMENT 'Key usage description',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=Active, 0=Revoked',
        \`last_used_at\` DATETIME DEFAULT NULL COMMENT 'Last time key was successfully used',
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_key_name\` (\`key_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('   Table `sys_security_keys` created/verified successfully.');

    // 2. Insert or update ADMIN_SETUP_KEY
    const adminKey = envConfig.adminKey || 'mra@admin2026';
    const encrypted = encryptText(adminKey);
    const hint = generateKeyHint(adminKey);
    const description = 'Admin Security Key for System Setup, Database Config & Emergency Access';

    console.log('2. Inserting/Updating ADMIN_SETUP_KEY in `sys_security_keys`...');
    await conn.query(
      `INSERT INTO \`sys_security_keys\` (key_name, key_value_encrypted, key_hint, description, is_active, updated_at)
       VALUES (?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE 
         key_value_encrypted = VALUES(key_value_encrypted),
         key_hint = VALUES(key_hint),
         description = VALUES(description),
         is_active = 1,
         updated_at = NOW()`,
      ['ADMIN_SETUP_KEY', encrypted, hint, description]
    );

    console.log('   ADMIN_SETUP_KEY saved successfully.');
    console.log('   - Key Name   :', 'ADMIN_SETUP_KEY');
    console.log('   - Masked Hint:', hint);
    console.log('   - Encrypted  :', encrypted.substring(0, 30) + '...');
    console.log('   - Verify Test:', decryptText(encrypted) === adminKey ? 'PASS (AES-256 OK)' : 'FAIL');

    console.log('\nMigration completed successfully!');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
