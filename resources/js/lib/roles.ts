/**
 * Shared role helpers.
 *
 * The roles table stores names in lowercase ("admin", "superadmin"), so every
 * comparison here normalises both sides before matching. That lets a nav entry
 * name its roles readably while still matching what the backend sends.
 */

/** Roles that carry unrestricted access to the whole application. */
const ADMIN_LEVEL_ROLES = ['admin', 'superadmin'];

/** Normalise one role name, so a label such as "Superadmin" matches "superadmin". */
export const normalizeRole = (role: string): string => role.trim().toLowerCase();

/** Whether the account holds an administrator role. */
export const isAdminLevel = (roles: string[] | undefined | null): boolean =>
    (roles ?? []).some((role) => ADMIN_LEVEL_ROLES.includes(normalizeRole(role)));

/**
 * Whether a nav entry is shown to an account holding `userRoles`.
 *
 * An entry that names no roles is shown to everyone; otherwise the account must
 * hold at least one of the named roles. The comparison is case-insensitive.
 */
export const canViewNavItem = (item: { roles?: string[] }, userRoles: string[] | undefined | null): boolean => {
    if (!item.roles?.length) {
        return true;
    }

    const owned = (userRoles ?? []).map(normalizeRole);

    return item.roles.some((role) => owned.includes(normalizeRole(role)));
};
