import { useCallback, useEffect, useState } from "react";

export default function usePrimaryTeam() {
  const [primaryTeamId, setPrimaryTeamId] = useState<string | null>(null);

  useEffect(() => {
    const STORAGE_PRIMARY = "rffm.primary_combination_id";
    const STORAGE_KEY = "rffm.saved_combinations_v1";
    try {
      const primaryId = localStorage.getItem(STORAGE_PRIMARY);
      if (!primaryId) {
        setPrimaryTeamId(null);
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setPrimaryTeamId(null);
        return;
      }
      const combos = JSON.parse(stored || "[]");
      const primary = (combos || []).find(
        (c: any) => String(c.id) === String(primaryId)
      );
      setPrimaryTeamId(primary?.team?.id ? String(primary.team.id) : null);
    } catch (e) {
      setPrimaryTeamId(null);
    }
  }, []);

  const isPrimary = useCallback(
    (teamId?: string | number | null) => {
      if (!primaryTeamId || teamId == null) return false;
      return String(primaryTeamId) === String(teamId);
    },
    [primaryTeamId]
  );

  return { primaryTeamId, isPrimary };
}
