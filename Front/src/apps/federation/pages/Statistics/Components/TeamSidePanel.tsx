import React from "react";
import {
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@mui/material";
import styles from "./TeamSidePanel.module.css";
import CompetitionSelector from "../../../../../shared/components/ui/CompetitionSelector/CompetitionSelector";
import GroupSelector from "../../../../../shared/components/ui/GroupSelector/GroupSelector";
import { useRffmSeason } from "../../../../../shared/context/RffmSeasonContext";
import { getTeamsForClassification } from "../../../services/api";
import type { TeamSide } from "./GoalSectorsComparisonFilters";

type TeamOption = { id: string; name: string };

type ClassificationTeam = { teamId?: string | number; teamName?: string; nombre?: string };

export default function TeamSidePanel({
  title,
  idPrefix,
  value,
  onChange,
}: {
  title: string;
  idPrefix: string;
  value: TeamSide;
  onChange: (value: TeamSide) => void;
}): JSX.Element {
  const { seasonId } = useRffmSeason();
  const [teams, setTeams] = React.useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = React.useState(false);
  const { competitionId, groupId, teamCode } = value;
  const teamLabelId = `${idPrefix}-team-select-label`;

  React.useEffect(() => {
    if (!competitionId || !groupId) {
      setTeams([]);
      return;
    }
    let mounted = true;
    setLoadingTeams(true);
    getTeamsForClassification({
      season: String(seasonId ?? ""),
      competition: competitionId,
      group: groupId,
    })
      .then((res: ClassificationTeam[] | undefined) => {
        if (!mounted) return;
        setTeams(
          (res ?? []).map((t) => ({
            id: String(t.teamId ?? ""),
            name: t.teamName ?? t.nombre ?? String(t.teamId ?? ""),
          })),
        );
      })
      .catch(() => {
        if (mounted) setTeams([]);
      })
      .finally(() => {
        if (mounted) setLoadingTeams(false);
      });
    return () => {
      mounted = false;
    };
  }, [seasonId, competitionId, groupId]);

  function handleCompetitionChange(id: string) {
    if (id === competitionId) return;
    onChange({ competitionId: id, groupId: "", teamCode: "" });
  }

  function handleGroupChange(id: string) {
    if (id === groupId) return;
    onChange({ competitionId, groupId: id, teamCode: "" });
  }

  return (
    <Paper
      variant="outlined"
      role="group"
      aria-label={title}
      className={styles.panel}
    >
      <Typography component="h2" className={styles.title}>
        {title}
      </Typography>
      <CompetitionSelector
        idPrefix={idPrefix}
        value={competitionId}
        onChange={(c) => handleCompetitionChange(c?.id ?? "")}
      />
      <GroupSelector
        idPrefix={idPrefix}
        competitionId={competitionId}
        value={groupId}
        onChange={(g) => handleGroupChange(g?.id ?? "")}
      />
      {loadingTeams ? (
        <CircularProgress size={20} />
      ) : (
        <FormControl fullWidth size="small">
          <InputLabel id={teamLabelId}>Equipo</InputLabel>
          <Select
            labelId={teamLabelId}
            value={teams.some((t) => t.id === teamCode) ? teamCode : ""}
            label="Equipo"
            disabled={!groupId}
            onChange={(e) => onChange({ ...value, teamCode: String(e.target.value) })}
          >
            <MenuItem value="">-- Seleccionar equipo --</MenuItem>
            {teams.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Paper>
  );
}
