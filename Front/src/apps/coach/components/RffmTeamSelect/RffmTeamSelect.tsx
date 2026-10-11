import { useEffect, useState } from "react";
import { Box, CircularProgress, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import rffmCompetitionService, { type RffmGroupTeam } from "../../services/rffmCompetitionService";
import styles from "./RffmTeamSelect.module.css";

type Props = {
  competitionId: number | null;
  groupId: number | null;
  teamCode: string | null;
  onChange?: (teamCode: string | null) => void;
};

// Which team of the RFFM group this coach team is: lets rival pages tell "your team" from the rest.
export default function RffmTeamSelect({ competitionId, groupId, teamCode, onChange }: Props) {
  const [teams, setTeams] = useState<RffmGroupTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const hasGroup = competitionId !== null && groupId !== null;

  useEffect(() => {
    if (competitionId === null || groupId === null) {
      setTeams([]);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(false);
    rffmCompetitionService
      .getGroupTeams(competitionId, groupId)
      .then((items) => {
        if (mounted) setTeams(items);
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [competitionId, groupId]);

  const isKnownTeam = teams.some((team) => team.teamCode === teamCode);

  return (
    <Box className={styles.wrapper}>
      <FormControl fullWidth variant="outlined" size="small" disabled={!hasGroup}>
        <InputLabel id="rffm-team-select-label">Equipo RFFM</InputLabel>
        {loading ? (
          <CircularProgress size={20} />
        ) : (
          <Select
            labelId="rffm-team-select-label"
            label="Equipo RFFM"
            value={isKnownTeam ? teamCode ?? "" : ""}
            onChange={(e) => onChange?.(e.target.value === "" ? null : String(e.target.value))}
          >
            <MenuItem value="">-- Sin equipo --</MenuItem>
            {teams.map((team) => (
              <MenuItem key={team.teamCode} value={team.teamCode}>
                {team.teamName}
              </MenuItem>
            ))}
          </Select>
        )}
      </FormControl>
      {error && (
        <Typography color="error" variant="caption">
          No se han podido cargar los equipos del grupo.
        </Typography>
      )}
    </Box>
  );
}
