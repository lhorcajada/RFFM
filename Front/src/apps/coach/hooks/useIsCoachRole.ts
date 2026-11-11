import { useState } from "react";
import { coachAuthService } from "../services/authService";
import { computeIsCoachRole } from "./isPlayerRole";

/**
 * Returns whether the current user has the Coach role (Administrator alone is
 * not enough), with NO navigation side-effect. Read once on mount, like
 * `useIsPlayerRole`.
 */
export function useIsCoachRole(): boolean {
  const [isCoach] = useState(() => computeIsCoachRole(coachAuthService.getRoles()));
  return isCoach;
}

export default useIsCoachRole;
