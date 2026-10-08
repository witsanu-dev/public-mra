import { NextRequest, NextResponse } from 'next/server';
import { queryMra } from '@/lib/db-mra';
import { RowDataPacket } from 'mysql2/promise';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceType = searchParams.get('serviceType') || 'ALL'; // ALL, OPD, ER, IPD, PSYCHIATRIC, CHRONIC
    const month = searchParams.get('month') || 'ALL'; // ALL, YYYY-MM
    const caseType = searchParams.get('caseType') || 'ALL'; // ALL, general, chronic, er, psychiatric

    // 1. Build where clause for view_mra_executive_summary
    const whereConditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (serviceType === 'OPD') {
      whereConditions.push("service_type = 'OPD' AND case_type NOT IN ('er', 'chronic') AND is_psychiatric = 0");
    } else if (serviceType === 'ER') {
      whereConditions.push("service_type = 'OPD' AND case_type = 'er'");
    } else if (serviceType === 'IPD') {
      whereConditions.push("service_type = 'IPD' AND is_psychiatric = 0");
    } else if (serviceType === 'PSYCHIATRIC') {
      whereConditions.push("(is_psychiatric = 1 OR case_type = 'psychiatric')");
    } else if (serviceType === 'CHRONIC') {
      whereConditions.push("case_type = 'chronic'");
    }

    if (month !== 'ALL') {
      whereConditions.push('audit_month = ?');
      params.push(month);
    }

    if (caseType !== 'ALL') {
      if (caseType === 'psychiatric') {
        whereConditions.push('is_psychiatric = 1');
      } else {
        whereConditions.push('case_type = ? AND is_psychiatric = 0');
        params.push(caseType);
      }
    }

    const whereClause = whereConditions.join(' AND ');

    const summaryRows = await queryMra<RowDataPacket[]>(
      `SELECT 
        service_type as serviceType,
        case_type as caseType,
        is_psychiatric as isPsychiatric,
        audit_month as auditMonth,
        total_audited as totalAudited,
        avg_percentage as avgPercentage,
        passed_count as passedCount,
        failed_count as failedCount,
        pass_rate as passRate,
        inadequate_count as inadequateCount,
        certain_issues_count as certainIssuesCount,
        no_issue_count as noIssueCount
      FROM view_mra_executive_summary
      WHERE ${whereClause}
      ORDER BY audit_month DESC, service_type ASC`,
      params
    );

    // 2. Fetch Category Performance from view_mra_category_performance
    const catConditions: string[] = ['1=1'];
    const catParams: unknown[] = [];

    if (serviceType === 'OPD') {
      catConditions.push("service_type = 'OPD' AND case_type NOT IN ('er', 'chronic') AND is_psychiatric = 0");
    } else if (serviceType === 'ER') {
      catConditions.push("service_type = 'OPD' AND case_type = 'er'");
    } else if (serviceType === 'IPD') {
      catConditions.push("service_type = 'IPD' AND is_psychiatric = 0");
    } else if (serviceType === 'PSYCHIATRIC') {
      catConditions.push("(is_psychiatric = 1 OR case_type = 'psychiatric')");
    } else if (serviceType === 'CHRONIC') {
      catConditions.push("case_type = 'chronic'");
    }

    if (month !== 'ALL') {
      catConditions.push('audit_month = ?');
      catParams.push(month);
    }

    if (caseType !== 'ALL') {
      if (caseType === 'psychiatric') {
        catConditions.push('is_psychiatric = 1');
      } else {
        catConditions.push('case_type = ? AND is_psychiatric = 0');
        catParams.push(caseType);
      }
    }

    const catWhere = catConditions.join(' AND ');

    const categoryRows = await queryMra<RowDataPacket[]>(
      `SELECT 
        service_type as serviceType,
        content_no as contentNo,
        content_name as contentName,
        SUM(total_evaluations) as totalEvaluations,
        SUM(na_count) as naCount,
        SUM(missing_count) as missingCount,
        SUM(total_full_score) as totalFullScore,
        SUM(total_sum_score) as totalSumScore,
        ROUND(
          CASE 
            WHEN SUM(total_full_score) > 0 
            THEN (SUM(total_sum_score) * 100.0 / SUM(total_full_score)) 
            ELSE 0.00 
          END, 2
        ) as complianceRate
      FROM view_mra_category_performance
      WHERE ${catWhere}
      GROUP BY service_type, content_no, content_name
      ORDER BY complianceRate ASC, service_type ASC`,
      catParams
    );

    // 3. Compute High-Level Global KPIs
    const totalAudited = summaryRows.reduce((a, c) => a + Number(c.totalAudited || 0), 0);
    const passedCount = summaryRows.reduce((a, c) => a + Number(c.passedCount || 0), 0);
    const failedCount = summaryRows.reduce((a, c) => a + Number(c.failedCount || 0), 0);
    const inadequateCount = summaryRows.reduce((a, c) => a + Number(c.inadequateCount || 0), 0);
    const certainIssuesCount = summaryRows.reduce((a, c) => a + Number(c.certainIssuesCount || 0), 0);
    const noIssueCount = summaryRows.reduce((a, c) => a + Number(c.noIssueCount || 0), 0);

    const weightedScoreTotal = summaryRows.reduce(
      (a, c) => a + Number(c.avgPercentage || 0) * Number(c.totalAudited || 0),
      0
    );
    const avgPercentage = totalAudited > 0 ? Number((weightedScoreTotal / totalAudited).toFixed(2)) : 0;
    const passRate = totalAudited > 0 ? Number(((passedCount / totalAudited) * 100).toFixed(2)) : 0;

    // 4. Fetch available months for dropdown filter
    const monthRows = await queryMra<RowDataPacket[]>(
      `SELECT DISTINCT audit_month as month
       FROM (
         SELECT DATE_FORMAT(audit_date, '%Y-%m') as audit_month FROM mra_opd_audit
         UNION
         SELECT DATE_FORMAT(audit_date, '%Y-%m') as audit_month FROM mra_ipd_audit
       ) t
       WHERE audit_month IS NOT NULL
       ORDER BY audit_month DESC`
    );
    const availableMonths = monthRows.map((r) => r.month).filter(Boolean);

    // 5. Fetch recent 20 audits for direct review
    const recentOpdWhere = ['1=1'];
    const recentOpdParams: unknown[] = [];
    if (month !== 'ALL') {
      recentOpdWhere.push("DATE_FORMAT(audit_date, '%Y-%m') = ?");
      recentOpdParams.push(month);
    }
    if (serviceType === 'ER') {
      recentOpdWhere.push("case_type = 'er'");
    } else if (serviceType === 'CHRONIC') {
      recentOpdWhere.push("case_type = 'chronic'");
    } else if (serviceType === 'PSYCHIATRIC') {
      recentOpdWhere.push("(is_psychiatric = 1 OR case_type = 'psychiatric')");
    } else if (serviceType === 'OPD') {
      recentOpdWhere.push("case_type NOT IN ('er', 'chronic') AND is_psychiatric = 0");
    }

    let recentOpd: RowDataPacket[] = [];
    if (serviceType !== 'IPD') {
      recentOpd = await queryMra<RowDataPacket[]>(
        `SELECT 
          'OPD' as serviceType,
          audit_id as auditId,
          vn as visitNumber,
          hn,
          patient_name as patientName,
          case_type as caseType,
          is_psychiatric as isPsychiatric,
          diagnosis,
          sum_score as sumScore,
          full_score as fullScore,
          percentage,
          is_passed as isPassed,
          overall_finding as overallFinding,
          auditor_name as auditorName,
          DATE_FORMAT(audit_date, '%Y-%m-%d') as auditDate
        FROM mra_opd_audit
        WHERE ${recentOpdWhere.join(' AND ')}
        ORDER BY audit_date DESC, created_at DESC
        LIMIT 30`,
        recentOpdParams
      );
    }

    const recentIpdWhere = ['1=1'];
    const recentIpdParams: unknown[] = [];
    if (month !== 'ALL') {
      recentIpdWhere.push("DATE_FORMAT(audit_date, '%Y-%m') = ?");
      recentIpdParams.push(month);
    }
    if (serviceType === 'PSYCHIATRIC') {
      recentIpdWhere.push("(is_psychiatric = 1 OR case_type = 'psychiatric')");
    } else if (serviceType === 'IPD') {
      recentIpdWhere.push("is_psychiatric = 0");
    }

    let recentIpd: RowDataPacket[] = [];
    if (serviceType === 'ALL' || serviceType === 'IPD' || serviceType === 'PSYCHIATRIC') {
      recentIpd = await queryMra<RowDataPacket[]>(
        `SELECT 
          'IPD' as serviceType,
          audit_id as auditId,
          an as visitNumber,
          hn,
          patient_name as patientName,
          case_type as caseType,
          is_psychiatric as isPsychiatric,
          diagnosis,
          sum_score as sumScore,
          full_score as fullScore,
          percentage,
          is_passed as isPassed,
          overall_finding as overallFinding,
          auditor_name as auditorName,
          DATE_FORMAT(audit_date, '%Y-%m-%d') as auditDate
        FROM mra_ipd_audit
        WHERE ${recentIpdWhere.join(' AND ')}
        ORDER BY audit_date DESC, created_at DESC
        LIMIT 30`,
        recentIpdParams
      );
    }

    const recentAudits = [...recentOpd, ...recentIpd]
      .sort((a, b) => new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime())
      .slice(0, 30);

    return NextResponse.json({
      success: true,
      data: {
        kpi: {
          totalAudited,
          avgPercentage,
          passedCount,
          failedCount,
          passRate,
          inadequateCount,
          certainIssuesCount,
          noIssueCount,
        },
        monthlySummary: summaryRows,
        categoryPerformance: categoryRows,
        availableMonths,
        recentAudits,
      },
    });
  } catch (error) {
    console.error('Error fetching MRA reports:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error fetching MRA reports' },
      { status: 500 }
    );
  }
}
