import { useCallback, useEffect, useState } from "react";
import { getSquadHistory, type SquadHistoryReport } from "../../services/squadHistoryService";

const POLL_INTERVAL_MS = 15_000;

export function isSquadHistoryInProgress(report: SquadHistoryReport | null): boolean {
  return report?.status === "Pending" || report?.status === "Running";
}

export function useSquadHistory(teamCode: string, seasonId: number) {
  const [report, setReport] = useState<SquadHistoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await getSquadHistory(teamCode, seasonId);
      setReport(data);
      setNotFound(data === null);
      setError(null);
    } catch {
      setError("No se pudo cargar el historial de la plantilla.");
    } finally {
      setLoading(false);
    }
  }, [teamCode, seasonId]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const inProgress = isSquadHistoryInProgress(report);
  useEffect(() => {
    if (!inProgress) return undefined;
    const interval = window.setInterval(reload, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [inProgress, reload]);

  return { report, loading, notFound, error, inProgress, reload };
}
