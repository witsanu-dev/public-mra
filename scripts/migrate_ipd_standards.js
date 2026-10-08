const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.MRA_DB_HOST || '127.0.0.1',
    user: process.env.MRA_DB_USER || 'root',
    password: process.env.MRA_DB_PASSWORD || 'password',
    database: process.env.MRA_DB_DATABASE || 'db_mra',
  });

  console.log('Connected to db_mra');

  try {
    // 1. Alter mra_ipd_audit overall_finding to VARCHAR(50)
    await conn.query("ALTER TABLE mra_ipd_audit MODIFY COLUMN overall_finding VARCHAR(50) NOT NULL DEFAULT 'no_issue'");
    console.log('✓ Modified mra_ipd_audit.overall_finding to VARCHAR(50)');

    // 2. Add no_selected to mra_ipd_audit_detail if not exists
    const [cols] = await conn.query("SHOW COLUMNS FROM mra_ipd_audit_detail LIKE 'no_selected'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE mra_ipd_audit_detail ADD COLUMN no_selected TINYINT(1) NOT NULL DEFAULT 0 AFTER missing_selected");
      console.log('✓ Added mra_ipd_audit_detail.no_selected');
    }

    // 3. Update view_mra_executive_summary
    await conn.query(`
      CREATE OR REPLACE VIEW view_mra_executive_summary AS
      SELECT 
        'OPD' AS service_type,
        case_type,
        is_psychiatric,
        DATE_FORMAT(audit_date, '%Y-%m') AS audit_month,
        COUNT(*) AS total_audited,
        ROUND(AVG(percentage), 2) AS avg_percentage,
        SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) AS passed_count,
        SUM(CASE WHEN is_passed = 0 THEN 1 ELSE 0 END) AS failed_count,
        ROUND(SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS pass_rate,
        SUM(CASE WHEN overall_finding = 'inadequate' THEN 1 ELSE 0 END) AS inadequate_count,
        SUM(CASE WHEN overall_finding = 'certain_issues' THEN 1 ELSE 0 END) AS certain_issues_count,
        SUM(CASE WHEN overall_finding = 'no_issue' THEN 1 ELSE 0 END) AS no_issue_count,
        SUM(CASE WHEN overall_finding = 'order_not_standard' THEN 1 ELSE 0 END) AS order_not_standard_count,
        SUM(CASE WHEN overall_finding = 'missing_patient_identifiers' THEN 1 ELSE 0 END) AS missing_identifiers_count
      FROM mra_opd_audit
      GROUP BY case_type, is_psychiatric, DATE_FORMAT(audit_date, '%Y-%m')
      UNION ALL
      SELECT 
        'IPD' AS service_type,
        case_type,
        is_psychiatric,
        DATE_FORMAT(audit_date, '%Y-%m') AS audit_month,
        COUNT(*) AS total_audited,
        ROUND(AVG(percentage), 2) AS avg_percentage,
        SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) AS passed_count,
        SUM(CASE WHEN is_passed = 0 THEN 1 ELSE 0 END) AS failed_count,
        ROUND(SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS pass_rate,
        SUM(CASE WHEN overall_finding = 'inadequate' THEN 1 ELSE 0 END) AS inadequate_count,
        SUM(CASE WHEN overall_finding = 'certain_issues' THEN 1 ELSE 0 END) AS certain_issues_count,
        SUM(CASE WHEN overall_finding = 'no_issue' THEN 1 ELSE 0 END) AS no_issue_count,
        SUM(CASE WHEN overall_finding = 'order_not_standard' THEN 1 ELSE 0 END) AS order_not_standard_count,
        SUM(CASE WHEN overall_finding = 'missing_patient_identifiers' THEN 1 ELSE 0 END) AS missing_identifiers_count
      FROM mra_ipd_audit
      GROUP BY case_type, is_psychiatric, DATE_FORMAT(audit_date, '%Y-%m')
    `);
    console.log('✓ Updated view_mra_executive_summary');
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await conn.end();
  }
}

migrate();
