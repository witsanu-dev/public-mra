import { NextRequest, NextResponse } from 'next/server';
import { queryHis, getHisHospitalInfo } from '@/lib/db-his';
import { RowDataPacket } from 'mysql2/promise';

interface HisIpdVisitRow extends RowDataPacket {
  an: string;
  hn: string;
  cid: string;
  patient_name: string;
  sex: string;
  age_y: number;
  regdate: string;
  regtime: string;
  dchdate: string;
  dchtime: string;
  ward_code: string;
  ward_name: string;
  pdx: string;
  diagnosis_name: string;
  pttype_name: string;
  dchstts: string;
  dchtype: string;
  length_of_stay: number;
}

/**
 * GET /api/his/ipd-search
 * High-performance, read-only search of IPD visits from hospital HIS
 * Query params:
 *  - q: search keyword (HN, AN, CID, or patient name)
 *  - date: admit date or discharge date (YYYY-MM-DD, optional)
 *  - limit: default 20 (max 50)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const date = (searchParams.get('date') || '').trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50);

    // 1. Fetch Hospital Info dynamically from HIS
    const hospital = await getHisHospitalInfo();

    // 2. Build where conditions with index optimizations
    const whereClauses: string[] = [
      "a.pdx IS NOT NULL AND a.pdx != ''", // Completed doctor diagnosis required for MRA audit
    ];
    const queryParams: unknown[] = [];

    if (date) {
      whereClauses.push('(i.regdate = ? OR i.dchdate = ?)');
      queryParams.push(date, date);
    } else {
      // By default, search recently discharged patients
      whereClauses.push('i.dchdate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
    }

    if (q) {
      if (/^\d+$/.test(q)) {
        if (q.length === 13) {
          // CID 13 digits: find patient first by CID
          const patientRows = await queryHis<RowDataPacket[]>(
            `SELECT hn FROM patient WHERE cid = ? LIMIT 10`,
            [q]
          );
          const foundHns = patientRows.map((p) => p.hn);
          if (foundHns.length > 0) {
            whereClauses.push(`i.hn IN (${foundHns.map(() => '?').join(',')})`);
            queryParams.push(...foundHns);
          } else {
            whereClauses.push('(i.hn = ? OR i.an = ?)');
            queryParams.push(q, q);
          }
        } else if (q.length >= 7) {
          // Exact or prefix HN/AN
          whereClauses.push('(i.hn = ? OR i.an = ? OR i.hn LIKE ? OR i.an LIKE ?)');
          queryParams.push(q, q, `${q}%`, `${q}%`);
        } else {
          whereClauses.push('(i.hn = ? OR i.hn LIKE ?)');
          queryParams.push(q, `${q}%`);
        }
      } else {
        // Name search
        const patientRows = await queryHis<RowDataPacket[]>(
          `SELECT hn FROM patient 
           WHERE fname LIKE ? OR lname LIKE ? OR CONCAT(fname, ' ', lname) LIKE ?
           LIMIT 25`,
          [`%${q}%`, `%${q}%`, `%${q}%`]
        );
        const foundHns = patientRows.map((p) => p.hn);
        if (foundHns.length > 0) {
          whereClauses.push(`i.hn IN (${foundHns.map(() => '?').join(',')})`);
          queryParams.push(...foundHns);
        } else {
          return NextResponse.json({
            success: true,
            data: { hospital, count: 0, visits: [] },
          });
        }
      }
    }

    const whereSql = whereClauses.join(' AND ');

    const sql = `
      SELECT 
        i.an,
        i.hn,
        p.cid,
        CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS patient_name,
        p.sex,
        a.age_y,
        DATE_FORMAT(i.regdate, '%Y-%m-%d') AS regdate,
        TIME_FORMAT(i.regtime, '%H:%i') AS regtime,
        DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
        TIME_FORMAT(i.dchtime, '%H:%i') AS dchtime,
        i.ward AS ward_code,
        COALESCE(w.name, '') AS ward_name,
        a.pdx,
        COALESCE(icd.name, a.pdx, 'ไม่ระบุ') AS diagnosis_name,
        COALESCE(pt.name, '') AS pttype_name,
        i.dchstts,
        i.dchtype,
        COALESCE(a.los, DATEDIFF(i.dchdate, i.regdate), 0) AS length_of_stay
      FROM ipt i
      INNER JOIN patient p ON p.hn = i.hn
      INNER JOIN an_stat a ON a.an = i.an
      LEFT JOIN ward w ON w.ward = i.ward
      LEFT JOIN icd101 icd ON icd.code = a.pdx
      LEFT JOIN pttype pt ON pt.pttype = i.pttype
      WHERE ${whereSql}
      ORDER BY i.dchdate DESC, i.dchtime DESC, i.regdate DESC
      LIMIT ?
    `;

    queryParams.push(limit);

    const rows = await queryHis<HisIpdVisitRow[]>(sql, queryParams);

    const visits = rows.map((r) => ({
      an: r.an,
      hn: r.hn,
      cid: r.cid || '',
      patientName: r.patient_name || '',
      sex: r.sex === '1' ? 'ชาย' : r.sex === '2' ? 'หญิง' : '',
      age: r.age_y || 0,
      admitDate: r.regdate,
      admitTime: r.regtime || '00:00',
      dischargeDate: r.dchdate || '',
      dischargeTime: r.dchtime || '00:00',
      wardCode: r.ward_code || '',
      wardName: r.ward_name || '',
      pdx: r.pdx || '',
      diagnosisName: r.diagnosis_name || '',
      diagnosisDisplay: r.pdx ? `${r.pdx} : ${r.diagnosis_name}` : r.diagnosis_name || '-',
      pttypeName: r.pttype_name || '',
      lengthOfStay: Math.max(1, Math.round(Number(r.length_of_stay) || 0)),
      dischargeStatus: r.dchstts || '',
      dischargeType: r.dchtype || '',
    }));

    return NextResponse.json({
      success: true,
      data: {
        hospital,
        count: visits.length,
        visits,
      },
    });
  } catch (error) {
    console.error('Error searching HIS IPD visits:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูล IPD จากระบบ HIS',
      },
      { status: 500 }
    );
  }
}
