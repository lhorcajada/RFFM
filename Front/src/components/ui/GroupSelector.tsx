import React, { useEffect, useState } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
} from "@mui/material";
import { getGroups } from "../../services/api";

type Group = { id: string; name: string };

export default function GroupSelector({
  competitionId,
  onChange,
  value,
}: {
  competitionId?: string;
  onChange?: (g?: Group) => void;
  value?: string;
}) {
  const [items, setItems] = useState<Group[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!competitionId) {
        setItems([]);
        setSelected("");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const payload = await getGroups(competitionId);
        let data: any[] = [];
        if (Array.isArray(payload)) data = payload;
        else if (Array.isArray(payload.items)) data = payload.items;
        const mapped = data.map((d: any) => ({
          id: String(d.id ?? d.code ?? d.codgrupo ?? d.codigo),
          name: d.name ?? d.nombre ?? d.nombre_grupo ?? String(d.id),
        }));
        if (mounted) setItems(mapped as Group[]);
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
  }, [competitionId]);

  // when parent provides a value, sync internal selected
  useEffect(() => {
    if (value !== undefined) {
      setSelected(value ?? "");
    }
  }, [value]);

  // when competition changes, if no external value provided, reset selection
  useEffect(() => {
    if (!competitionId && value === undefined) {
      setSelected("");
      if (onChange) onChange(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);
  // sync controlled value and notify parent when items are available
  React.useEffect(() => {
    if (value !== undefined) {
      setSelected(value ?? "");
      const g = items.find((it) => it.id === value);
      if (onChange) onChange(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items]);

  function handleChange(e: any) {
    const id = e.target.value;
    setSelected(id);
    const g = items.find((it) => it.id === id);
    if (onChange) onChange(g);
  }

  React.useEffect(() => {
    if ((arguments as any)[0]?.value !== undefined) {
      // no-op: value passed via props list is handled by caller
    }
  }, []);

  return (
    <div style={{ marginBottom: 8 }}>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <FormControl fullWidth variant="outlined" size="small">
          <InputLabel id="group-select-label">Grupo</InputLabel>
          <Select
            labelId="group-select-label"
            value={selected}
            label="Grupo"
            onChange={handleChange}
          >
            <MenuItem value="">-- Seleccionar grupo --</MenuItem>
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
