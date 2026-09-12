import { useEffect, useState } from "react";
import { coachAuthService } from "../../apps/coach/services/authService";
import { computeIsPlayerRole } from "../../apps/coach/hooks/isPlayerRole";
import { getMyProfile } from "../../apps/coach/services/coachApi";
import {
  getPlayerSanctions,
  getPendingSanctionsCount,
} from "../../apps/coach/services/teamplayerSanctionService";

export interface MyPendingSanctionsInfo {
  /** True only for Player/FamilyMember roles (not Coach/Administrator) — the audience of this badge. */
  visible: boolean;
  count: number;
  teamId: string | null;
}

/** Many existing tests mock coachAuthService with only the methods their page
 * needs (no getRoles) — this hook must stay silent rather than crash pages
 * that render AppHeader incidentally. */
function safeGetRoles(): string[] {
  try {
    return coachAuthService.getRoles?.() ?? [];
  } catch {
    return [];
  }
}

/** Pending sanctions info for the current user's own linked player, only
 * fetched for Player/FamilyMember roles (Coach/Administrator/others never see this). */
export default function useMyPendingSanctionsCount(): MyPendingSanctionsInfo {
  const visible = computeIsPlayerRole(safeGetRoles());
  const [count, setCount] = useState(0);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;

    Promise.resolve()
      .then(() => getMyProfile())
      .then((profile) => {
        if (!mounted) return null;
        setTeamId(profile?.teamId ?? null);
        if (!profile?.playerId) return null;
        return getPlayerSanctions(profile.playerId);
      })
      .then((sanctions) => {
        if (!mounted || !sanctions) return;
        setCount(getPendingSanctionsCount(sanctions));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return { visible, count, teamId };
}
