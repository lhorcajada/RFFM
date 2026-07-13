import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import configurationCoachService from "../services/configurationCoachService";

/**
 * Resolves the path that the "Volver" button on a team-scoped page should
 * navigate to: the dashboard of the concrete team the user is working with,
 * never the coach's general dashboard.
 *
 * Resolution order:
 * 1. `teamId` query param on the current URL (the page the user came from).
 * 2. The coach's preferred team (configuration fallback), mirroring the same
 *    fallback used by `useTeamAndClub` to resolve the "current" team.
 * 3. The general coach dashboard, only when no team can be determined.
 */
export async function resolveTeamDashboardPath(search: string): Promise<string> {
  const params = new URLSearchParams(search);
  const teamId = params.get("teamId");
  if (teamId) return `/coach/team-dashboard?teamId=${teamId}`;

  try {
    const current = await configurationCoachService.getCurrent();
    const preferredTeamId = current?.preferredTeamId ?? null;
    if (preferredTeamId) return `/coach/team-dashboard?teamId=${preferredTeamId}`;
  } catch {
    // Ignore configuration lookup failures and fall back to the general dashboard.
  }

  return "/coach/dashboard";
}

/**
 * Returns a callback that navigates "back" from a team-scoped page to the
 * dashboard of the concrete team currently in context, instead of the
 * coach's general dashboard.
 */
export default function useTeamDashboardBack() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    void resolveTeamDashboardPath(location.search).then((path) => navigate(path));
  }, [navigate, location.search]);
}
