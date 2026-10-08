/**
 * Application Core Constants
 * Single Source of Truth for system versioning and hospital branding
 */
export const APP_VERSION = '69.10.3.7';
export const APP_YEAR = '2026';
export const APP_TITLE = 'ระบบประเมินคุณภาพการบันทึกเวชระเบียน (e-MRA 2563)';

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
