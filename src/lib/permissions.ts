/**
 * Household role model. Ranks are ordered; a check is "role rank >= needed".
 *
 *   VIEWER  0  read-only
 *   MEMBER  1  manage own assets / documents, run AI, import statements
 *   ADMIN   2  + manage any household asset/document, household settings,
 *              add / remove members
 *   OWNER   3  full control of the household
 *   SUPER_ADMIN 4  + the /admin portal
 */
export type Role = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

const RANK: Record<string, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
  SUPER_ADMIN: 4,
};

export function roleRank(role: string | null | undefined): number {
  return role ? RANK[role] ?? -1 : -1;
}

/** VIEWER is read-only; every other role may create/modify its own data. */
export function canWrite(role: string | null | undefined): boolean {
  return roleRank(role) >= RANK.MEMBER;
}

/**
 * ADMIN and above: change household-wide settings and act on other
 * members' assets/documents.
 */
export function canManageHousehold(role: string | null | undefined): boolean {
  return roleRank(role) >= RANK.ADMIN;
}

export const READ_ONLY_ERROR = 'Your account has view-only access.';
export const FORBIDDEN_ERROR = 'You do not have permission to do that.';
