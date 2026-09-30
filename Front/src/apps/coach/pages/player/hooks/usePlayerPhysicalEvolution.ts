import { useCallback, useEffect, useState } from "react";
import { getPlayerPhysicalEvolution } from "../../../services/teamPlayerStatisticsService";
import type {
  PhysicalEvolutionDays,
  PlayerPhysicalEvolution,
} from "../../../services/teamPlayerStatisticsService";

export function usePlayerPhysicalEvolution(teamId: string | undefined, teamPlayerId: string | undefined) {
  const [days, setDays] = useState<PhysicalEvolutionDays>(28);
  const [data, setData] = useState<PlayerPhysicalEvolution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!teamId || !teamPlayerId) return;

    // Ignora respuestas de un rango anterior si el usuario cambia de rango antes de que lleguen.
    let cancelled = false;
    setLoading(true);
    setError(false);
    getPlayerPhysicalEvolution(teamId, teamPlayerId, days)
      .then((evolution) => {
        if (!cancelled) setData(evolution);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId, teamPlayerId, days, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { data, loading, error, days, setDays, retry };
}
