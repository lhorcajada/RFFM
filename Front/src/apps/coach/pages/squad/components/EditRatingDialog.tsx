import { useState } from "react";
import { Button, IconButton, Rating, TextField } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import styles from "./EditRatingDialog.module.css";

type RatingState = {
  technical: number;
  tactical: number;
  physical: number;
  competitiveness: number;
  notes: string;
};

type Props = {
  playerDisplayName: string;
  initial: Omit<RatingState, "notes">;
  saving: boolean;
  onSave: (state: RatingState) => void;
  onClose: () => void;
};

const FIELDS: { key: keyof Omit<RatingState, "notes">; label: string }[] = [
  { key: "technical", label: "Técnico" },
  { key: "tactical", label: "Táctico" },
  { key: "physical", label: "Físico" },
  { key: "competitiveness", label: "Competitividad" },
];

export default function EditRatingDialog({
  playerDisplayName,
  initial,
  saving,
  onSave,
  onClose,
}: Props) {
  const [state, setState] = useState<RatingState>({ ...initial, notes: "" });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>
              <EditIcon fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5 }} />
              Nueva valoración
            </div>
            <div className={styles.playerName}>{playerDisplayName}</div>
          </div>
          <IconButton size="small" onClick={onClose} disabled={saving}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        <div className={styles.body}>
          {FIELDS.map(({ key, label }) => (
            <div key={key} className={styles.field}>
              <span className={styles.fieldLabel}>{label}</span>
              <Rating
                value={state[key]}
                onChange={(_, v) =>
                  setState((prev) => ({ ...prev, [key]: v ?? 1 }))
                }
                max={5}
              />
            </div>
          ))}
          <TextField
            label="Notas (opcional)"
            value={state.notes}
            onChange={(e) =>
              setState((prev) => ({ ...prev, notes: e.target.value }))
            }
            size="small"
            multiline
            rows={2}
            fullWidth
            inputProps={{ maxLength: 500 }}
          />
        </div>

        <div className={styles.footer}>
          <Button size="small" variant="text" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => onSave(state)}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
