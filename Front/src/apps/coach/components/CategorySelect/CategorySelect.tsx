import React, { useEffect, useState } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
} from "@mui/material";
import competitionService, {
  Category,
} from "../../services/competitionService";

export default function CategorySelect({
  value,
  onChange,
}: {
  value?: number | null;
  onChange?: (c?: Category) => void;
}) {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const cats = await competitionService.getCategories();
        if (mounted) setItems(cats);
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

  return (
    <div style={{ marginBottom: 8 }}>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <FormControl fullWidth variant="outlined" size="small">
          <InputLabel id="category-select-label">Categoría</InputLabel>
          <Select
            labelId="category-select-label"
            value={value ?? ""}
            label="Categoría"
            onChange={(e) => {
              const id = e.target.value as number | string;
              const c = items.find((it) => String(it.id) === String(id));
              if (onChange) onChange(c);
            }}
          >
            <MenuItem value="">-- Seleccionar categoría --</MenuItem>
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
