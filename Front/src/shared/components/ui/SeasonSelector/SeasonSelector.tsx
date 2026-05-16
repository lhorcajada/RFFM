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
  clubId,
}: {
  value?: string;
  onChange?: (seasonId?: string) => void;
  showLabel?: boolean;
  size?: "small" | "medium";
  clubId: string;
}) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(value ?? "");

  useEffect(() => {
    if (!clubId) {
      setSeasons([]);
      setError(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const all = await seasonService.getSeasons(clubId);
        if (!mounted) return;
        setSeasons(all || []);
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
  }, [clubId]);

  useEffect(() => {
    setSelected(value ?? "");
  }, [value]);

  useEffect(() => {
    if (loading || seasons.length === 0) return;

    const hasValidValue = Boolean(value) && seasons.some((season) => season.id === value);
    if (hasValidValue) return;

    const fallbackSeason = seasons.find((season) => season.active ?? season.isActive) ?? seasons[0];
    if (!fallbackSeason?.id || fallbackSeason.id === selected) return;

    setSelected(fallbackSeason.id);
    if (onChange) onChange(fallbackSeason.id);
  }, [loading, onChange, selected, seasons, value]);

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
