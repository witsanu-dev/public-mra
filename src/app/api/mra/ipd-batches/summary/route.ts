import { NextRequest, NextResponse } from 'next/server';
import { queryMra } from '@/lib/db-mra';
import { RowDataPacket } from 'mysql2/promise';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'batchId is required' },
        { status: 400 }
      );
    }

    // 1. Fetch IPD batch metadata
    const batchRows = await queryMra<RowDataPacket[]>(
      `SELECT 
        batch_id as batchId,
        COALESCE(batch_name, '') as batchName,
        DATE_FORMAT(sampling_date, '%Y-%m-%d %H:%i') as samplingDate,
        case_type as caseType,
        DATE_FORMAT(date_from, '%Y-%m-%d') as dateFrom,
        DATE_FORMAT(date_to, '%Y-%m-%d') as dateTo,
        sample_size as sampleSize,
        total_available as totalAvailable,
        ward_code as wardCode,
        COALESCE(ward_name, '') as wardName,
        COALESCE(status, 'active') as status,
        COALESCE(note, '') as note,
        COALESCE(created_by, 'Auditor') as createdBy,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as createdAt
      FROM mra_ipd_sampling_batch
      WHERE batch_id = ?
      LIMIT 1`,
      [batchId]
    );

    if (batchRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'IPD Batch not found' },
        { status: 404 }
      );
    }

    const batch = batchRows[0];

    // 2. Fetch all items in this IPD batch joined with their audit evaluation
    const itemRows = await queryMra<RowDataPacket[]>(
      `SELECT 
        i.item_id as itemId,
        i.batch_id as batchId,
        i.an,
        i.hn,
        i.cid,
        i.patient_name as patientName,
        i.sex,
        i.age_y as age,
        DATE_FORMAT(i.regdate, '%Y-%m-%d') as admitDate,
        TIME_FORMAT(i.regtime, '%H:%i') as admitTime,
        DATE_FORMAT(i.dchdate, '%Y-%m-%d') as dischargeDate,
        TIME_FORMAT(i.dchtime, '%H:%i') as dischargeTime,
        i.ward_code as wardCode,
        i.ward_name as wardName,
        i.pdx,
        i.diagnosis_name as diagnosisName,
        i.pttype_name as pttypeName,
        i.dchstts as dischargeStatus,
        i.dchtype as dischargeType,
        i.length_of_stay as lengthOfStay,
        i.doctor_name as doctorName,
        i.audit_status as auditStatus,
        i.audit_id as auditId,
        DATE_FORMAT(i.audited_at, '%Y-%m-%d %H:%i') as auditedAt,
        a.sum_score as sumScore,
        a.full_score as fullScore,
        a.percentage,
        a.is_passed as isPassed,
        a.overall_finding as overallFinding,
        a.certain_issue_remarks as certainIssueRemarks,
        a.auditor_name as auditorName,
        DATE_FORMAT(a.audit_date, '%Y-%m-%d') as auditDate
      FROM mra_ipd_sampling_item i
      LEFT JOIN mra_ipd_audit a ON a.audit_id = i.audit_id
      WHERE i.batch_id = ?
      ORDER BY i.dchdate DESC, i.dchtime DESC, i.regdate DESC`,
      [batchId]
    );

    // 3. Compute IPD batch-level KPIs
    const totalItems = itemRows.length;
    const auditedItemsList = itemRows.filter((it) => it.auditStatus === 'audited' && it.auditId);
    const auditedCount = auditedItemsList.length;
    const pendingCount = totalItems - auditedCount;
    const completenessPercent = totalItems > 0 ? Number(((auditedCount / totalItems) * 100).toFixed(1)) : 0;

    let avgSumScore = 0;
    let avgFullScore = 0;
    let avgPercentage = 0;
    let passedCount = 0;
    let failedCount = 0;
    let passRate = 0;
    let inadequateCount = 0;
    let certainIssuesCount = 0;
    let noIssueCount = 0;

    if (auditedCount > 0) {
      const totalSum = auditedItemsList.reduce((acc, curr) => acc + (Number(curr.sumScore) || 0), 0);
      const totalFull = auditedItemsList.reduce((acc, curr) => acc + (Number(curr.fullScore) || 0), 0);
      const totalPct = auditedItemsList.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);

      avgSumScore = Number((totalSum / auditedCount).toFixed(1));
      avgFullScore = Number((totalFull / auditedCount).toFixed(1));
      avgPercentage = Number((totalPct / auditedCount).toFixed(2));

      passedCount = auditedItemsList.filter((it) => it.isPassed === 1).length;
      failedCount = auditedItemsList.filter((it) => it.isPassed === 0).length;
      passRate = Number(((passedCount / auditedCount) * 100).toFixed(2));

      inadequateCount = auditedItemsList.filter((it) => it.overallFinding === 'inadequate').length;
      certainIssuesCount = auditedItemsList.filter((it) => it.overallFinding === 'certain_issues').length;
      noIssueCount = auditedItemsList.filter((it) => it.overallFinding === 'no_issue').length;
    }

    // 4. Fetch IPD Category Compliance for this batch from mra_ipd_audit_detail
    const categoryRows = await queryMra<RowDataPacket[]>(
      `SELECT 
        d.content_no as contentNo,
        d.content_name as contentName,
        COUNT(d.id) as totalEvaluated,
        SUM(d.na_selected) as naCount,
        SUM(d.missing_selected) as missingCount,
        SUM(d.calculated_full) as totalFullScore,
        SUM(d.calculated_sum) as totalSumScore,
        ROUND(
          CASE 
            WHEN SUM(d.calculated_full) > 0 
            THEN (SUM(d.calculated_sum) * 100.0 / SUM(d.calculated_full)) 
            ELSE 0.00 
          END, 2
        ) as complianceRate
      FROM mra_ipd_sampling_item i
      JOIN mra_ipd_audit a ON a.audit_id = i.audit_id
      JOIN mra_ipd_audit_detail d ON d.audit_id = a.audit_id
      WHERE i.batch_id = ?
      GROUP BY d.content_no, d.content_name
      ORDER BY d.content_no ASC`,
      [batchId]
    );

    return NextResponse.json({
      success: true,
      data: {
        batch,
        kpi: {
          totalItems,
          auditedCount,
          pendingCount,
          completenessPercent,
          avgSumScore,
          avgFullScore,
          avgPercentage,
          passedCount,
          failedCount,
          passRate,
          inadequateCount,
          certainIssuesCount,
          noIssueCount,
        },
        categoryPerformance: categoryRows,
        items: itemRows,
      },
    });
  } catch (error) {
    console.error('Error fetching IPD batch summary:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error fetching IPD batch summary' },
      { status: 500 }
    );
  }
}
