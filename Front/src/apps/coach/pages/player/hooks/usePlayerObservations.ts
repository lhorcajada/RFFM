import { useCallback, useEffect, useState } from "react";
import {
  createPlayerObservation,
  deletePlayerObservation,
  getPlayerObservations,
  updatePlayerObservation,
  type CreatePlayerObservationRequest,
  type PlayerObservation,
  type UpdatePlayerObservationRequest,
} from "../../../services/playerTrackingService";

function mostRecentFirst(a: PlayerObservation, b: PlayerObservation): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

export function usePlayerObservations(teamId: string | undefined, teamPlayerId: string | undefined, from?: string) {
  const [observations, setObservations] = useState<PlayerObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!teamId || !teamPlayerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPlayerObservations(teamId, teamPlayerId, from)
      .then((result) => {
        if (!cancelled) setObservations(result);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar las observaciones");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, teamPlayerId, from, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const create = useCallback(
    /** Crea la observación; devuelve `false` si queda fuera del periodo y por eso no se añade a la lista. */
    async (request: CreatePlayerObservationRequest): Promise<boolean> => {
      if (!teamId || !teamPlayerId) return false;
      const created = await createPlayerObservation(teamId, teamPlayerId, request);
      const inPeriod = !from || created.date >= from;
      if (inPeriod) setObservations((current) => [...current, created].sort(mostRecentFirst));
      return inPeriod;
    },
    [teamId, teamPlayerId, from],
  );

  const update = useCallback(
    async (observationId: string, request: UpdatePlayerObservationRequest) => {
      if (!teamId || !teamPlayerId) return;
      const updated = await updatePlayerObservation(teamId, teamPlayerId, observationId, request);
      setObservations((current) => current.map((o) => (o.id === observationId ? updated : o)));
    },
    [teamId, teamPlayerId],
  );

  const remove = useCallback(
    async (observationId: string) => {
      if (!teamId || !teamPlayerId) return;
      await deletePlayerObservation(teamId, teamPlayerId, observationId);
      setObservations((current) => current.filter((o) => o.id !== observationId));
    },
    [teamId, teamPlayerId],
  );

  return { observations, loading, error, reload, create, update, remove };
}
