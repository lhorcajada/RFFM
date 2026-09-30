import { useEffect, useState } from "react";
import trainingService from "../../../services/trainingService";
import type { TrainingSession } from "../../../types/training";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Sesiones del equipo con fecha en los últimos `days` días (hasta hoy), la más reciente primero. */
export function useRecentSessions(teamId: string | undefined, days = 30) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    const now = new Date();
    const today = isoDay(now);
    const from = isoDay(new Date(now.getTime() - days * DAY_MS));

    setLoading(true);
    trainingService
      .getSessions(teamId)
      .then((all) => {
        if (cancelled) return;
        const recent = all
          .filter((s): s is TrainingSession & { date: string } => !!s.date)
          .filter((s) => {
            const day = s.date.slice(0, 10);
            return day >= from && day <= today;
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        setSessions(recent);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, days]);

  return { sessions, loading };
}
