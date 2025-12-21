import React, { useEffect, useState } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
} from "@mui/material";
import competitionService, { League } from "../../services/competitionService";

export default function LeagueSelect({
  categoryId,
  value,
  onChange,
}: {
  categoryId?: number | null;
  value?: number | null;
  onChange?: (l?: League | null) => void;
}) {
  const [items, setItems] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (categoryId === undefined || categoryId === null) {
        setItems([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const leagues = await competitionService.getLeagues(categoryId);
        if (mounted) setItems(leagues);
      } catch (err: unknown) {
        if (mounted) setError(String((err as Error).message || err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [categoryId]);

  return (
    <div style={{ marginBottom: 8 }}>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <FormControl fullWidth variant="outlined" size="small">
          <InputLabel id="league-select-label">Liga</InputLabel>
          <Select
            labelId="league-select-label"
            value={value ?? ""}
            label="Liga"
            onChange={(e) => {
              const id = e.target.value as number | string;
              const l =
                items.find((it) => String(it.id) === String(id)) ?? null;
              if (onChange) onChange(l);
            }}
          >
            <MenuItem value="">-- Sin liga --</MenuItem>
            {items.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
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
