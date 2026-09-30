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

export function usePlayerObservations(teamId: string | undefined, teamPlayerId: string | undefined) {
  const [observations, setObservations] = useState<PlayerObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!teamId || !teamPlayerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPlayerObservations(teamId, teamPlayerId)
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
  }, [teamId, teamPlayerId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const create = useCallback(
    async (request: CreatePlayerObservationRequest) => {
      if (!teamId || !teamPlayerId) return;
      const created = await createPlayerObservation(teamId, teamPlayerId, request);
      setObservations((current) => [...current, created].sort(mostRecentFirst));
    },
    [teamId, teamPlayerId],
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
