import { useCallback, useEffect, useState } from "react";
import { getRivalStats, requestRivalStats, type RivalStats } from "../services/rivalStatsService";

const DEFAULT_POLL_MS = 5000;

type UseRivalStats = {
  /** null: todavía no se han generado. */
  stats: RivalStats | null;
  loading: boolean;
  error: boolean;
  requesting: boolean;
  generate: () => Promise<void>;
  refresh: () => Promise<void>;
};

function isInProgress(stats: RivalStats | null): boolean {
  return stats?.status === "Pending" || stats?.status === "Running";
}

/** Estadísticas de la liga del equipo; mientras se generan vuelve a consultarlas periódicamente. */
export default function useRivalStats(teamId: string | undefined, pollMs: number = DEFAULT_POLL_MS): UseRivalStats {
  const [stats, setStats] = useState<RivalStats | null>(null);
  const [loading, setLoading] = useState(Boolean(teamId));
  const [error, setError] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setStats(null);
    setError(false);
    if (!teamId) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    getRivalStats(teamId)
      .then((data) => {
        if (mounted) setStats(data);
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

  useEffect(() => {
    if (!teamId || !isInProgress(stats)) return;
    let mounted = true;
    const timer = setTimeout(() => {
      getRivalStats(teamId)
        .then((data) => {
          if (mounted && data) setStats(data);
        })
        .catch(() => {
          // un sondeo fallido se reintenta en el siguiente ciclo
          if (mounted) setStats((current) => (current ? { ...current } : current));
        });
    }, pollMs);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [teamId, stats, pollMs]);

  const request = useCallback(
    async (refresh: boolean) => {
      if (!teamId) return;
      setRequesting(true);
      try {
        await requestRivalStats(teamId, refresh);
        setStats(await getRivalStats(teamId));
        setError(false);
      } finally {
        setRequesting(false);
      }
    },
    [teamId],
  );

  const generate = useCallback(() => request(false), [request]);
  const refresh = useCallback(() => request(true), [request]);

  return { stats, loading, error, requesting, generate, refresh };
}
