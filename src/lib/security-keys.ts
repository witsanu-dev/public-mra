import crypto from 'crypto';
import { RowDataPacket } from 'mysql2';
import { queryMra, executeMra } from '@/lib/db-mra';
import { encryptPassword, decryptPassword } from '@/lib/db-config';

export interface SecurityKeyRecord {
  id: number;
  key_name: string;
  key_value_encrypted: string;
  key_hint: string | null;
  description: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Generate a safe masked hint so an admin can recall the key pattern if forgotten
 * Example: 'mra@admin2026' -> 'mra@******2026'
 */
export function generateKeyHint(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 6) return trimmed[0] + '***' + trimmed[trimmed.length - 1];
  const start = trimmed.slice(0, 4);
  const end = trimmed.slice(-4);
  return `${start}******${end}`;
}

/**
 * Retrieve decrypted security key from sys_security_keys table
 * Falls back to process.env if not found in database
 */
export async function getSecurityKey(keyName: string = 'ADMIN_SETUP_KEY'): Promise<string | null> {
  try {
    const rows = await queryMra<RowDataPacket[]>(
      'SELECT key_value_encrypted, is_active FROM sys_security_keys WHERE key_name = ? AND is_active = 1 LIMIT 1',
      [keyName]
    );

    if (rows && rows.length > 0 && rows[0].key_value_encrypted) {
      const decrypted = decryptPassword(rows[0].key_value_encrypted);
      if (decrypted) return decrypted;
    }
  } catch (err) {
    // If table doesn't exist yet or DB issue, seamlessly fall through to env
  }

  // Fallback to environment variable
  if (keyName === 'ADMIN_SETUP_KEY') {
    return (process.env.ADMIN_SETUP_KEY || 'mra@admin2026').trim();
  }

  return null;
}

/**
 * Retrieve masked hint for admin recovery
 */
export async function getSecurityKeyHint(keyName: string = 'ADMIN_SETUP_KEY'): Promise<string | null> {
  try {
    const rows = await queryMra<RowDataPacket[]>(
      'SELECT key_hint FROM sys_security_keys WHERE key_name = ? AND is_active = 1 LIMIT 1',
      [keyName]
    );

    if (rows && rows.length > 0 && rows[0].key_hint) {
      return rows[0].key_hint;
    }
  } catch {
    // ignore
  }

  const envKey = process.env.ADMIN_SETUP_KEY || 'mra@admin2026';
  return generateKeyHint(envKey);
}

/**
 * Verify an input key against database and environment variable
 */
export async function verifySecurityKey(keyName: string, inputKey: string): Promise<boolean> {
  if (!inputKey) return false;
  const cleanInput = inputKey.trim();

  // 1. Fast in-memory check against process.env
  if (keyName === 'ADMIN_SETUP_KEY') {
    const envExpected = (process.env.ADMIN_SETUP_KEY || 'mra@admin2026').trim();
    if (cleanInput === envExpected) {
      recordSecurityKeyUsage(keyName).catch(() => {});
      return true;
    }
  }

  // 2. Database check against sys_security_keys
  try {
    const dbKey = await getSecurityKey(keyName);
    if (dbKey && cleanInput === dbKey.trim()) {
      recordSecurityKeyUsage(keyName).catch(() => {});
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Record last used timestamp asynchronously
 */
export async function recordSecurityKeyUsage(keyName: string): Promise<void> {
  try {
    await executeMra(
      'UPDATE sys_security_keys SET last_used_at = NOW() WHERE key_name = ?',
      [keyName]
    );
  } catch {
    // Ignore async background update failure
  }
}

/**
 * Save or update security key in sys_security_keys table
 */
export async function setSecurityKey(
  keyName: string,
  keyValue: string,
  description?: string
): Promise<void> {
  const encrypted = encryptPassword(keyValue);
  const hint = generateKeyHint(keyValue);
  const desc = description || 'Admin Security Key for System Setup, Database Config & Emergency Access';

  await executeMra(
    `INSERT INTO sys_security_keys (key_name, key_value_encrypted, key_hint, description, is_active, updated_at)
     VALUES (?, ?, ?, ?, 1, NOW())
     ON DUPLICATE KEY UPDATE 
       key_value_encrypted = VALUES(key_value_encrypted),
       key_hint = VALUES(key_hint),
       description = VALUES(description),
       is_active = 1,
       updated_at = NOW()`,
    [keyName, encrypted, hint, desc]
  );
}
