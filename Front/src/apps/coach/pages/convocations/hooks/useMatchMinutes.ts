import { useEffect, useState } from "react";
import { getMatchMinutes, type MatchMinutesRow } from "../../../services/liveMatchService";

/** Minutes played per match of the team; empty while loading or when the read fails. */
export function useMatchMinutes(teamId: string, enabled = true): MatchMinutesRow[] {
  const [rows, setRows] = useState<MatchMinutesRow[]>([]);

  useEffect(() => {
    if (!teamId || !enabled) return;
    let cancelled = false;
    getMatchMinutes(teamId).then((data) => {
      if (!cancelled) setRows(data);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId, enabled]);

  return rows;
}
