import { UserRole, AuthUser } from './auth-token';
import { NextResponse } from 'next/server';

/**
 * MRA Role-Based Access Control (RBAC) System
 * Standards:
 * - Administrator: Full Access (Settings, Create, Edit, Delete, Revoke, Sample)
 * - Auditor: Audit & Sample (Can audit, save, create sampling batches; CANNOT delete or access settings)
 * - Officer: Read-Only (Can view reports, summaries, charts; CANNOT edit, save, delete, sample, or access settings)
 */

export const RBAC = {
  /**
   * Check if user is Administrator (Full Access)
   */
  isAdmin(role?: UserRole | null): boolean {
    return role === 'Administrator';
  },

  /**
   * Check if user is Auditor
   */
  isAuditor(role?: UserRole | null): boolean {
    return role === 'Auditor';
  },

  /**
   * Check if user is Officer (Read-Only)
   */
  isOfficer(role?: UserRole | null): boolean {
    return role === 'Officer';
  },

  /**
   * Can access and manage system settings (/settings) - Admin only
   */
  canManageSettings(role?: UserRole | null): boolean {
    return role === 'Administrator';
  },

  /**
   * Can view system audit logs (/audit-logs) - Accessible to all authenticated users
   */
  canViewAuditLogs(role?: UserRole | null): boolean {
    return role === 'Administrator' || role === 'Auditor' || role === 'Officer';
  },

  /**
   * Can edit batch metadata (batchName, note) - Admin and Auditor
   */
  canEditBatch(role?: UserRole | null): boolean {
    return role === 'Administrator' || role === 'Auditor';
  },

  /**
   * Can cancel or reactivate sampling batches (soft state toggle) - Admin and Auditor
   */
  canCancelBatch(role?: UserRole | null): boolean {
    return role === 'Administrator' || role === 'Auditor';
  },

  /**
   * Can permanently delete sampling batches from database - Strictly Admin only
   */
  canDeleteBatch(role?: UserRole | null): boolean {
    return role === 'Administrator';
  },

  /**
   * Can revoke/cancel audit evaluation of a case (revert to pending status) - Admin and Auditor
   */
  canRevokeAudit(role?: UserRole | null): boolean {
    return role === 'Administrator' || role === 'Auditor';
  },

  /**
   * Can permanently purge/delete audit evaluation records - Strictly Admin only
   */
  canPurgeAudit(role?: UserRole | null): boolean {
    return role === 'Administrator';
  },

  /**
   * Can perform chart audits and save audit results - Admin and Auditor
   */
  canSaveAudit(role?: UserRole | null): boolean {
    return role === 'Administrator' || role === 'Auditor';
  },

  /**
   * Can create sampling batches from HIS - Admin and Auditor
   */
  canCreateSample(role?: UserRole | null): boolean {
    return role === 'Administrator' || role === 'Auditor';
  },

  /**
   * Is current user in Read-Only mode - Officer
   */
  isReadOnly(role?: UserRole | null): boolean {
    return role === 'Officer';
  },
};

/**
 * Standard HTTP 403 Forbidden Response Helper
 */
export function forbiddenResponse(message = 'Forbidden: ท่านไม่มีสิทธิ์ดำเนินการนี้ตามนโยบายความปลอดภัย') {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'FORBIDDEN',
    },
    { status: 403 }
  );
}
