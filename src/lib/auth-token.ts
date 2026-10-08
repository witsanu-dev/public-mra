/**
 * Pure Web Crypto / Edge-compatible Authentication Token Utilities
 * Safe for use in Next.js Proxy/Middleware, Edge Runtime, and Node.js
 */

export type UserRole = 'Administrator' | 'Auditor' | 'Officer';

export interface AuthUser {
  loginname: string;
  fullName: string;
  doctorCode: string | null;
  positionId: number | null;
  positionName: string | null;
  role: UserRole;
  roleDescription: string;
  loginAt: number;
  exp?: number;
}

export const SESSION_COOKIE_NAME = 'mra_session';
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24; // 24 hours

export const SESSION_SECRET =
  process.env.SESSION_SECRET || 'mra-hospital-secure-session-key-2026';

/**
 * Helper to convert Base64URL string to Uint8Array using standard Web APIs
 */
function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binaryStr = atob(pad);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Helper to convert Uint8Array / ArrayBuffer to Base64URL string
 */
export function arrayBufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sign session payload into HMAC-SHA256 Token using Web Crypto API
 */
export async function signSessionToken(payload: AuthUser): Promise<string> {
  const exp = Date.now() + SESSION_MAX_AGE_SEC * 1000;
  const data = JSON.stringify({ ...payload, exp });
  const enc = new TextEncoder();
  const b64Data = arrayBufferToBase64Url(enc.encode(data));

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(b64Data) as unknown as BufferSource
  );
  const hmac = arrayBufferToBase64Url(sig);
  return `${b64Data}.${hmac}`;
}

/**
 * Verify HMAC-SHA256 session token using standard Web Crypto API (crypto.subtle)
 * Returns AuthUser if valid and not expired, null otherwise
 */
export async function verifySessionToken(token: string): Promise<AuthUser | null> {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [b64Data, hmac] = parts;
    if (!b64Data || !hmac) return null;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = base64UrlToUint8Array(hmac);
    const dataBytes = enc.encode(b64Data);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature as unknown as BufferSource,
      dataBytes as unknown as BufferSource
    );
    if (!isValid) return null;

    // Decode and parse JSON payload
    const payloadBytes = base64UrlToUint8Array(b64Data);
    const jsonStr = new TextDecoder().decode(payloadBytes);
    const parsed = JSON.parse(jsonStr) as AuthUser;

    if (!parsed.exp || Date.now() > parsed.exp) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
