import { useCallback, useState } from "react";
import { getPlayerConvocationSummary } from "../../../services/convocationService";
import type { PlayerConvocationSummary } from "../../../services/convocationService";

export function usePlayerConvocationSummary() {
  const [summary, setSummary] = useState<PlayerConvocationSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryLoaded, setSummaryLoaded] = useState(false);

  const loadSummary = useCallback((playerId: string | undefined) => {
    if (!playerId || summaryLoaded) return;

    setLoadingSummary(true);
    getPlayerConvocationSummary(playerId)
      .then((data) => {
        setSummary(data);
        setSummaryLoaded(true);
      })
      .catch(() => {
        // Keep tab usable on API errors.
      })
      .finally(() => setLoadingSummary(false));
  }, [summaryLoaded]);

  return {
    summary,
    loadingSummary,
    loadSummary,
  };
}
