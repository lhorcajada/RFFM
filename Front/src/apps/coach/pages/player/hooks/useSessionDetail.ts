import { useEffect, useState } from "react";
import trainingService from "../../../services/trainingService";
import type { TrainingSessionDetail } from "../../../types/training";

export function useSessionDetail(sessionId: string | null) {
  const [detail, setDetail] = useState<TrainingSessionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDetail(null);
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    trainingService
      .getSessionById(sessionId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { detail, loading };
}
