import { useCallback, useState } from "react";
import { getTeamPlayerStatistics } from "../../../services/teamPlayerStatisticsService";
import type { PlayerStatistics } from "../../../services/teamPlayerStatisticsService";

/**
 * Loads the current player's own row from the team-wide statistics endpoint, so the
 * "Estadísticas" tab can show their Forma/Rodaje/Cansancio bars without needing a
 * player-scoped endpoint of its own.
 */
export function usePlayerFormStats() {
  const [stats, setStats] = useState<PlayerStatistics | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const loadStats = useCallback(
    (teamId: string | undefined, teamPlayerId: string | undefined) => {
      if (!teamId || !teamPlayerId) return;

      setLoadingStats(true);
      getTeamPlayerStatistics(teamId)
        .then((players) => {
          const found = players.find((p) => p.teamPlayerId === teamPlayerId) ?? null;
          setStats(found);
        })
        .catch(() => {
          // Keep tab usable on API errors.
        })
        .finally(() => setLoadingStats(false));
    },
    []
  );

  return {
    stats,
    loadingStats,
    loadStats,
  };
}
