/** Dual-role helpers: admin privilege (role) + employee participation (isEmployee). */

export type PrivilegeRole = 'admin' | 'employee';
export type InviteRole = 'admin' | 'employee' | 'both';

export type AccessFlags = {
  role: PrivilegeRole;
  isEmployee: boolean;
};

export function parseInviteRole(value: unknown): InviteRole {
  if (value === 'both' || value === 'admin_employee' || value === 'admin+employee') return 'both';
  if (value === 'admin') return 'admin';
  return 'employee';
}

export function flagsFromInviteRole(inviteRole: InviteRole): AccessFlags {
  if (inviteRole === 'both') return { role: 'admin', isEmployee: true };
  if (inviteRole === 'admin') return { role: 'admin', isEmployee: false };
  return { role: 'employee', isEmployee: true };
}

export function flagsFromStored(role: unknown, isEmployee: unknown): AccessFlags {
  const isAdmin = role === 'admin';
  const employeeFlag =
    isEmployee === undefined || isEmployee === null
      ? true
      : Number(isEmployee) === 1 || isEmployee === true;
  if (isAdmin) return { role: 'admin', isEmployee: employeeFlag };
  return { role: 'employee', isEmployee: true };
}

/** Merge an invite onto an existing account — never drops admin; employee sticks once granted. */
export function mergeAccess(existing: AccessFlags, inviteRole: InviteRole): AccessFlags {
  const incoming = flagsFromInviteRole(inviteRole);
  const isAdmin = existing.role === 'admin' || incoming.role === 'admin';
  if (!isAdmin) return { role: 'employee', isEmployee: true };
  return {
    role: 'admin',
    isEmployee: existing.isEmployee || incoming.isEmployee,
  };
}

export function accessFromToggles(isAdmin: boolean, isEmployee: boolean): AccessFlags {
  if (!isAdmin && !isEmployee) throw new Error('Kies minstens beheerder of medewerker.');
  if (!isAdmin) return { role: 'employee', isEmployee: true };
  return { role: 'admin', isEmployee };
}

export function isAdminUser(user: { role?: unknown; isAdmin?: boolean }): boolean {
  if (user.isAdmin === true) return true;
  return user.role === 'admin';
}

export function isEmployeeUser(user: { role?: unknown; isEmployee?: boolean }): boolean {
  if (typeof user.isEmployee === 'boolean') return user.isEmployee;
  return true;
}

export function roleLabelNl(flags: AccessFlags): string {
  if (flags.role === 'admin' && flags.isEmployee) return 'Beheerder + Medewerker';
  if (flags.role === 'admin') return 'Beheerder';
  return 'Medewerker';
}
