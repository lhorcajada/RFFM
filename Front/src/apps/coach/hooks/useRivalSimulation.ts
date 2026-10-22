import { useEffect, useState } from "react";
import {
  getRivalSimulation,
  getRivalSimulationHistory,
  syncRivalSimulationRounds,
  type RivalSimulation,
  type RivalSimulationHistory,
} from "../services/rivalStatsService";

type UseRivalSimulation = {
  simulation: RivalSimulation | null;
  /** null si no se ha podido cargar: la página sigue mostrando la simulación actual. */
  history: RivalSimulationHistory | null;
  loading: boolean;
  error: boolean;
};

async function loadHistory(teamId: string): Promise<RivalSimulationHistory | null> {
  try {
    await syncRivalSimulationRounds(teamId);
  } catch {
    // sin sincronizar todavía se puede mostrar lo ya guardado
  }
  try {
    return await getRivalSimulationHistory(teamId);
  } catch {
    return null;
  }
}

/** Simulación de la liga del equipo y sus simulaciones guardadas por jornada. */
export default function useRivalSimulation(teamId: string | undefined): UseRivalSimulation {
  const [simulation, setSimulation] = useState<RivalSimulation | null>(null);
  const [history, setHistory] = useState<RivalSimulationHistory | null>(null);
  const [loading, setLoading] = useState(Boolean(teamId));
  const [error, setError] = useState(false);

  useEffect(() => {
    setSimulation(null);
    setHistory(null);
    setError(false);
    if (!teamId) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    Promise.all([getRivalSimulation(teamId).catch(() => null), loadHistory(teamId)])
      .then(([current, saved]) => {
        if (!mounted) return;
        setSimulation(current);
        setHistory(saved);
        setError(current === null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [teamId]);

  return { simulation, history, loading, error };
}
