import { NextResponse } from 'next/server';
import { queryHis, getHisHospitalInfo } from '@/lib/db-his';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startTime = Date.now();
  try {
    const rows = await queryHis<RowDataPacket[]>('SELECT 1 as is_alive');
    const latencyMs = Date.now() - startTime;
    const isAlive = rows && rows.length > 0;

    let hospitalInfo = null;
    if (isAlive) {
      try {
        hospitalInfo = await getHisHospitalInfo();
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      {
        success: true,
        connected: isAlive,
        latencyMs,
        hospitalCode: hospitalInfo?.hcode || undefined,
        hospitalName: hospitalInfo?.hname || undefined,
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        latencyMs: Date.now() - startTime,
        error: error?.message || 'Connection failed',
        checkedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}
