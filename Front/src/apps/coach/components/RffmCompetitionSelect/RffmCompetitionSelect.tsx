import React, { useEffect, useState } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
  Box,
} from "@mui/material";
import rffmCompetitionService, {
  RffmCompetition,
  RffmGroup,
} from "../../services/rffmCompetitionService";
import styles from "./RffmCompetitionSelect.module.css";

export type RffmCompetitionSelectValue = {
  competitionId: number | null;
  groupId: number | null;
};

// Selector for the REAL RFFM competitions/groups catalog (GetCompetitions/GetGroups),
// distinct from the local Liga/Grupo catalog used by LeagueSelect.
export default function RffmCompetitionSelect({
  competitionId,
  groupId,
  onChange,
}: {
  competitionId: number | null;
  groupId: number | null;
  onChange?: (value: RffmCompetitionSelectValue) => void;
}) {
  const [competitions, setCompetitions] = useState<RffmCompetition[]>([]);
  const [groups, setGroups] = useState<RffmGroup[]>([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingCompetitions(true);
      setError(null);
      try {
        const items = await rffmCompetitionService.getCompetitions();
        if (mounted) setCompetitions(items);
      } catch (err: unknown) {
        if (mounted) setError(String((err as Error).message || err));
      } finally {
        if (mounted) setLoadingCompetitions(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (competitionId === null || competitionId === undefined) {
        setGroups([]);
        return;
      }
      setLoadingGroups(true);
      setError(null);
      try {
        const items = await rffmCompetitionService.getGroups(competitionId);
        if (mounted) setGroups(items);
      } catch (err: unknown) {
        if (mounted) setError(String((err as Error).message || err));
      } finally {
        if (mounted) setLoadingGroups(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [competitionId]);

  const handleCompetitionChange = (value: string) => {
    const nextId = value === "" ? null : Number(value);
    onChange?.({ competitionId: nextId, groupId: null });
  };

  const handleGroupChange = (value: string) => {
    const nextId = value === "" ? null : Number(value);
    onChange?.({ competitionId: competitionId ?? null, groupId: nextId });
  };

  return (
    <Box className={styles.wrapper}>
      <Box className={styles.row}>
        <FormControl className={styles.field} fullWidth variant="outlined" size="small">
          <InputLabel id="rffm-competition-select-label">Competición RFFM</InputLabel>
          {loadingCompetitions ? (
            <CircularProgress size={20} />
          ) : (
            <Select
              labelId="rffm-competition-select-label"
              label="Competición RFFM"
              value={competitionId ?? ""}
              onChange={(e) => handleCompetitionChange(e.target.value as string)}
            >
              <MenuItem value="">-- Sin competición RFFM --</MenuItem>
              {competitions.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>

        <FormControl
          className={styles.field}
          fullWidth
          variant="outlined"
          size="small"
          disabled={competitionId === null || competitionId === undefined}
        >
          <InputLabel id="rffm-group-select-label">Grupo RFFM</InputLabel>
          {loadingGroups ? (
            <CircularProgress size={20} />
          ) : (
            <Select
              labelId="rffm-group-select-label"
              label="Grupo RFFM"
              value={groupId ?? ""}
              onChange={(e) => handleGroupChange(e.target.value as string)}
            >
              <MenuItem value="">-- Sin grupo --</MenuItem>
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
      </Box>
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
    </Box>
  );
}
