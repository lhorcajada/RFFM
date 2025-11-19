import React, { useEffect, useState } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
} from "@mui/material";
import { getTeamsForClassification } from "../../../services/api";
import type { Classification } from "../../../types/player";

type Team = { id: string; name: string; url?: string; raw?: Classification };

export default function TeamsSelector({
  onChange,
  competitionId,
  groupId,
  value,
}: {
  onChange?: (team?: Team) => void;
  competitionId?: string;
  groupId?: string;
  value?: string;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    // reset state when filters change (but don't notify parent if a controlled `value` exists)
    setTeams([]);
    setSelected("");
    setError(null);
    if (!competitionId || !groupId) {
      setLoading(false);
      // if uncontrolled, notify parent that selection cleared
      if (!value && onChange) onChange(undefined);
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
        // payload is Classification[]
        const teamsData: Team[] = (payload || []).map(
          (c: Classification, idx: number) => {
            const rawName = (c.teamName || (c as any).nombre || "").toString();
            const rawId = (
              c.teamId ??
              (c as any).codequipo ??
              (c as any).codigo_equipo ??
              ""
            ).toString();
            // fallback id when server returns empty id
            const id =
              rawId && rawId !== ""
                ? rawId
                : `team-${idx}-${Math.abs(
                    hashCode(rawName || JSON.stringify(c))
                  )}`;
            const name = rawName || `Equipo ${idx + 1}`;
            return {
              id: String(id),
              name,
              url: c.imageUrl,
              raw: c,
            } as Team;
          }
        );
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
    const id = String(event.target.value ?? "");
    setSelected(id);
    const team = teams.find((t) => String(t.id) === id);
    if (onChange) onChange(team);
  }

  React.useEffect(() => {
    // When a controlled `value` is provided, wait until teams list is available
    // so we can find the matching team object. Only then notify parent via onChange.
    if (value !== undefined) {
      setSelected(value ?? "");
      const t = teams.find((tt) => String(tt.id) === value);
      if (t && onChange) onChange(t);
      // if teams are loaded but no match found, still notify with undefined so parent knows
      if (teams.length > 0 && !t && onChange) onChange(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, teams]);

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
