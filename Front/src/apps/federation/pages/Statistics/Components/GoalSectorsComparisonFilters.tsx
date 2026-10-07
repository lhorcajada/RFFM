import React from "react";
import { Box, Grid } from "@mui/material";
import styles from "./GoalSectorsComparisonFilters.module.css";
import RffmSeasonSelector from "../../../../../shared/components/ui/RffmSeasonSelector/RffmSeasonSelector";
import { useUser } from "../../../../../shared/context/UserContext";
import { useRffmSeason } from "../../../../../shared/context/RffmSeasonContext";
import useClearOnSeasonChange from "../../../../../shared/hooks/useClearOnSeasonChange";
import { getSettingsForUser } from "../../../services/api";
import TeamSidePanel from "./TeamSidePanel";

export type TeamSide = { competitionId: string; groupId: string; teamCode: string };

export type ComparisonSelection = { team1: TeamSide; team2: TeamSide };

export const EMPTY_COMPARISON_SELECTION: ComparisonSelection = {
  team1: { competitionId: "", groupId: "", teamCode: "" },
  team2: { competitionId: "", groupId: "", teamCode: "" },
};

type FederationSetting = {
  isPrimary?: boolean;
  seasonId?: number | string;
  competitionId?: string | number;
  groupId?: string | number;
  competition?: { id?: string | number };
  group?: { id?: string | number };
};

export function isSelectionComplete(selection: ComparisonSelection): boolean {
  return [selection.team1, selection.team2].every(
    (side) => side.competitionId && side.groupId && side.teamCode,
  );
}

export default function GoalSectorsComparisonFilters({
  value,
  onChange,
}: {
  value: ComparisonSelection;
  onChange: (value: ComparisonSelection) => void;
}): JSX.Element {
  const { user } = useUser();
  const { applySeasonId } = useRffmSeason();
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  useClearOnSeasonChange(() => onChangeRef.current(EMPTY_COMPARISON_SELECTION));

  React.useEffect(() => {
    async function loadPrimaryCombination() {
      if (!user?.id) return;
      try {
        const settings = (await getSettingsForUser(user.id)) as FederationSetting[] | undefined;
        if (!Array.isArray(settings) || settings.length === 0) return;
        const primary = settings.find((s) => s.isPrimary) ?? settings[0];
        if (primary.seasonId != null) applySeasonId(Number(primary.seasonId));
        const side: TeamSide = {
          competitionId: String(primary.competitionId ?? primary.competition?.id ?? ""),
          groupId: String(primary.groupId ?? primary.group?.id ?? ""),
          teamCode: "",
        };
        onChangeRef.current({ team1: side, team2: { ...side } });
      } catch {
        // sin combinación principal el usuario elige manualmente
      }
    }

    loadPrimaryCombination();
    window.addEventListener("rffm.saved_combinations_changed", loadPrimaryCombination);
    return () =>
      window.removeEventListener("rffm.saved_combinations_changed", loadPrimaryCombination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <Box className={styles.root}>
      <Box className={styles.season}>
        <RffmSeasonSelector />
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TeamSidePanel
            title="Equipo 1"
            idPrefix="team1"
            value={value.team1}
            onChange={(team1) => onChange({ ...value, team1 })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TeamSidePanel
            title="Equipo 2"
            idPrefix="team2"
            value={value.team2}
            onChange={(team2) => onChange({ ...value, team2 })}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
