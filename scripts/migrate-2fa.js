const mysql = require('mysql2/promise');

async function migrate2Fa() {
  console.log('Connecting to db_mra...');
  const pool = mysql.createPool({
    host: process.env.MRA_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.MRA_DB_PORT || '3306', 10),
    database: process.env.MRA_DB_DATABASE || 'db_mra',
    user: process.env.MRA_DB_USER || 'root',
    password: process.env.MRA_DB_PASSWORD || 'password',
    charset: 'utf8mb4',
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mra_user_2fa (
        id INT AUTO_INCREMENT PRIMARY KEY,
        loginname VARCHAR(100) NOT NULL UNIQUE,
        user_fullname VARCHAR(255) NULL,
        secret_encrypted TEXT NOT NULL,
        is_enabled TINYINT(1) NOT NULL DEFAULT 0,
        backup_codes TEXT NULL,
        last_used_step BIGINT NULL,
        failed_attempts INT NOT NULL DEFAULT 0,
        locked_until DATETIME NULL,
        enrolled_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_loginname (loginname),
        INDEX idx_enabled (is_enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✓ Successfully created table mra_user_2fa in db_mra');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate2Fa();
