import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth-token';
import {
  DEVELOPER_NAME,
  DEVELOPER_ALIAS,
  DEVELOPER_POSITION,
  DEVELOPER_ORGANIZATION,
  DEVELOPER_SIGNATURE,
  computeDeveloperHash,
} from '@/lib/constants';

/**
 * Hardcoded Expected SHA-256 Author Signature (Immutable Double-Check)
 */
const REQUIRED_AUTHOR_SIGNATURE = '56bbd280aadba91a3567c573b3c6179d743e54bae0b598a81d82a6f2583993b5';

/**
 * Render tamper detection security response
 */
function createTamperDetectedResponse(isApi: boolean): NextResponse {
  if (isApi) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'TAMPER_DETECTED: ข้อมูลลิขสิทธิ์และชื่อผู้พัฒนาถูกดัดแปลง การอนุญาตให้ใช้งานสิ้นสุดลงทันทีตาม พ.ร.บ. ลิขสิทธิ์ พ.ศ. 2537 (ห้ามจำหน่าย แจกจ่ายต่อ หรือใช้ในเชิงพาณิชย์)',
        code: 'INTEGRITY_VIOLATION',
        policy: {
          license: 'e-MR Audit Software Trial License (Non-Commercial)',
          conditions: 'ห้ามดัดแปลง ลบ หรือแก้ไขชื่อผู้พัฒนา ห้ามจำหน่าย แจกจ่ายต่อ หรือใช้ในเชิงพาณิชย์โดยเด็ดขาด',
        },
        author: {
          name: 'นายวิษณุ ศรีโยธา (wITsaNU _<)',
          position: 'นักวิชาการคอมพิวเตอร์',
          organization: 'กลุ่มงานสุขภาพดิจิทัล โรงพยาบาลกมลาไสย จังหวัดกาฬสินธุ์',
        },
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Security & License Violation - e-MR Audit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #1e293b; border: 1px solid #ef4444; border-radius: 8px; max-width: 640px; width: 100%; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); text-align: left; }
    .badge { display: inline-block; background: #dc2626; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 10px 0; }
    p { font-size: 13px; color: #cbd5e1; line-height: 1.6; margin: 0 0 14px 0; }
    .alert-box { background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; font-size: 12.5px; color: #fca5a5; line-height: 1.5; }
    .box { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 16px; margin-bottom: 18px; }
    .box-title { font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em; }
    .author-name { font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 4px; }
    .author-desc { font-size: 12px; color: #94a3b8; }
    .rules { font-size: 12px; color: #94a3b8; line-height: 1.6; padding-left: 18px; margin: 12px 0; }
    .footer-note { font-size: 11px; color: #64748b; border-top: 1px solid #334155; padding-top: 14px; margin-top: 18px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Security Alert • Tamper & License Violation</div>
    <h1>ระบบตรวจพบการดัดแปลงข้อมูลผู้พัฒนาและเงื่อนไขลิขสิทธิ์</h1>
    <p>ระบบ e-MR Audit (Electronic Medical Record Audit) ตรวจพบว่าข้อมูลชื่อ ตำแหน่ง หรือหน่วยงานผู้พัฒนาถูกดัดแปลงหรือแก้ไข ซึ่งขัดต่อเงื่อนไขสัญญาอนุญาตให้ใช้งาน (Software Trial License Agreement)</p>
    
    <div class="alert-box">
      <strong>คำชี้แจงทางกฎหมายและนโยบาย:</strong><br />
      ระบบ e-MR Audit พัฒนาโดย นายวิษณุ ศรีโยธา กลุ่มงานสุขภาพดิจิทัล โรงพยาบาลกมลาไสย อนุญาตให้หน่วยบริการทดลองใช้งานโดยไม่มีค่าใช้จ่าย โดยมีเงื่อนไขห้ามดัดแปลง ลบ หรือแก้ไขข้อความแสดงสิทธิและเครดิตผู้พัฒนา การดัดแปลงแก้ไขถือเป็นการสิ้นสุดการอนุญาตให้ใช้งานและถือเป็นการละเมิดลิขสิทธิ์ตาม พ.ร.บ. ลิขสิทธิ์ พ.ศ. 2537 และฉบับแก้ไขเพิ่มเติม
    </div>

    <ul class="rules">
      <li><strong>ห้ามจำหน่ายหรือใช้ในเชิงพาณิชย์:</strong> ห้ามนำไปจำหน่าย แสวงหากำไร หรือคิดค่าบริการในเชิงพาณิชย์โดยเด็ดขาด</li>
      <li><strong>ห้ามแจกจ่ายต่อโดยมิชอบ:</strong> ห้ามนำไปเผยแพร่หรือแจกจ่ายต่อในนามบุคคลอื่นโดยไม่ได้รับความยินยอมเป็นลายลักษณ์อักษร</li>
      <li><strong>การแก้ไขเพื่อเข้าใช้งาน:</strong> กรุณาใช้ข้อมูลเครดิตผู้พัฒนาต้นฉบับใน <code>src/lib/constants.ts</code> เพื่อเข้าใช้งานตามปกติ</li>
    </ul>

    <div class="box">
      <div class="box-title">ข้อมูลผู้พัฒนาต้นฉบับ (Original Author)</div>
      <div class="author-name">นายวิษณุ ศรีโยธา <span style="font-family: monospace; font-size: 13px; color: #38bdf8; background: #0284c720; padding: 2px 6px; border-radius: 4px; border: 1px solid #38bdf840; margin-left: 6px;">wITsaNU _&lt;</span></div>
      <div class="author-desc">นักวิชาการคอมพิวเตอร์</div>
      <div class="author-desc">กลุ่มงานสุขภาพดิจิทัล โรงพยาบาลกมลาไสย จังหวัดกาฬสินธุ์</div>
    </div>
    
    <div class="footer-note">e-MR Audit Electronic Medical Record Audit • All Rights Reserved (Non-Commercial Trial License)</div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 403,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

/**
 * Public routes that do not require authentication
 */
const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/login/2fa',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/his/status',
  '/api/settings/db',
  '/api/settings/db/test',
  '/api/settings/db/backup',
  '/api/docs/manual',
]);

/**
 * File extensions that are treated as public static assets
 */
const PUBLIC_EXTENSIONS = [
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.gif',
  '.pdf',
  '.css',
  '.js',
  '.map',
  '.woff',
  '.woff2',
  '.ttf',
];

/**
 * Sanitize callback URL to prevent open redirect vulnerabilities
 */
function sanitizeCallbackUrl(url: string | null): string {
  if (!url) return '/dashboard';
  let clean = url.trim();
  // Strip /mra prefix if present
  if (clean.startsWith('/mra')) {
    clean = clean.slice(4) || '/dashboard';
  }
  // Prevent redirect loops to login or blank
  if (clean === '/login' || clean === '' || clean === '/') {
    return '/dashboard';
  }
  if (clean.startsWith('/') && !clean.startsWith('//')) {
    return clean;
  }
  return '/dashboard';
}

/**
 * Apply hospital-grade security headers to all responses
 */
function applySecurityHeaders(res: NextResponse): NextResponse {
  // Prevent clickjacking
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  // Prevent MIME sniffing
  res.headers.set('X-Content-Type-Options', 'nosniff');
  // Control referrer information
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Disallow search engine indexing of sensitive medical record audit screens
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Allow Next.js internal files immediately
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/_next')) {
    return NextResponse.next();
  }

  // 2. Allow public static assets
  for (const ext of PUBLIC_EXTENSIONS) {
    if (pathname.endsWith(ext)) {
      return NextResponse.next();
    }
  }

  // ── 0. Author Tamper Integrity Check ──
  const computedAuthorHash = await computeDeveloperHash(
    DEVELOPER_NAME,
    DEVELOPER_ALIAS,
    DEVELOPER_POSITION,
    DEVELOPER_ORGANIZATION
  );
  if (
    computedAuthorHash !== REQUIRED_AUTHOR_SIGNATURE ||
    DEVELOPER_SIGNATURE !== REQUIRED_AUTHOR_SIGNATURE
  ) {
    return createTamperDetectedResponse(pathname.startsWith('/api/'));
  }

  // 3. Allow public paths
  const isPublicPath = PUBLIC_PATHS.has(pathname) || pathname.startsWith('/docs/');

  // 4. Extract and verify session cookie using Web Crypto HMAC-SHA256
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await verifySessionToken(token) : null;

  // 5. Handling for Login Page (/login)
  if (pathname === '/login') {
    // If already authenticated with a valid session, redirect away to application
    if (user) {
      const callbackParam = req.nextUrl.searchParams.get('callbackUrl');
      const targetPath = sanitizeCallbackUrl(callbackParam);
      const targetUrl = new URL(req.nextUrl.basePath ? `${req.nextUrl.basePath}${targetPath}` : targetPath, req.url);
      return NextResponse.redirect(targetUrl);
    }
    // Otherwise allow access to login page
    return applySecurityHeaders(NextResponse.next());
  }

  // 6. If user is NOT authenticated on a protected route
  if (!user && !isPublicPath) {
    // 6a. API endpoints: return strict 401 Unauthorized JSON
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: กรุณาเข้าสู่ระบบก่อนเข้าถึงข้อมูล',
          code: 'AUTH_REQUIRED',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'WWW-Authenticate': 'Bearer error="invalid_token"',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'X-Content-Type-Options': 'nosniff',
          },
        }
      );
    }

    // 6b. UI Pages: Redirect directly to /login with callbackUrl
    const loginUrl = new URL(req.nextUrl.basePath ? `${req.nextUrl.basePath}/login` : '/login', req.url);
    if (pathname !== '/' && pathname !== '/login') {
      loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 7. Role-Based Access Control (RBAC) Route Protection
  if (user && (pathname === '/settings' || pathname.startsWith('/settings/'))) {
    if (user.role !== 'Administrator') {
      const destUrl = new URL(req.nextUrl.basePath ? `${req.nextUrl.basePath}/dashboard?unauthorized=settings` : '/dashboard?unauthorized=settings', req.url);
      return NextResponse.redirect(destUrl);
    }
  }

  // 8. Request is authorized: forward with verified user headers and security headers
  const requestHeaders = new Headers(req.headers);
  if (user) {
    requestHeaders.set('x-user-login', user.loginname);
    requestHeaders.set('x-user-role', user.role);
    if (user.doctorCode) {
      requestHeaders.set('x-user-doctor-code', user.doctorCode);
    }
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return applySecurityHeaders(response);
}

export default proxy;

export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
