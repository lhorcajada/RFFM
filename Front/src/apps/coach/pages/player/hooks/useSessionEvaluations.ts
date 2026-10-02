import { useCallback, useEffect, useState } from "react";
import { getSessionEvaluations, type PlayerSessionListItem } from "../../../services/playerTrackingService";

/** Sesiones de la temporada con la asistencia del jugador y el estado de su seguimiento. */
export function useSessionEvaluations(teamId: string | undefined, teamPlayerId: string | undefined) {
  const [items, setItems] = useState<PlayerSessionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!teamId || !teamPlayerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSessionEvaluations(teamId, teamPlayerId)
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar las sesiones");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, teamPlayerId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { items, loading, error, reload };
}
