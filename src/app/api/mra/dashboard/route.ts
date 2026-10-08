import { NextRequest, NextResponse } from 'next/server';
import { queryMra } from '@/lib/db-mra';
import { RowDataPacket } from 'mysql2/promise';

interface MonthlySummaryRow extends RowDataPacket {
  serviceType: string;
  caseType: string;
  isPsychiatric: number;
  auditMonth: string;
  totalAudited: number;
  avgPercentage: number;
  passedCount: number;
  failedCount: number;
  passRate: number;
  inadequateCount: number;
  certainIssuesCount: number;
  noIssueCount: number;
}

interface CategoryPerformanceRow extends RowDataPacket {
  serviceType: string;
  caseType: string;
  isPsychiatric: number;
  contentNo: number;
  contentName: string;
  totalEvaluations: number;
  naCount: number;
  missingCount: number;
  totalFullScore: number;
  totalSumScore: number;
  complianceRate: number;
}

const THAI_MONTH_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

function formatThaiMonthShort(monthStr?: string): string {
  if (!monthStr || monthStr === 'ALL') return 'ภาพรวม';
  try {
    const [y, m] = monthStr.split('-');
    const mNum = parseInt(m, 10);
    const yNum = parseInt(y, 10);
    const thaiYear = yNum > 2400 ? String(yNum).slice(-2) : String(yNum + 543).slice(-2);
    return `${THAI_MONTH_SHORT[mNum - 1]} ${thaiYear}`;
  } catch {
    return monthStr;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceType = searchParams.get('serviceType') || 'ALL'; // ALL, OPD, ER, IPD, PSYCHIATRIC, CHRONIC
    const month = searchParams.get('month') || 'ALL'; // ALL, YYYY-MM

    // 1. Where clause for view_mra_executive_summary
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

    const whereClause = whereConditions.join(' AND ');

    // Query executive summary rows
    const summaryRows = await queryMra<MonthlySummaryRow[]>(
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
      ORDER BY audit_month ASC, service_type ASC`,
      params
    );

    // 2. High-Level Global KPIs
    const totalAudited = summaryRows.reduce((acc, r) => acc + Number(r.totalAudited || 0), 0);
    const passedCount = summaryRows.reduce((acc, r) => acc + Number(r.passedCount || 0), 0);
    const failedCount = summaryRows.reduce((acc, r) => acc + Number(r.failedCount || 0), 0);
    const inadequateCount = summaryRows.reduce((acc, r) => acc + Number(r.inadequateCount || 0), 0);
    const certainIssuesCount = summaryRows.reduce((acc, r) => acc + Number(r.certainIssuesCount || 0), 0);
    const noIssueCount = summaryRows.reduce((acc, r) => acc + Number(r.noIssueCount || 0), 0);

    const weightedScoreTotal = summaryRows.reduce(
      (acc, r) => acc + Number(r.avgPercentage || 0) * Number(r.totalAudited || 0),
      0
    );
    const avgPercentage = totalAudited > 0 ? Number((weightedScoreTotal / totalAudited).toFixed(2)) : 0;
    const passRate = totalAudited > 0 ? Number(((passedCount / totalAudited) * 100).toFixed(2)) : 0;
    const targetBenchmark = 80.0;
    const isTargetMet = passRate >= targetBenchmark;

    // 3. Monthly Quality Trend (Chronological across all months for selected service type)
    const trendConditions: string[] = ['1=1'];
    const trendParams: unknown[] = [];
    if (serviceType === 'OPD') {
      trendConditions.push("service_type = 'OPD' AND case_type NOT IN ('er', 'chronic') AND is_psychiatric = 0");
    } else if (serviceType === 'ER') {
      trendConditions.push("service_type = 'OPD' AND case_type = 'er'");
    } else if (serviceType === 'IPD') {
      trendConditions.push("service_type = 'IPD' AND is_psychiatric = 0");
    } else if (serviceType === 'PSYCHIATRIC') {
      trendConditions.push("(is_psychiatric = 1 OR case_type = 'psychiatric')");
    } else if (serviceType === 'CHRONIC') {
      trendConditions.push("case_type = 'chronic'");
    }

    const trendRows = await queryMra<RowDataPacket[]>(
      `SELECT 
        audit_month as auditMonth,
        SUM(total_audited) as total,
        SUM(avg_percentage * total_audited) as weightedScore,
        SUM(passed_count) as passed,
        SUM(failed_count) as failed
      FROM view_mra_executive_summary
      WHERE ${trendConditions.join(' AND ')}
      GROUP BY audit_month
      ORDER BY audit_month ASC`,
      trendParams
    );

    const monthlyTrends = trendRows.map((r) => {
      const tot = Number(r.total || 0);
      const avg = tot > 0 ? Number((Number(r.weightedScore || 0) / tot).toFixed(2)) : 0;
      const rate = tot > 0 ? Number(((Number(r.passed || 0) / tot) * 100).toFixed(2)) : 0;
      return {
        month: r.auditMonth,
        thaiMonth: formatThaiMonthShort(r.auditMonth),
        total: tot,
        avgScore: avg,
        passRate: rate,
        passed: Number(r.passed || 0),
        failed: Number(r.failed || 0),
      };
    });

    // 4. Service Type Comparison (OPD, IPD, ER, Chronic, Psychiatric)
    const serviceRows = await queryMra<RowDataPacket[]>(
      `SELECT 
        CASE 
          WHEN is_psychiatric = 1 OR case_type = 'psychiatric' THEN 'Psychiatric'
          WHEN service_type = 'OPD' AND case_type = 'er' THEN 'ER'
          WHEN service_type = 'OPD' AND case_type = 'chronic' THEN 'Chronic'
          WHEN service_type = 'OPD' THEN 'OPD'
          WHEN service_type = 'IPD' THEN 'IPD'
          ELSE 'Other'
        END as serviceGroup,
        SUM(total_audited) as total,
        SUM(avg_percentage * total_audited) as weightedScore,
        SUM(passed_count) as passed,
        SUM(failed_count) as failed
      FROM view_mra_executive_summary
      ${month !== 'ALL' ? 'WHERE audit_month = ?' : ''}
      GROUP BY serviceGroup`,
      month !== 'ALL' ? [month] : []
    );

    const serviceLabels: Record<string, string> = {
      OPD: 'ผู้ป่วยนอก (OPD)',
      IPD: 'ผู้ป่วยใน (IPD)',
      ER: 'ฉุกเฉิน (ER)',
      Chronic: 'โรคเรื้อรัง (NCDs)',
      Psychiatric: 'จิตเวช (Psychiatric)',
    };

    const serviceComparison = serviceRows
      .filter((r) => r.serviceGroup in serviceLabels)
      .map((r) => {
        const tot = Number(r.total || 0);
        const avg = tot > 0 ? Number((Number(r.weightedScore || 0) / tot).toFixed(2)) : 0;
        const rate = tot > 0 ? Number(((Number(r.passed || 0) / tot) * 100).toFixed(2)) : 0;
        return {
          serviceKey: r.serviceGroup,
          label: serviceLabels[r.serviceGroup] || r.serviceGroup,
          total: tot,
          avgScore: avg,
          passRate: rate,
          passed: Number(r.passed || 0),
          failed: Number(r.failed || 0),
        };
      });

    // 5. Category Performance & Compliance Breakdown
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

    const catWhere = catConditions.join(' AND ');

    const categoryRows = await queryMra<CategoryPerformanceRow[]>(
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

    const categories = categoryRows.map((c) => {
      const rate = Number(c.complianceRate || 0);
      let status: 'good' | 'warning' | 'critical' = 'good';
      if (rate < 70) status = 'critical';
      else if (rate < 80) status = 'warning';

      return {
        serviceType: c.serviceType,
        contentNo: Number(c.contentNo),
        contentName: c.contentName,
        totalEvaluations: Number(c.totalEvaluations),
        naCount: Number(c.naCount),
        missingCount: Number(c.missingCount),
        totalFullScore: Number(c.totalFullScore),
        totalSumScore: Number(c.totalSumScore),
        complianceRate: rate,
        status,
      };
    });

    // 6. Top 5 Deficiencies & Standardized Clinical Root Cause Insights
    // Select lowest compliant categories that have evaluations
    const getClinicalRecommendation = (
      serviceType: string,
      contentNo: number,
      contentName: string,
      complianceRate: number,
      missingCount: number
    ): string => {
      const isCritical = complianceRate < 70.0;
      const isWarning = complianceRate >= 70.0 && complianceRate < 80.0;
      const nameLower = contentName.toLowerCase();

      let action = '';

      // Match category by service type and content keywords / contentNo
      if (nameLower.includes("patient's profile") || nameLower.includes('ข้อมูลทั่วไป')) {
        if (isCritical) {
          action = 'เร่งรัดเจ้าหน้าที่เวชระเบียนตรวจสอบและลงข้อมูลอัตลักษณ์ HN, เลขบัตร ปชช., สิทธิการรักษา และที่อยู่ติดต่อฉุกเฉินให้ครบถ้วน 100% ทันทีที่ลงทะเบียน';
        } else if (isWarning) {
          action = 'กำกับติดตามการตรวจสอบข้อมูลสิทธิการรักษาและข้อมูลผู้ติดต่อฉุกเฉินให้ครบทุกราย ป้องกันการถูกหักคะแนนส่วนข้อมูลพื้นฐาน';
        } else {
          action = 'รักษามาตรฐานการลงทะเบียนผู้ป่วย และสุ่มสอบทานความถูกต้องของข้อมูลสิทธิและที่อยู่ติดต่อฉุกเฉินอย่างสม่ำเสมอ';
        }
      } else if (nameLower.includes('history') || nameLower.includes('ประวัติ')) {
        if (isCritical) {
          action = 'กำหนดเป็นมาตรการเร่งด่วน: แพทย์/พยาบาลต้องซักและบันทึก Chief Complaint, ประวัติเจ็บป่วยปัจจุบัน (PI), ประวัติอดีต (PH) และประวัติแพ้ยา/สารเคมีอย่างละเอียด ห้ามเว้นว่าง';
        } else if (isWarning) {
          action = 'เน้นย้ำการระบุระยะเวลาที่เริ่มมีอาการ (Onset/Duration) และประวัติแพ้ยาให้ชัดเจนทุกเคสเพื่อความปลอดภัยของผู้ป่วยตามเกณฑ์มาตรฐาน';
        } else {
          action = 'คงมาตรฐานการบันทึกประวัติการเจ็บป่วยแรกรับ พร้อมกำกับให้ลงลายมือชื่อและเวลาของผู้ซักประวัติอย่างสม่ำเสมอ';
        }
      } else if (nameLower.includes('physical examination') || nameLower.includes('ตรวจร่างกาย')) {
        if (isCritical) {
          action = 'แพทย์ต้องบันทึกสัญญาณชีพ (Vital signs), ผลตรวจร่างกายตามระบบที่เกี่ยวข้องกับอาการนำอย่างครบถ้วน และระบุการวินิจฉัยโรคเบื้องต้นทุกราย';
        } else if (isWarning) {
          action = 'ทบทวนการบันทึกผลตรวจร่างกายในอวัยวะสำคัญที่สอดคล้องกับอาการนำ และเขียนชื่อโรคภาษาอังกฤษ/ICD ตามมาตรฐาน สปสช.';
        } else {
          action = 'รักษามาตรฐานการตรวจร่างกายตามระบบ และเน้นการบันทึกผลการตรวจร่างกายเชิงลึกในเคสโรคซับซ้อน';
        }
      } else if (nameLower.includes('treatment') || nameLower.includes('investigation') || nameLower.includes('สั่งการรักษา')) {
        if (isCritical) {
          action = 'แพทย์ต้องลงคำสั่งการรักษา ระบุชื่อยา ขนาดยา วิธีใช้ พร้อมลงลายมือชื่อและเวลาทุกครั้ง และกำกับให้แนบผลตรวจ Lab/X-ray ที่รายงานผลแล้วในแฟ้ม';
        } else if (isWarning) {
          action = 'กำกับติดตามการบันทึกเหตุผลการสั่งตรวจพิเศษและการลงลายมือชื่อกำกับผลการตรวจชันสูตรทางห้องปฏิบัติการให้ครบถ้วน';
        } else {
          action = 'คงมาตรฐานการสั่งการรักษาและระบบแนบผลตรวจทางห้องปฏิบัติการให้พร้อมรับการตรวจสอบเสมอ';
        }
      } else if (nameLower.includes('follow up') || nameLower.includes('ติดตาม')) {
        if (isCritical) {
          action = 'แพทย์และทีมผู้รักษาต้องบันทึกประเมินอาการซ้ำ (Re-evaluation), ผลตอบสนองต่อการรักษา และแผนการดูแลต่อเนื่องในใบนัดติดตามอาการทุกครั้ง';
        } else if (isWarning) {
          action = 'เน้นย้ำการบันทึกเปรียบเทียบอาการกับการตรวจครั้งก่อน และระบุผลการปฏิบัติตัวหรือการปรับขนาดยาให้ชัดเจนตามเกณฑ์ สปสช.';
        } else {
          action = 'รักษามาตรฐานการบันทึกติดตามอาการต่อเนื่องในคลินิกเฉพาะโรคและกลุ่มผู้ป่วยโรคเรื้อรัง';
        }
      } else if (nameLower.includes('operative note') || nameLower.includes('ผ่าตัด')) {
        if (isCritical) {
          action = 'ศัลยแพทย์/แพทย์ผู้ทำหัตถการต้องบันทึก Operative Note ทันทีหลังทำหัตถการ โดยระบุ Pre/Post-op Dx, รายละเอียดหัตถการ, Findings, สิ่งส่งตรวจ และลายมือชื่อให้ครบ';
        } else if (isWarning) {
          action = 'กำกับให้บันทึกเวลาเริ่ม-สิ้นสุดผ่าตัด ปริมาณการสูญเสียเลือด (EBL) ภาวะแทรกซ้อน และข้อแนะนำหลังผ่าตัดให้ครบถ้วนตามเกณฑ์หน้า 48';
        } else {
          action = 'คงมาตรฐานการบันทึกรายงานการผ่าตัดทันเวลา และกำกับติดตามความสมบูรณ์ของใบส่งตรวจชิ้นเนื้อ (Pathology)';
        }
      } else if (nameLower.includes('consent') || nameLower.includes('ยินยอม')) {
        if (isCritical) {
          action = 'มาตรการความปลอดภัยทางกฎหมาย: ต้องมีหนังสือแสดงความยินยอมที่มีลายมือชื่อผู้ป่วย/ผู้แทน ลายมือชื่อแพทย์ผู้ให้ข้อมูล และพยาน พร้อมระบุวันที่และเวลา ครบถ้วนก่อนทำหัตถการ';
        } else if (isWarning) {
          action = 'ตรวจสอบใบยินยอมให้ระบุชื่อหัตถการชัดเจน ไม่ใช้ตัวย่อ และลงลายมือชื่อพยานให้ครบถ้วนทุกช่องก่อนส่งผู้ป่วยเข้าห้องผ่าตัด';
        } else {
          action = 'รักษามาตรฐานการให้ข้อมูลและการขอความยินยอมอย่างถูกต้องตามมาตรฐานจริยธรรมและวิชาชีพ';
        }
      } else if (nameLower.includes('discharge') && (nameLower.includes('วินิจฉัย') || nameLower.includes('โรค'))) {
        if (isCritical) {
          action = 'แพทย์เจ้าของไข้ต้องสรุป Principal Diagnosis (โรคหลักเพียงโรคเดียว), Comorbidity, Complication และ External Cause ให้สอดคล้องกับหลักเกณฑ์ Coding สปสช.';
        } else if (isWarning) {
          action = 'กำกับแพทย์ระบุการวินิจฉัยโรคให้ละเอียด ชัดเจน ไม่ใช้คำกำกวม และระบุหัตถการพร้อมวันเวลาให้ตรงกับ Operative Note';
        } else {
          action = 'คงมาตรฐานความถูกต้องแม่นยำของการสรุปโรค และร่วมทบทวนกับทีมผู้ให้รหัสโรค (Coder) เป็นประจำ';
        }
      } else if (nameLower.includes('discharge') && (nameLower.includes('ทั่วไป') || nameLower.includes('แผนการรักษา'))) {
        if (isCritical) {
          action = 'สรุปหน้างบ Discharge Summary ต้องระบุวันนอน วันจำหน่าย สถานภาพจำหน่าย (Discharge status), การส่งต่อ และแผนการรักษาต่อเนื่องให้ครบถ้วน ห้ามค้างเกิน 14 วัน';
        } else if (isWarning) {
          action = 'ตรวจสอบการระบุคำแนะนำเรื่องยา อาหาร การนัดตรวจซ้ำ และสัญญาณอันตรายที่ต้องกลับมาก่อนนัดให้ครบถ้วนตามมาตรฐาน';
        } else {
          action = 'รักษามาตรฐานการสรุปหน้างบจำหน่ายผู้ป่วยให้แล้วเสร็จภายในเวลาที่กำหนดตามเกณฑ์ HA/สปสช.';
        }
      } else if (nameLower.includes('progress note') || nameLower.includes('ความก้าวหน้า')) {
        if (isCritical) {
          action = 'แพทย์ต้องบันทึกความก้าวหน้าอย่างน้อยวันละ 1 ครั้งตามระบบ SOAP Note โดยเฉพาะ Assessment & Plan และลงลายมือชื่อพร้อมวันเวลาทุกครั้งที่มีการตรวจเยี่ยม';
        } else if (isWarning) {
          action = 'เน้นย้ำการบันทึกการเปลี่ยนแปลงของอาการ ผลตรวจทางห้องปฏิบัติการที่ผิดปกติ และเหตุผลในการปรับเปลี่ยนแผนการรักษา';
        } else {
          action = 'คงมาตรฐานการบันทึกความก้าวหน้าอย่างต่อเนื่อง และสนับสนุนการบันทึกร่วมของทีมสหวิชาชีพ (Multidisciplinary Note)';
        }
      } else if (nameLower.includes('consult') || nameLower.includes('ปรึกษา')) {
        if (isCritical) {
          action = 'แพทย์ผู้ส่งปรึกษาต้องระบุประเด็นที่ต้องการปรึกษาให้ชัดเจน และแพทย์ผู้รับปรึกษาต้องบันทึกผลการประเมินและข้อแนะนำการรักษาพร้อมลงลายมือชื่อและเวลาทันเวลา';
        } else if (isWarning) {
          action = 'กำกับติดตามเวลาตอบรับการปรึกษา (Response Time) และการบันทึกนำข้อแนะนำไปปฏิบัติในแผนการรักษาของผู้ป่วย';
        } else {
          action = 'รักษามาตรฐานระบบบันทึกการส่งต่อและตอบรับการปรึกษาทางคลินิกอย่างมีประสิทธิภาพ';
        }
      } else if (nameLower.includes('anesthetic') || nameLower.includes('ระงับความรู้สึก')) {
        if (isCritical) {
          action = 'วิสัญญีแพทย์/พยาบาลวิสัญญีต้องบันทึก Pre-anesthetic evaluation, Vital signs ทุก 5 นาทีระหว่างระงับความรู้สึก, ยาและสารน้ำที่ให้, และ Post-anesthetic discharge score';
        } else if (isWarning) {
          action = 'เน้นย้ำการบันทึกภาวะแทรกซ้อนระหว่างและหลังการระงับความรู้สึก และการประเมินซ้ำก่อนย้ายออกจากห้องพักฟื้น (PACU)';
        } else {
          action = 'คงมาตรฐานความปลอดภัยทางวิสัญญีวิทยาและการบันทึกเฝ้าระวังผู้ป่วยอย่างต่อเนื่องตามเกณฑ์มาตรฐาน';
        }
      } else if (nameLower.includes('labour') || nameLower.includes('delivery') || nameLower.includes('คลอด')) {
        if (isCritical) {
          action = 'สูติแพทย์/พยาบาลผดุงครรภ์ต้องบันทึก Partograph ทุกเคสคลอดธรรมชาติ, Fetal Heart Sound, ระยะการคลอด, น้ำหนักทารก, APGAR score นาทีที่ 1, 5, 10 และ EBL ให้ครบถ้วน';
        } else if (isWarning) {
          action = 'กำกับติดตามการลงเวลาการเกิดของทารก การตรวจรกและสายสะดือ และการประเมินการตกเลือดหลังคลอดใน 2 ชั่วโมงแรกอย่างใกล้ชิด';
        } else {
          action = 'รักษามาตรฐานการเฝ้าระวังมารดาและทารกตามแนวทางเวชปฏิบัติสูติศาสตร์อย่างเคร่งครัด';
        }
      } else if (nameLower.includes('nurse') || nameLower.includes('พยาบาล')) {
        if (isCritical) {
          action = 'พยาบาลวิชาชีพต้องบันทึกการพยาบาลแรกรับ, การวินิจฉัยทางการพยาบาล, บันทึกกระบวนการพยาบาล (Focus/DAR) ทุกเวร, การประเมินซ้ำ และสรุปการพยาบาลเมื่อจำหน่ายให้ครบถ้วน';
        } else if (isWarning) {
          action = 'เน้นการบันทึกผลลัพธ์ทางการพยาบาล (Response/R) ให้สอดคล้องกับกิจกรรมการพยาบาล และประเมินความเสี่ยงสำคัญ (Fall, แผลกดทับ, Pain)';
        } else {
          action = 'คงมาตรฐานการบันทึกทางการพยาบาลที่ต่อเนื่อง ครอบคลุม และสะท้อนคุณภาพการดูแลตามมาตรฐานวิชาชีพ';
        }
      } else if (nameLower.includes('rehabilitation') || nameLower.includes('ฟื้นฟู')) {
        if (isCritical) {
          action = 'ทีมนักกายภาพบำบัด/เวชศาสตร์ฟื้นฟูต้องบันทึกการประเมินแรกรับ แผนการฟื้นฟู ผลการรักษา และการประเมินซ้ำก่อนจำหน่ายให้ครบถ้วนทุกครั้งที่มีบริการ';
        } else if (isWarning) {
          action = 'เน้นการระบุเป้าหมายการฟื้นฟู (Goal-setting) และผลลัพธ์การฝึกอย่างเป็นรูปธรรมตามเกณฑ์ สปสช.';
        } else {
          action = 'คงมาตรฐานการบันทึกการฟื้นฟูสมรรถภาพและประสานการดูแลร่วมกับทีมสหวิชาชีพอย่างต่อเนื่อง';
        }
      } else {
        // Fallback for general or specific sub-categories
        if (isCritical) {
          action = 'จัดประชุมทบทวนเวชระเบียน (MRA Committee) แบบ 100% ในหมวดนี้ และกำหนดมาตรการเชิงระบบ (System Alert) เพื่อแก้ไขข้อบกพร่องเร่งด่วน';
        } else if (isWarning) {
          action = 'สื่อสารแนวทางการบันทึกและกำกับติดตามให้บุคลากรผู้รับผิดชอบบันทึกข้อมูลให้ครบถ้วนเพื่อยกระดับคะแนนให้ผ่านเกณฑ์ 80%';
        } else {
          action = 'รักษามาตรฐานคุณภาพการบันทึกข้อมูล และสุ่มตรวจติดตามเพื่อป้องกันการตกหล่นของข้อมูลสำคัญ';
        }
      }

      return action;
    };

    const topDeficiencies = categories
      .filter((c) => c.totalEvaluations > 0 && c.totalFullScore > 0)
      .slice(0, 5)
      .map((c, idx) => {
        const recommendation = getClinicalRecommendation(
          c.serviceType,
          c.contentNo,
          c.contentName,
          c.complianceRate,
          c.missingCount
        );

        const note =
          c.missingCount > 0
            ? `พบเอกสารสูญหาย ${c.missingCount} รายการ — ต้องเร่งติดตามระบบจัดเก็บเอกสารเวชระเบียนเพื่อป้องกันการถูกตัด 0 คะแนนตามเกณฑ์ สปสช.`
            : null;

        return {
          rank: idx + 1,
          serviceType: c.serviceType,
          categoryName: c.contentName,
          complianceRate: c.complianceRate,
          gapToTarget: Number((Math.max(0, 80.0 - c.complianceRate)).toFixed(2)),
          missingCount: c.missingCount,
          recommendation,
          note,
        };
      });

    // 7. Available Months Filter Options
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

    return NextResponse.json({
      success: true,
      data: {
        kpi: {
          totalAudited,
          passedCount,
          failedCount,
          passRate,
          avgPercentage,
          targetBenchmark,
          isTargetMet,
          findingBreakdown: {
            noIssue: noIssueCount,
            certainIssues: certainIssuesCount,
            inadequate: inadequateCount,
          },
        },
        monthlyTrends,
        serviceComparison,
        categories,
        topDeficiencies,
        availableMonths,
      },
    });
  } catch (error) {
    console.error('Error fetching MRA dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch executive dashboard data' },
      { status: 500 }
    );
  }
}
