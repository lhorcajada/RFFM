import { useEffect, useState } from "react";
import { useUser } from "../../../../../shared/context/UserContext";
import { useRffmSeason } from "../../../../../shared/context/RffmSeasonContext";
import { getSettingsForUser } from "../../../services/federationApi";

export type PreferredTeamSummary = {
  teamName: string;
  competitionName?: string;
  groupName?: string;
  seasonLabel?: string;
};

export function usePreferredTeam() {
  const { user } = useUser();
  const { seasons, currentSeasonId } = useRffmSeason();
  const [preferredTeam, setPreferredTeam] =
    useState<PreferredTeamSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    function seasonLabelFor(seasonId?: number | null) {
      const effectiveSeasonId = seasonId ?? currentSeasonId;
      if (effectiveSeasonId == null) return undefined;
      return (
        seasons.find((s) => s.id === effectiveSeasonId)?.label ??
        String(effectiveSeasonId)
      );
    }

    async function load() {
      setLoading(true);
      try {
        const saved = await getSettingsForUser(user?.id);
        const combo = Array.isArray(saved)
          ? saved.find((c: any) => c.isPrimary) ?? saved[0]
          : undefined;
        if (!active) return;
        setPreferredTeam(
          combo?.teamName
            ? {
                teamName: combo.teamName,
                competitionName: combo.competitionName,
                groupName: combo.groupName,
                seasonLabel: seasonLabelFor(combo.seasonId),
              }
            : null,
        );
      } catch {
        if (active) setPreferredTeam(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    window.addEventListener("rffm.saved_combinations_changed", load);
    return () => {
      active = false;
      window.removeEventListener("rffm.saved_combinations_changed", load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, seasons, currentSeasonId]);

  return { preferredTeam, loading };
}
