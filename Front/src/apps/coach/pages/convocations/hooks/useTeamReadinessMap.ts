import { useEffect, useState } from "react";
import { getTeamPlayerStatistics, type PlayerStatistics } from "../../../services/teamPlayerStatisticsService";

/** Rodaje por jugador (best-effort, no bloqueante): vacío mientras carga o si falla. */
export function useTeamReadinessMap(teamId: string): Record<string, PlayerStatistics> {
  const [readinessMap, setReadinessMap] = useState<Record<string, PlayerStatistics>>({});

  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    getTeamPlayerStatistics(teamId)
      .then((stats) => {
        if (!mounted) return;
        const map: Record<string, PlayerStatistics> = {};
        stats.forEach((s) => { map[s.teamPlayerId] = s; });
        setReadinessMap(map);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [teamId]);

  return readinessMap;
}
