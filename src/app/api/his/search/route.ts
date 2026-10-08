import { NextRequest, NextResponse } from 'next/server';
import { queryHis, getHisHospitalInfo } from '@/lib/db-his';
import { RowDataPacket } from 'mysql2/promise';

interface HisVisitRow extends RowDataPacket {
  vn: string;
  hn: string;
  cid: string;
  patient_name: string;
  sex: string;
  age_y: number;
  vstdate: string;
  vsttime: string;
  pdx: string;
  diagnosis_name: string;
  pttype_name: string;
  department: string;
  doctor_name: string;
  chief_complaint: string;
  is_chronic: number;
  is_psychiatric: number;
}


/**
 * GET /api/his/search
 * High-performance, read-only search of patient visits from hospital HIS
 * Query params:
 *  - q: search keyword (HN, VN, CID, or patient name)
 *  - date: visit date (YYYY-MM-DD, optional)
 *  - caseType: 'all' | 'general' | 'chronic' | 'psychiatric' | 'er' (optional)
 *  - limit: default 20 (max 50)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const date = (searchParams.get('date') || '').trim();
    const caseType = (searchParams.get('caseType') || 'all').trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50);

    // 1. Fetch Hospital Info dynamically from HIS (Read-Only)
    const hospital = await getHisHospitalInfo();

    // 2. Build where conditions with index optimizations
    const whereClauses: string[] = [
      'o.an IS NULL', // OPD/ER only
      "v.pdx IS NOT NULL AND v.pdx != ''", // Completed doctor diagnosis required for MRA audit
    ];
    const queryParams: unknown[] = [];

    if (date) {
      whereClauses.push('o.vstdate = ?');
      queryParams.push(date);
    } else {
      // Exclude future appointment slots
      whereClauses.push('o.vstdate <= CURDATE()');
    }

    if (q) {
      if (/^\d+$/.test(q)) {
        if (q.length === 13) {
          // CID 13 digits: find patient first by CID (indexed)
          const patientRows = await queryHis<RowDataPacket[]>(
            `SELECT hn FROM patient WHERE cid = ? LIMIT 10`,
            [q]
          );
          const foundHns = patientRows.map((p) => p.hn);
          if (foundHns.length > 0) {
            whereClauses.push(`o.hn IN (${foundHns.map(() => '?').join(',')})`);
            queryParams.push(...foundHns);
          } else {
            // fallback directly
            whereClauses.push('(o.hn = ? OR o.vn = ?)');
            queryParams.push(q, q);
          }
        } else if (q.length >= 7) {
          // Exact or prefix HN/VN
          whereClauses.push('(o.hn = ? OR o.vn = ? OR o.hn LIKE ? OR o.vn LIKE ?)');
          queryParams.push(q, q, `${q}%`, `${q}%`);
        } else {
          whereClauses.push('(o.hn = ? OR o.hn LIKE ?)');
          queryParams.push(q, `${q}%`);
        }
      } else {
        // Name search: query patient table first (fast index on fname/lname)
        const patientRows = await queryHis<RowDataPacket[]>(
          `SELECT hn FROM patient 
           WHERE fname LIKE ? OR lname LIKE ? OR CONCAT(fname, ' ', lname) LIKE ?
           LIMIT 25`,
          [`%${q}%`, `%${q}%`, `%${q}%`]
        );
        const foundHns = patientRows.map((p) => p.hn);
        if (foundHns.length > 0) {
          whereClauses.push(`o.hn IN (${foundHns.map(() => '?').join(',')})`);
          queryParams.push(...foundHns);
        } else {
          // No matching patients found
          return NextResponse.json({
            success: true,
            data: { hospital, count: 0, visits: [] },
          });
        }
      }
    } else if (!date) {
      // If neither keyword nor date is provided, limit to recent 14 days to use vstdate index fast
      whereClauses.push('o.vstdate >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)');
    }

    // Filter by case type (Unified criteria)
    const psychiatricCondition = `(
      v.pdx REGEXP '^F[0-9]'
      OR k.department LIKE '%จิตเวช%'
      OR k.department LIKE '%สุขภาพจิต%'
      OR k.department LIKE '%ยาเสพติด%'
      OR EXISTS (SELECT 1 FROM ovstdiag od WHERE od.vn = o.vn AND od.icd10 REGEXP '^F[0-9]')
    )`;

    const chronicCondition = `(
      v.pdx REGEXP '^(E1[0-4]|I1[0-5]|J4[4-5]|N18|I6[0-9])'
      OR k.department LIKE '%เรื้อรัง%'
      OR k.department LIKE '%NCD%'
      OR k.department LIKE '%เบาหวาน%'
      OR k.department LIKE '%ความดัน%'
    )`;

    if (caseType === 'psychiatric') {
      whereClauses.push(psychiatricCondition);
    } else if (caseType === 'chronic') {
      whereClauses.push(chronicCondition);
    } else if (caseType === 'er') {
      whereClauses.push(`(
        EXISTS (SELECT 1 FROM er_regist er WHERE er.vn = o.vn)
        OR k.department LIKE '%ฉุกเฉิน%'
      )`);
    } else if (caseType === 'general') {
      whereClauses.push(`NOT (${chronicCondition} OR ${psychiatricCondition})`);
    }

    const whereSql = whereClauses.join(' AND ');

    const sql = `
      SELECT 
        o.vn,
        o.hn,
        p.cid,
        CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS patient_name,
        p.sex,
        TIMESTAMPDIFF(YEAR, p.birthday, o.vstdate) AS age_y,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i') AS vsttime,
        v.pdx,
        COALESCE(i.name, v.pdx, 'ไม่ระบุ') AS diagnosis_name,
        COALESCE(pt.name, '') AS pttype_name,
        COALESCE(k.department, '') AS department,
        COALESCE(d.name, '') AS doctor_name,
        COALESCE(s.cc, '') AS chief_complaint,
        CASE 
          WHEN (
            v.pdx REGEXP '^(E1[0-4]|I1[0-5]|J4[4-5]|N18|I6[0-9])'
            OR k.department LIKE '%เรื้อรัง%'
            OR k.department LIKE '%NCD%'
            OR k.department LIKE '%เบาหวาน%'
            OR k.department LIKE '%ความดัน%'
          ) THEN 1
          ELSE 0
        END AS is_chronic,
        CASE
          WHEN (
            v.pdx REGEXP '^F[0-9]'
            OR k.department LIKE '%จิตเวช%'
            OR k.department LIKE '%สุขภาพจิต%'
            OR k.department LIKE '%ยาเสพติด%'
            OR EXISTS (SELECT 1 FROM ovstdiag od WHERE od.vn = o.vn AND od.icd10 REGEXP '^F[0-9]')
          ) THEN 1
          ELSE 0
        END AS is_psychiatric
      FROM ovst o
      INNER JOIN patient p ON p.hn = o.hn
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN icd101 i ON i.code = v.pdx
      LEFT JOIN pttype pt ON pt.pttype = o.pttype
      LEFT JOIN kskdepartment k ON k.depcode = o.cur_dep
      LEFT JOIN doctor d ON d.code = o.doctor
      LEFT JOIN opdscreen s ON s.vn = o.vn
      WHERE ${whereSql}
      ORDER BY o.vstdate DESC, o.vsttime DESC
      LIMIT ?
    `;

    queryParams.push(limit);

    const rows = await queryHis<HisVisitRow[]>(sql, queryParams);

    const visits = rows.map((r) => {
      const isPsychiatric = Boolean(r.is_psychiatric);
      const isChronic = Boolean(r.is_chronic);
      const caseType: 'general' | 'chronic' | 'psychiatric' = isPsychiatric
        ? 'psychiatric'
        : isChronic
        ? 'chronic'
        : 'general';

      return {
        vn: r.vn,
        hn: r.hn,
        cid: r.cid || '',
        patientName: r.patient_name || '',
        sex: r.sex === '1' ? 'ชาย' : r.sex === '2' ? 'หญิง' : '',
        age: r.age_y || 0,
        vstdate: r.vstdate,
        vsttime: r.vsttime || '00:00',
        pdx: r.pdx || '',
        diagnosisName: r.diagnosis_name || '',
        diagnosisDisplay: r.pdx ? `${r.pdx} : ${r.diagnosis_name}` : r.diagnosis_name || '-',
        pttypeName: r.pttype_name || '',
        department: r.department || '',
        doctorName: r.doctor_name || '',
        chiefComplaint: r.chief_complaint || '',
        isChronic,
        isPsychiatric,
        caseType,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        hospital,
        count: visits.length,
        visits,
      },
    });
  } catch (error) {
    console.error('Error searching HIS visits:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ HIS',
      },
      { status: 500 }
    );
  }
}
