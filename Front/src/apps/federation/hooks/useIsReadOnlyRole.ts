import { useState } from "react";
import { coachAuthService } from "../../coach/services/authService";

function computeIsReadOnlyRole(roles: string[]): boolean {
  return (
    (roles.includes("Player") || roles.includes("FamilyMember")) &&
    !roles.includes("Administrator") &&
    !roles.includes("Federation") &&
    !roles.includes("Coach")
  );
}

/**
 * Returns whether the current user only has Player/FamilyMember access to
 * Federation (no Federation/Administrator/Coach role), meaning the UI must
 * hide or disable write actions and show read-only views instead.
 */
export function useIsReadOnlyRole(): boolean {
  const [isReadOnly] = useState(() =>
    computeIsReadOnlyRole(coachAuthService.getRoles())
  );
  return isReadOnly;
}

export default useIsReadOnlyRole;
