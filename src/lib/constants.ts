/**
 * Application Core Constants
 * Single Source of Truth for system versioning and hospital branding
 */
export const APP_VERSION = '69.10.1.9';
export const APP_YEAR = '2026';
export const APP_TITLE = 'ระบบประเมินคุณภาพการบันทึกเวชระเบียน (e-MRA)';

/**
 * Base Path prefix when deployed behind Reverse Proxy
 */
export const BASE_PATH = '/mra';

/**
 * Prefix URL with basePath if running under /mra
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith(BASE_PATH)) return cleanPath;
  return `${BASE_PATH}${cleanPath}`;
}

export function assetUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith(BASE_PATH)) return cleanPath;
  return `${BASE_PATH}${cleanPath}`;
}

/**
 * Developer & Authorship Metadata (Protected by Tamper Integrity Check)
 * ห้ามแก้ไขหรือดัดแปลงชื่อ ตำแหน่ง และหน่วยงานผู้พัฒนาโดยไม่ได้รับอนุญาต
 */
export const DEVELOPER_NAME = 'วิษณุ ศรีโยธา';
export const DEVELOPER_POSITION = 'นักวิชาการคอมพิวเตอร์';
export const DEVELOPER_ORGANIZATION = 'กลุ่มงานสุขภาพดิจิทัล โรงพยาบาลกมลาไสย จังหวัดกาฬสินธุ์';

/**
 * Expected SHA-256 signature for:
 * `${DEVELOPER_NAME}|${DEVELOPER_POSITION}|${DEVELOPER_ORGANIZATION}`
 */
export const DEVELOPER_SIGNATURE = '02b8d6bf3e6e98533c9fc860a4d05fb1c35f0619b638af5d47683171e5c29070';

/**
 * Computes the SHA-256 hash of developer credentials using Web Crypto API
 */
export async function computeDeveloperHash(
  name = DEVELOPER_NAME,
  position = DEVELOPER_POSITION,
  org = DEVELOPER_ORGANIZATION
): Promise<string> {
  const payload = `${name}|${position}|${org}`;
  const encoded = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies if developer metadata has been tampered with
 */
export async function verifyDeveloperIntegrity(): Promise<boolean> {
  try {
    const hash = await computeDeveloperHash();
    return hash === DEVELOPER_SIGNATURE;
  } catch {
    return false;
  }
}
