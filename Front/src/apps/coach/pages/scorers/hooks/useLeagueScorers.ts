import { useCallback, useEffect, useState } from "react";
import { getLeagueScorers, type LeagueScorersResponse } from "../../../services/leagueScorersService";

export default function useLeagueScorers(teamId: string | undefined, round: number | undefined) {
  const [data, setData] = useState<LeagueScorersResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(teamId));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    getLeagueScorers(teamId, round)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId, round, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return { data, loading, error, reload };
}
