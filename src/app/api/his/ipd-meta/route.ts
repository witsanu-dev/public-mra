import { NextResponse } from 'next/server';
import { queryHis, getHisHospitalInfo } from '@/lib/db-his';
import { RowDataPacket } from 'mysql2/promise';

interface WardRow extends RowDataPacket {
  ward: string;
  name: string;
}

export async function GET() {
  try {
    // 1. Fetch Hospital code & name dynamically from HIS (Read-Only)
    const hospital = await getHisHospitalInfo();

    // 2. Fetch Active Wards from HIS
    let wards: WardRow[] = [];
    try {
      wards = await queryHis<WardRow[]>(
        `SELECT ward, name FROM ward ORDER BY ward ASC LIMIT 50`
      );
    } catch (wardErr: any) {
      const isConn =
        wardErr?.code === 'ETIMEDOUT' ||
        wardErr?.code === 'ECONNREFUSED' ||
        wardErr?.code === 'ENOTFOUND' ||
        wardErr?.message?.includes('connect') ||
        wardErr?.message?.includes('ETIMEDOUT');

      if (isConn) {
        throw wardErr;
      }

      // Only fallback to ipt table if connection succeeded but ward table is missing in this HOSxP schema
      try {
        wards = await queryHis<WardRow[]>(
          `SELECT DISTINCT i.ward, COALESCE(w.name, CONCAT('หอผู้ป่วย ', i.ward)) as name 
           FROM ipt i 
           LEFT JOIN ward w ON w.ward = i.ward 
           WHERE i.ward IS NOT NULL AND i.ward != ''
           ORDER BY i.ward ASC LIMIT 30`
        );
      } catch {
        wards = [];
      }
    }

    // 3. Fetch Min & Max recent discharge dates
    const [dateRange] = await queryHis<RowDataPacket[]>(
      `SELECT 
         DATE_FORMAT(MAX(dchdate), '%Y-%m-%d') as latest_date,
         DATE_FORMAT(DATE_SUB(MAX(dchdate), INTERVAL 30 DAY), '%Y-%m-%d') as default_start
       FROM ipt 
       WHERE dchdate IS NOT NULL`
    );

    return NextResponse.json({
      success: true,
      data: {
        hcode: hospital.hcode,
        hname: hospital.hname,
        wards: wards.map((w) => ({ ward: w.ward, name: w.name })),
        latestDate: dateRange?.latest_date || new Date().toISOString().split('T')[0],
        defaultStart: dateRange?.default_start || new Date().toISOString().split('T')[0],
      },
    });
  } catch (error) {
    const today = new Date().toISOString().split('T')[0];
    return NextResponse.json({
      success: true,
      isHisOffline: true,
      data: {
        hcode: 'MRA',
        hname: 'หน่วยบริการ e-MRA (Standalone)',
        wards: [],
        latestDate: today,
        defaultStart: today,
      },
    });
  }
}
