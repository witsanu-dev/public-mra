import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let filename = (searchParams.get('filename') || 'คู่มือการประเมินคุณภาพการบันทึกเวชระเบียน_สปสช.pdf').trim();

    if (!filename.toLowerCase().endsWith('.pdf')) {
      filename += '.pdf';
    }

    // Statically scoped manual.pdf in project docs directory
    const filePath = path.join(process.cwd(), 'docs', 'manual.pdf');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบไฟล์คู่มือบนเซิร์ฟเวอร์' },
        { status: 404 }
      );
    }

    const fileStat = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    // 1. JSON Base64 mode: 100% immune to IDM, download managers, and browser interceptors
    if (searchParams.get('format') === 'base64' || searchParams.get('json') === 'true') {
      return NextResponse.json(
        {
          success: true,
          data: fileBuffer.toString('base64'),
          size: fileStat.size,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
          },
        }
      );
    }

    const isDownload = searchParams.get('download') === 'true';
    const isStream = searchParams.get('stream') === 'true' || searchParams.get('inline') === 'true';
    const encodedFilename = encodeURIComponent(filename);

    const headers: Record<string, string> = {
      'Content-Length': fileStat.size.toString(),
      'Cache-Control': 'public, max-age=86400',
    };

    if (isDownload) {
      headers['Content-Type'] = 'application/pdf';
      headers['Content-Disposition'] = `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`;
    } else {
      // In-page streaming mode: application/octet-stream + inline prevents download interceptors (like IDM) from snatching the request
      headers['Content-Type'] = 'application/octet-stream';
      headers['Content-Disposition'] = 'inline';
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error downloading manual:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์' },
      { status: 500 }
    );
  }
}
