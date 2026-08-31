import { useState } from "react";
import { coachAuthService } from "../services/authService";
import { computeIsPlayerRole } from "./isPlayerRole";

/**
 * Returns whether the current user has a Player/FamilyPlayer/FamilyMember
 * role (and not Coach/Administrator), with NO navigation side-effect.
 *
 * Use this on any page that just needs to branch UI on "is this a player"
 * (e.g. `Attendance.tsx`, `Convocations.tsx` picking which attendance badge
 * view to render). Do NOT use `usePlayerAutoLoad` for that — it also
 * redirects any player-role user away from whatever page it's mounted on to
 * `/coach/team-dashboard`, which is only correct on Dashboard/AppSelector-
 * style entry points, not on a page the player is meant to actually view.
 */
export function useIsPlayerRole(): boolean {
  const [isPlayer] = useState(() => computeIsPlayerRole(coachAuthService.getRoles()));
  return isPlayer;
}

export default useIsPlayerRole;
