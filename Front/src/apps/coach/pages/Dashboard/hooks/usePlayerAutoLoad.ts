import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { coachAuthService } from "../../../services/authService";
import { getMyProfile } from "../../../services/coachApi";

/**
 * Detects if the current user has exclusively the "Player" role (not Coach/Admin)
 * and auto-loads their associated team from the user profile.
 */
export function usePlayerAutoLoad() {
  const [isPlayer, setIsPlayer] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const roles = coachAuthService.getRoles();
    const isPlayerRole =
      roles.includes("Player") &&
      !roles.includes("Administrator") &&
      !roles.includes("Coach");

    setIsPlayer(isPlayerRole);

    if (!isPlayerRole) return;

    // If teamId is already in the URL, no need to fetch
    const params = new URLSearchParams(location.search);
    if (params.get("teamId")) return;

    // Check localStorage first (set during identity verification)
    try {
      const cached = localStorage.getItem("coach_player_teamId");
      if (cached) {
        navigate(`/coach/dashboard?teamId=${cached}`, { replace: true });
        return;
      }
    } catch {}

    // Fallback: load from the saved user profile
    getMyProfile().then((profile) => {
      if (profile?.teamId) {
        try { localStorage.setItem("coach_player_teamId", profile.teamId); } catch {}
        navigate(`/coach/dashboard?teamId=${profile.teamId}`, { replace: true });
      } else {
        // No team linked — send back to AppSelector to re-link
        navigate("/", { replace: true, state: { needsTeamRelink: true } });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isPlayer };
}
