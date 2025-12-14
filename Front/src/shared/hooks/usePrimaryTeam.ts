import { useCallback, useEffect, useState } from "react";
import { getSettingsForUser } from "../../apps/federation/services/federationApi";

export default function usePrimaryTeam(userId?: string | null) {
  const [primaryTeamId, setPrimaryTeamId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        if (userId) {
          const settings = await getSettingsForUser(userId);
          const primary =
            (settings || []).find((s: any) => s.isPrimary) || settings[0];
          if (mounted)
            setPrimaryTeamId(
              primary?.teamId
                ? String(primary.teamId)
                : primary?.teamId ?? primary?.team?.id
                ? String(primary.team?.id)
                : null
            );
          return;
        }

        // Fallback to localStorage for backward compatibility
        const STORAGE_PRIMARY = "rffm.primary_combination_id";
        const STORAGE_KEY = "rffm.saved_combinations_v1";
        const stored = localStorage.getItem(STORAGE_KEY);
        const combos = stored ? JSON.parse(stored || "[]") : [];
        const primaryId = localStorage.getItem(STORAGE_PRIMARY);
        let primary: any = null;
        if (primaryId && combos && combos.length > 0) {
          primary = (combos || []).find(
            (c: any) => String(c.id) === String(primaryId)
          );
        }
        if (!primary && combos && combos.length > 0) {
          primary = (combos || []).find((c: any) => c.isPrimary) || combos[0];
        }
        if (mounted)
          setPrimaryTeamId(primary?.team?.id ? String(primary.team.id) : null);
      } catch (e) {
        if (mounted) setPrimaryTeamId(null);
      }
    }
    load();
    return () => {
      mounted = false;
    };
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
