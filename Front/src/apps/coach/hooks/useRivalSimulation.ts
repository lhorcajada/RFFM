import { useEffect, useState } from "react";
import { getRivalSimulation, type RivalSimulation } from "../services/rivalStatsService";

type UseRivalSimulation = {
  simulation: RivalSimulation | null;
  loading: boolean;
  error: boolean;
};

/** Simulación de los partidos pendientes y de la clasificación final de la liga del equipo. */
export default function useRivalSimulation(teamId: string | undefined): UseRivalSimulation {
  const [simulation, setSimulation] = useState<RivalSimulation | null>(null);
  const [loading, setLoading] = useState(Boolean(teamId));
  const [error, setError] = useState(false);

  useEffect(() => {
    setSimulation(null);
    setError(false);
    if (!teamId) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    getRivalSimulation(teamId)
      .then((data) => {
        if (mounted) setSimulation(data);
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [teamId]);

  return { simulation, loading, error };
}
