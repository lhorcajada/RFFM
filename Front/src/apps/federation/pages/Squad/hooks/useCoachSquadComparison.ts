import { useEffect, useState } from "react";
import {
  getCoachSquadComparison,
  type CoachSquadComparison,
} from "../../../services/squadComparisonService";

export function useCoachSquadComparison(
  teamCode?: string,
  season?: string,
  competition?: string,
  group?: string,
) {
  const [comparison, setComparison] = useState<CoachSquadComparison | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setComparison(null);
    if (!teamCode || !season || !competition || !group) return;

    let mounted = true;
    setLoading(true);
    getCoachSquadComparison(teamCode, season, competition, group)
      .then((data) => {
        if (mounted) setComparison(data);
      })
      .catch(() => {
        if (mounted) setComparison(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [teamCode, season, competition, group]);

  return { comparison, loading };
}
