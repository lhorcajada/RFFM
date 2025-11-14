import React, { useEffect, useState } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
} from "@mui/material";
import { getTeamsForClassification } from "../../services/api";

type Team = { id: string; name: string; url?: string };

export default function TeamsSelector({
  onChange,
  competitionId,
  groupId,
}: {
  onChange?: (team?: Team) => void;
  competitionId?: string;
  groupId?: string;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    // reset selection when filters change
    setTeams([]);
    setSelected("");
    setError(null);
    if (onChange) onChange(undefined);
    // only load teams when both competition and group are provided
    if (!competitionId || !groupId) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await getTeamsForClassification({
          season: "21",
          competition: competitionId,
          group: groupId,
          playType: "1",
        });
        const teamsData: Team[] = (payload && payload.teams) || payload || [];
        if (mounted) setTeams(teamsData as Team[]);
      } catch (err: unknown) {
        if (mounted) {
          setError(String((err as Error).message || err));
          setTeams([
            { id: "1-sample", name: "Equipo A" },
            { id: "2-sample", name: "Equipo B" },
          ]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [competitionId, groupId]);

  function handleChange(event: any) {
    const id = event.target.value;
    setSelected(id);
    const team = teams.find((t) => t.id === id);
    if (onChange) onChange(team);
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <FormControl fullWidth variant="outlined" size="small">
          <InputLabel id="teams-select-label">Equipo</InputLabel>
          <Select
            labelId="teams-select-label"
            value={selected}
            label="Equipo"
            onChange={handleChange}
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
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
    </div>
  );
}

function hashCode(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}
