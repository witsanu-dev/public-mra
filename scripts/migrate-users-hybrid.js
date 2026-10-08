const mysql = require('mysql2/promise');

const MRA_CONFIG = {
  host: process.env.MRA_DB_HOST || '127.0.0.1',
  port: parseInt(process.env.MRA_DB_PORT || '3306', 10),
  database: process.env.MRA_DB_DATABASE || 'db_mra',
  user: process.env.MRA_DB_USER || 'root',
  password: process.env.MRA_DB_PASSWORD || 'password',
  charset: 'utf8mb4',
};

async function migrateUsers() {
  console.log('Connecting to db_mra...');
  const conn = await mysql.createConnection(MRA_CONFIG);

  try {
    console.log('Checking users table columns...');
    const [cols] = await conn.query('DESCRIBE users');
    const colNames = cols.map((c) => c.Field);

    // 1. Add full_name if not exists
    if (!colNames.includes('full_name')) {
      console.log('Adding column full_name...');
      await conn.query('ALTER TABLE users ADD COLUMN full_name VARCHAR(150) NULL AFTER username');
      await conn.query("UPDATE users SET full_name = TRIM(CONCAT(IFNULL(first_name, ''), ' ', IFNULL(last_name, '')))");
    }

    // 2. Make first_name and last_name nullable
    if (colNames.includes('first_name')) {
      await conn.query('ALTER TABLE users MODIFY COLUMN first_name VARCHAR(100) NULL');
    }
    if (colNames.includes('last_name')) {
      await conn.query('ALTER TABLE users MODIFY COLUMN last_name VARCHAR(100) NULL');
    }

    // 3. Add salt if not exists
    if (!colNames.includes('salt')) {
      console.log('Adding column salt...');
      await conn.query('ALTER TABLE users ADD COLUMN salt VARCHAR(64) NULL AFTER password_hash');
    }

    // 4. Add doctor_code if not exists
    if (!colNames.includes('doctor_code')) {
      console.log('Adding column doctor_code...');
      await conn.query('ALTER TABLE users ADD COLUMN doctor_code VARCHAR(20) NULL AFTER full_name');
    }

    // 5. Add position_id if not exists
    if (!colNames.includes('position_id')) {
      console.log('Adding column position_id...');
      await conn.query('ALTER TABLE users ADD COLUMN position_id INT NULL AFTER doctor_code');
    }

    // 6. Add position_name if not exists
    if (!colNames.includes('position_name')) {
      console.log('Adding column position_name...');
      await conn.query('ALTER TABLE users ADD COLUMN position_name VARCHAR(150) NULL AFTER position_id');
    }

    // 7. Update role ENUM to match MRA standards ('Administrator', 'Auditor', 'Officer')
    console.log('Normalizing role ENUM...');
    await conn.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'Auditor'");
    await conn.query("UPDATE users SET role = 'Administrator' WHERE role IN ('admin', 'ADMIN', 'Administrator')");
    await conn.query("UPDATE users SET role = 'Auditor' WHERE role IN ('auditor', 'AUDITOR', 'Auditor', 'doctor', 'nurse')");
    await conn.query("UPDATE users SET role = 'Officer' WHERE role NOT IN ('Administrator', 'Auditor')");
    await conn.query("ALTER TABLE users MODIFY COLUMN role ENUM('Administrator', 'Auditor', 'Officer') NOT NULL DEFAULT 'Auditor'");

    // 8. Add role_description
    if (!colNames.includes('role_description')) {
      console.log('Adding column role_description...');
      await conn.query('ALTER TABLE users ADD COLUMN role_description VARCHAR(100) NULL AFTER role');
      await conn.query("UPDATE users SET role_description = 'ผู้ดูแลระบบ' WHERE role = 'Administrator'");
      await conn.query("UPDATE users SET role_description = 'ผู้ตรวจประเมินเวชระเบียน' WHERE role = 'Auditor'");
      await conn.query("UPDATE users SET role_description = 'เจ้าหน้าที่ทั่วไป' WHERE role = 'Officer'");
    }

    // 9. Add auth_source
    if (!colNames.includes('auth_source')) {
      console.log('Adding column auth_source...');
      await conn.query("ALTER TABLE users ADD COLUMN auth_source ENUM('his_synced', 'local') NOT NULL DEFAULT 'local' AFTER role_description");
    }

    // 10. Add is_active
    if (!colNames.includes('is_active')) {
      console.log('Adding column is_active...');
      await conn.query('ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER auth_source');
    }

    // 11. Add last_sync_at & last_login_at
    if (!colNames.includes('last_sync_at')) {
      console.log('Adding column last_sync_at...');
      await conn.query('ALTER TABLE users ADD COLUMN last_sync_at DATETIME NULL AFTER is_active');
    }
    if (!colNames.includes('last_login_at')) {
      console.log('Adding column last_login_at...');
      await conn.query('ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL AFTER last_sync_at');
    }

    // Ensure witsanu user has proper data
    await conn.query(`
      UPDATE users 
      SET full_name = 'วิษณุ ศรีโยธา',
          role = 'Administrator',
          role_description = 'ผู้ดูแลระบบ',
          position_name = 'นักวิชาการคอมพิวเตอร์',
          position_id = 0,
          is_active = 1
      WHERE username = 'witsanu'
    `);

    // Clean up any inactive accounts or disabled accounts
    await conn.query("DELETE FROM users WHERE auth_source = 'his_synced' AND is_active = 0");

    console.log('✓ Migration completed successfully.');
    const [finalCols] = await conn.query('DESCRIBE users');
    console.log('Final schema:', finalCols.map((c) => `${c.Field} (${c.Type})`));
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

migrateUsers();
