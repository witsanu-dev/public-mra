const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
    envPath,
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

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'show';
  const envConfig = parseEnvFile();

  const conn = await mysql.createConnection({
    host: envConfig.mra.host || '127.0.0.1',
    port: envConfig.mra.port || 3306,
    database: envConfig.mra.database || 'db_mra',
    user: envConfig.mra.user || 'root',
    password: envConfig.mra.password || 'password',
    charset: 'utf8mb4',
  });

  try {
    if (command === 'show') {
      const [rows] = await conn.query('SELECT * FROM sys_security_keys WHERE key_name = ?', ['ADMIN_SETUP_KEY']);
      console.log('\n======================================================');
      console.log(' MRA System Security Key Management (sys_security_keys)');
      console.log('======================================================');
      if (rows.length === 0) {
        console.log('Status: Key not found in database. Using fallback from .env.local');
        console.log('Masked Hint:', generateKeyHint(envConfig.adminKey));
      } else {
        const row = rows[0];
        console.log('Key Identifier :', row.key_name);
        console.log('Status         :', row.is_active ? 'ACTIVE' : 'REVOKED');
        console.log('Masked Hint    :', row.key_hint || generateKeyHint(envConfig.adminKey));
        console.log('Last Used At   :', row.last_used_at || 'Never recorded');
        console.log('Updated At     :', row.updated_at);
        console.log('Description    :', row.description);

        if (args.includes('--reveal')) {
          const decrypted = decryptText(row.key_value_encrypted);
          console.log('\n[REVEALED KEY] :', decrypted || envConfig.adminKey);
        } else {
          console.log('\n(To view decrypted key, run: node scripts/manage-admin-key.js show --reveal)');
        }
      }
      console.log('======================================================\n');
    } else if (command === 'set') {
      const newKey = args[1];
      if (!newKey || newKey.trim().length < 6) {
        console.error('Error: New security key must be at least 6 characters long.');
        process.exit(1);
      }

      const cleanKey = newKey.trim();
      const encrypted = encryptText(cleanKey);
      const hint = generateKeyHint(cleanKey);

      // 1. Update database
      await conn.query(
        `INSERT INTO sys_security_keys (key_name, key_value_encrypted, key_hint, description, is_active, updated_at)
         VALUES (?, ?, ?, 'Admin Security Key for System Setup, Database Config & Emergency Access', 1, NOW())
         ON DUPLICATE KEY UPDATE 
           key_value_encrypted = VALUES(key_value_encrypted),
           key_hint = VALUES(key_hint),
           is_active = 1,
           updated_at = NOW()`,
        ['ADMIN_SETUP_KEY', encrypted, hint]
      );
      console.log('✓ Successfully updated ADMIN_SETUP_KEY in `sys_security_keys` table.');

      // 2. Dual-write to .env.local
      if (fs.existsSync(envConfig.envPath)) {
        let envContent = fs.readFileSync(envConfig.envPath, 'utf8');
        if (envContent.includes('ADMIN_SETUP_KEY=')) {
          envContent = envContent.replace(/ADMIN_SETUP_KEY=.*/g, `ADMIN_SETUP_KEY=${cleanKey}`);
        } else {
          envContent += `\nADMIN_SETUP_KEY=${cleanKey}\n`;
        }
        fs.writeFileSync(envConfig.envPath, envContent, 'utf8');
        console.log('✓ Successfully synchronized ADMIN_SETUP_KEY in .env.local.');
      }

      console.log('Masked Hint:', hint);
    } else {
      console.log('Usage:');
      console.log('  node scripts/manage-admin-key.js show           # View key status & hint');
      console.log('  node scripts/manage-admin-key.js show --reveal  # View actual decrypted key');
      console.log('  node scripts/manage-admin-key.js set <new_key>  # Reset / change security key');
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Command failed:', err);
  process.exit(1);
});
