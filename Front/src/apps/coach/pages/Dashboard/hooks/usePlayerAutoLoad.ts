import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { coachAuthService } from "../../../services/authService";
import { getMyProfile } from "../../../services/coachApi";
import { computeIsPlayerRole } from "../../../hooks/isPlayerRole";

/**
 * Detects if the current user is a player or family member without coach/admin access
 * and auto-loads their associated team dashboard from cached/profile data.
 */
export function usePlayerAutoLoad() {
  const [isPlayer, setIsPlayer] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const roles = coachAuthService.getRoles();
    const isPlayerRole = computeIsPlayerRole(roles);

    setIsPlayer(isPlayerRole);

    if (!isPlayerRole) return;

    const params = new URLSearchParams(location.search);
    const teamIdInUrl = params.get("teamId");
    if (location.pathname === "/coach/team-dashboard") return;
    if (location.pathname === "/coach/dashboard" && teamIdInUrl) {
      navigate(`/coach/team-dashboard?${params.toString()}`, { replace: true });
      return;
    }

    // Check localStorage first (set during identity verification)
    try {
      const cached = localStorage.getItem("coach_player_teamId");
      if (cached) {
        navigate(`/coach/team-dashboard?teamId=${cached}`, { replace: true });
        return;
      }
    } catch {}

    // Fallback: load from the saved user profile
    getMyProfile().then((profile) => {
      if (profile?.teamId) {
        try { localStorage.setItem("coach_player_teamId", profile.teamId); } catch {}
        navigate(`/coach/team-dashboard?teamId=${profile.teamId}`, { replace: true });
      } else {
        // No team linked — send back to AppSelector to re-link
        navigate("/appSelector", { replace: true, state: { needsTeamRelink: true } });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isPlayer };
}
