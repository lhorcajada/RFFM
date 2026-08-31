/**
 * Pure role check shared by `usePlayerAutoLoad` (Dashboard/AppSelector-style
 * entry points, which also auto-redirect) and `useIsPlayerRole` (pages that
 * only need the boolean, with no navigation side-effect).
 */
export function computeIsPlayerRole(roles: string[]): boolean {
  return (
    (roles.includes("Player") || roles.includes("FamilyPlayer") || roles.includes("FamilyMember")) &&
    !roles.includes("Administrator") &&
    !roles.includes("Coach")
  );
}
