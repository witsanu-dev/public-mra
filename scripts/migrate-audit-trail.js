const mysql = require('mysql2/promise');

/**
 * Creates the central audit trail table `mra_audit_trail`.
 * Safe to run repeatedly (CREATE TABLE IF NOT EXISTS). The application also
 * creates this table lazily on first use, so running this script is optional.
 */
async function run() {
  const conn = await mysql.createConnection({
    host: process.env.MRA_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.MRA_DB_PORT || '3306', 10),
    database: process.env.MRA_DB_DATABASE || 'db_mra',
    user: process.env.MRA_DB_USER || 'root',
    password: process.env.MRA_DB_PASSWORD || 'password',
    charset: 'utf8mb4',
  });

  console.log('Connected to db_mra');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS mra_audit_trail (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      event_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      category VARCHAR(20) NOT NULL,
      action VARCHAR(60) NOT NULL,
      status ENUM('success','failed','denied') NOT NULL DEFAULT 'success',
      severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
      actor_loginname VARCHAR(50) NULL,
      actor_fullname VARCHAR(150) NULL,
      actor_role VARCHAR(30) NULL,
      target_type VARCHAR(40) NULL,
      target_id VARCHAR(100) NULL,
      summary VARCHAR(500) NOT NULL,
      details LONGTEXT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent VARCHAR(255) NULL,
      request_method VARCHAR(10) NULL,
      request_path VARCHAR(200) NULL,
      INDEX idx_audit_trail_time (event_time),
      INDEX idx_audit_trail_actor (actor_loginname, event_time),
      INDEX idx_audit_trail_cat_action (category, action, event_time),
      INDEX idx_audit_trail_target (target_type, target_id),
      INDEX idx_audit_trail_status (status, severity)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('Successfully created or verified mra_audit_trail table');

  const [cols] = await conn.query('DESCRIBE mra_audit_trail');
  console.log('Columns:', cols.map((c) => c.Field).join(', '));

  await conn.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
