import React, { useEffect, useState } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import seasonService, {
  Season,
} from "../../../../apps/coach/services/seasonService";
import styles from "./SeasonSelector.module.css";

export default function SeasonSelector({
  value,
  onChange,
  showLabel = true,
  size = "small",
}: {
  value?: string;
  onChange?: (seasonId?: string) => void;
  showLabel?: boolean;
  size?: "small" | "medium";
}) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(value ?? "");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const all = await seasonService.getSeasons();
        if (!mounted) return;
        setSeasons(all || []);
        if ((value === undefined || value === "") && all && all.length > 0) {
          const active = await seasonService.getActiveSeason();
          if (!mounted) return;
          if (active && active.id) {
            setSelected(active.id);
            if (onChange) onChange(active.id);
          }
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(String(e?.message ?? "Error cargando temporadas"));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelected(value ?? "");
  }, [value]);

  function handleChange(e: any) {
    const v = String(e.target.value ?? "");
    setSelected(v);
    if (onChange) onChange(v || undefined);
  }

  if (loading)
    return (
      <div className={styles.spinnerWrap}>
        <CircularProgress size={20} />
      </div>
    );

  return (
    <div className={styles.root}>
      <FormControl size={size} fullWidth variant="outlined">
        {showLabel && (
          <InputLabel id="season-select-label">Temporada</InputLabel>
        )}
        <Select
          labelId="season-select-label"
          value={selected}
          label={showLabel ? "Temporada" : undefined}
          onChange={handleChange}
        >
          <MenuItem value="">-- Temporada --</MenuItem>
          {seasons.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name ?? s.id}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
