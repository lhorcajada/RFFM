import { useEffect, useState } from "react";
import { getMyProfile } from "../../apps/coach/services/coachApi";
import configurationCoachService from "../../apps/coach/services/configurationCoachService";
import { getTeamFund } from "../../apps/coach/services/teamFundService";

export interface TeamFundBalanceInfo {
  /** True once a numeric balance has been loaded for a resolved team. Not gated by role. */
  visible: boolean;
  balance: number | null;
  teamId: string | null;
}

async function resolveTeamId(): Promise<string | null> {
  try {
    const profile = await getMyProfile();
    if (profile?.teamId) return profile.teamId;
  } catch {
    // fall through to the coach configuration fallback
  }

  try {
    const config = await configurationCoachService.getCurrent();
    return config?.preferredTeamId ?? null;
  } catch {
    return null;
  }
}

/** Team fund balance for the current user's team, resolved via profile teamId
 * (Player/FamilyMember) or coach preferred team (Coach) — visible for any
 * authenticated user whose account resolves to a team, regardless of role. */
export default function useTeamFundBalance(): TeamFundBalanceInfo {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    resolveTeamId()
      .then((resolvedTeamId) => {
        if (!mounted) return null;
        setTeamId(resolvedTeamId);
        if (!resolvedTeamId) return null;
        return getTeamFund(resolvedTeamId);
      })
      .then((fund) => {
        if (!mounted || !fund) return;
        setBalance(fund.balance);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  return { visible: balance !== null, balance, teamId };
}
