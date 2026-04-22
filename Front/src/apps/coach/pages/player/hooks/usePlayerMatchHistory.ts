import { useCallback, useState } from "react";
import { getPlayerMatchHistory } from "../../../services/liveMatchService";
import type { PlayerMatchRecord } from "../../convocations/components/simulation/liveMatch.types";

export function usePlayerMatchHistory() {
  const [matchHistory, setMatchHistory] = useState<PlayerMatchRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const loadHistory = useCallback((playerId: string | undefined) => {
    if (!playerId || historyLoaded) return;

    setLoadingHistory(true);
    getPlayerMatchHistory(playerId)
      .then((data) => {
        setMatchHistory(data);
        setHistoryLoaded(true);
      })
      .catch(() => {
        // Keep tab usable on API errors.
      })
      .finally(() => setLoadingHistory(false));
  }, [historyLoaded]);

  return {
    matchHistory,
    loadingHistory,
    loadHistory,
  };
}
