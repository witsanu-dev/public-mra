import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth-token';

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
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
