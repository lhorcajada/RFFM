import React, { useEffect, useState } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
} from "@mui/material";
import { getCompetitions } from "../../../services/api";

type Competition = { id: string; name: string };

export default function CompetitionSelector({
  onChange,
  value,
}: {
  onChange?: (c?: Competition) => void;
  value?: string;
}) {
  const [items, setItems] = useState<Competition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await getCompetitions();
        let data: any[] = [];
        if (Array.isArray(payload)) data = payload;
        else if (Array.isArray(payload.items)) data = payload.items;
        const mapped = data.map((d: any) => ({
          id: String(
            d.id ??
              d.codigo ??
              d.code ??
              d.competitionId ??
              d.codigo_competicion ??
              d.codigo
          ),
          name:
            d.name ??
            d.nombre ??
            d.nombre_competicion ??
            d.descripcion ??
            String(d.id),
        }));
        if (mounted) setItems(mapped as Competition[]);
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
  }, []);

  function handleChange(e: any) {
    const id = e.target.value;
    setSelected(id);
    const c = items.find((it) => it.id === id);
    if (onChange) onChange(c);
  }

  // sync controlled value
  React.useEffect(() => {
    if (value !== undefined) setSelected(value);
  }, [value]);

  return (
    <div style={{ marginBottom: 8 }}>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <FormControl fullWidth variant="outlined" size="small">
          <InputLabel id="competition-select-label">Competición</InputLabel>
          <Select
            labelId="competition-select-label"
            value={selected}
            label="Competición"
            onChange={handleChange}
          >
            <MenuItem value="">-- Seleccionar competición --</MenuItem>
            {items.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
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
