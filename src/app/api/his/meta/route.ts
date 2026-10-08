import { NextResponse } from 'next/server';
import { queryHis, getHisHospitalInfo } from '@/lib/db-his';
import { RowDataPacket } from 'mysql2/promise';

interface ClinicRow extends RowDataPacket {
  clinic: string;
  name: string;
}

export async function GET() {
  try {
    // 1. Fetch Hospital code & name dynamically from HIS (Read-Only)
    const hospital = await getHisHospitalInfo();

    // 2. Fetch Active Chronic / OPD Clinics
    const clinics = await queryHis<ClinicRow[]>(
      `SELECT clinic, name FROM clinic WHERE active_status = 'Y' ORDER BY clinic ASC LIMIT 50`
    );

    // 3. Fetch Min & Max recent visit dates
    const [dateRange] = await queryHis<RowDataPacket[]>(
      `SELECT 
         DATE_FORMAT(MAX(vstdate), '%Y-%m-%d') as latest_date,
         DATE_FORMAT(DATE_SUB(MAX(vstdate), INTERVAL 30 DAY), '%Y-%m-%d') as default_start
       FROM ovst`
    );

    return NextResponse.json({
      success: true,
      data: {
        hcode: hospital.hcode,
        hname: hospital.hname,
        clinics,
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
        clinics: [],
        latestDate: today,
        defaultStart: today,
      },
    });
  }
}
