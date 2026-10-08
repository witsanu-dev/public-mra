const mysql = require('mysql2/promise');

async function runMigration() {
  const conn = await mysql.createConnection({
    host: process.env.MRA_DB_HOST || '127.0.0.1',
    user: process.env.MRA_DB_USER || 'root',
    password: process.env.MRA_DB_PASSWORD || 'password',
    database: process.env.MRA_DB_DATABASE || 'db_mra',
  });

  console.log('Connected to db_mra');

  try {
    // 1. mra_opd_audit
    await conn.query(`ALTER TABLE mra_opd_audit MODIFY COLUMN case_type VARCHAR(30) NOT NULL DEFAULT 'general'`);
    console.log('✓ Modified mra_opd_audit.case_type to VARCHAR(30)');

    const [opdCols] = await conn.query(`SHOW COLUMNS FROM mra_opd_audit LIKE 'is_psychiatric'`);
    if (opdCols.length === 0) {
      await conn.query(`ALTER TABLE mra_opd_audit ADD COLUMN is_psychiatric TINYINT(1) NOT NULL DEFAULT 0 AFTER case_type`);
      console.log('✓ Added mra_opd_audit.is_psychiatric');
    }

    try {
      await conn.query(`ALTER TABLE mra_opd_audit ADD INDEX idx_opd_case_type (case_type, is_psychiatric)`);
      console.log('✓ Added idx_opd_case_type');
    } catch (e) {
      console.log('Note on idx_opd_case_type:', e.message);
    }

    // 2. mra_ipd_audit
    const [ipdCaseCols] = await conn.query(`SHOW COLUMNS FROM mra_ipd_audit LIKE 'case_type'`);
    if (ipdCaseCols.length === 0) {
      await conn.query(`ALTER TABLE mra_ipd_audit ADD COLUMN case_type VARCHAR(30) NOT NULL DEFAULT 'general' AFTER hname`);
      console.log('✓ Added mra_ipd_audit.case_type');
    }

    const [ipdPsyCols] = await conn.query(`SHOW COLUMNS FROM mra_ipd_audit LIKE 'is_psychiatric'`);
    if (ipdPsyCols.length === 0) {
      await conn.query(`ALTER TABLE mra_ipd_audit ADD COLUMN is_psychiatric TINYINT(1) NOT NULL DEFAULT 0 AFTER case_type`);
      console.log('✓ Added mra_ipd_audit.is_psychiatric');
    }

    const [ipdRemarksCols] = await conn.query(`SHOW COLUMNS FROM mra_ipd_audit LIKE 'certain_issue_remarks'`);
    if (ipdRemarksCols.length === 0) {
      await conn.query(`ALTER TABLE mra_ipd_audit ADD COLUMN certain_issue_remarks TEXT NULL AFTER overall_finding`);
      console.log('✓ Added mra_ipd_audit.certain_issue_remarks');
    }

    try {
      await conn.query(`ALTER TABLE mra_ipd_audit ADD INDEX idx_ipd_case_type (case_type, is_psychiatric)`);
      console.log('✓ Added idx_ipd_case_type');
    } catch (e) {
      console.log('Note on idx_ipd_case_type:', e.message);
    }

    // 4. Create SQL Reporting Views
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
        SUM(CASE WHEN overall_finding = 'no_issue' THEN 1 ELSE 0 END) AS no_issue_count
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
        SUM(CASE WHEN overall_finding = 'no_issue' THEN 1 ELSE 0 END) AS no_issue_count
      FROM mra_ipd_audit
      GROUP BY case_type, is_psychiatric, DATE_FORMAT(audit_date, '%Y-%m')
    `);
    console.log('✓ Created/Updated view_mra_executive_summary');

    await conn.query(`
      CREATE OR REPLACE VIEW view_mra_category_performance AS
      SELECT 
        'OPD' AS service_type,
        a.case_type,
        a.is_psychiatric,
        d.content_no,
        d.content_name,
        COUNT(*) AS total_evaluations,
        SUM(d.na_selected) AS na_count,
        SUM(d.missing_selected) AS missing_count,
        SUM(d.calculated_full) AS total_full_score,
        SUM(d.calculated_sum) AS total_sum_score,
        ROUND(
          CASE WHEN SUM(d.calculated_full) > 0 
               THEN (SUM(d.calculated_sum) * 100.0 / SUM(d.calculated_full)) 
               ELSE 0.00 END, 
          2
        ) AS compliance_rate
      FROM mra_opd_audit_detail d
      JOIN mra_opd_audit a ON a.audit_id = d.audit_id
      GROUP BY a.case_type, a.is_psychiatric, d.content_no, d.content_name
      UNION ALL
      SELECT 
        'IPD' AS service_type,
        a.case_type,
        a.is_psychiatric,
        d.content_no,
        d.content_name,
        COUNT(*) AS total_evaluations,
        SUM(d.na_selected) AS na_count,
        SUM(d.missing_selected) AS missing_count,
        SUM(d.calculated_full) AS total_full_score,
        SUM(d.calculated_sum) AS total_sum_score,
        ROUND(
          CASE WHEN SUM(d.calculated_full) > 0 
               THEN (SUM(d.calculated_sum) * 100.0 / SUM(d.calculated_full)) 
               ELSE 0.00 END, 
          2
        ) AS compliance_rate
      FROM mra_ipd_audit_detail d
      JOIN mra_ipd_audit a ON a.audit_id = d.audit_id
      GROUP BY a.case_type, a.is_psychiatric, d.content_no, d.content_name
    `);
    console.log('✓ Created/Updated view_mra_category_performance');

    console.log('=== All Database Migrations Completed Successfully! ===');
  } finally {
    await conn.end();
  }
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
