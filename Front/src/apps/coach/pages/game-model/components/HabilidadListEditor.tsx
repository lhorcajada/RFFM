import { Box, Button, IconButton, MenuItem, Select, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { Habilidad } from "../../../types/gameModel";
import { HABILIDAD_VOCABULARY } from "../../../types/gameModel";
import styles from "./NotaListEditor.module.css";

interface Props {
  habilidades: Habilidad[];
  onAdd: () => void;
  onUpdate: (
    hi: number,
    changes: Partial<Pick<Habilidad, "nombre" | "descripcion" | "entrenable" | "referenciaAKey">>
  ) => void;
  onDelete: (hi: number) => void;
}

export default function HabilidadListEditor({ habilidades, onAdd, onUpdate, onDelete }: Props) {
  return (
    <Box className={styles.root}>
      <Typography className={styles.label}>Habilidades imprescindibles</Typography>
      {habilidades.map((h, hi) => (
        <Box key={h.id} className={styles.row} sx={{ flexDirection: "column", alignItems: "stretch" }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Select
              value={h.nombre}
              onChange={(e) => onUpdate(hi, { nombre: e.target.value })}
              displayEmpty
              size="small"
              className={styles.tipoSelect}
            >
              <MenuItem value="" disabled>
                Nombre…
              </MenuItem>
              {HABILIDAD_VOCABULARY.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
            <IconButton size="small" aria-label="Eliminar habilidad" onClick={() => onDelete(hi)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
          <TextField
            value={h.descripcion}
            onChange={(e) => onUpdate(hi, { descripcion: e.target.value })}
            placeholder="Descripción…"
            size="small"
            multiline
            maxRows={3}
            fullWidth
            label="Descripción"
            sx={{ mt: 1 }}
          />
          <TextField
            value={h.entrenable}
            onChange={(e) => onUpdate(hi, { entrenable: e.target.value })}
            placeholder="Entrenable…"
            size="small"
            multiline
            maxRows={3}
            fullWidth
            label="Entrenable"
            sx={{ mt: 1 }}
          />
        </Box>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={onAdd} className={styles.addBtn}>
        Añadir habilidad
      </Button>
    </Box>
  );
}
