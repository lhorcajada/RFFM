import { Box, Button, IconButton, MenuItem, Select, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { Nota, NotaTipo } from "../../../types/gameModel";
import { NOTA_TIPOS, NOTA_TIPO_LABELS } from "../../../types/gameModel";
import styles from "./NotaListEditor.module.css";

interface Props {
  notas: Nota[];
  onAdd: () => void;
  onUpdate: (ni: number, changes: Partial<Pick<Nota, "tipo" | "texto">>) => void;
  onDelete: (ni: number) => void;
}

export default function NotaListEditor({ notas, onAdd, onUpdate, onDelete }: Props) {
  return (
    <Box className={styles.root}>
      <Typography className={styles.label}>Notas</Typography>
      {notas.map((nota, ni) => (
        <Box key={nota.id} className={styles.row}>
          <Select
            value={nota.tipo}
            onChange={(e) => onUpdate(ni, { tipo: e.target.value as NotaTipo })}
            size="small"
            className={styles.tipoSelect}
          >
            {NOTA_TIPOS.map((tipo) => (
              <MenuItem key={tipo} value={tipo}>
                {NOTA_TIPO_LABELS[tipo]}
              </MenuItem>
            ))}
          </Select>
          <TextField
            value={nota.texto}
            onChange={(e) => onUpdate(ni, { texto: e.target.value })}
            placeholder="Texto de la nota…"
            size="small"
            multiline
            maxRows={3}
            fullWidth
            className={styles.textoField}
          />
          <IconButton size="small" aria-label="Eliminar nota" onClick={() => onDelete(ni)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={onAdd} className={styles.addBtn}>
        Añadir nota
      </Button>
    </Box>
  );
}
