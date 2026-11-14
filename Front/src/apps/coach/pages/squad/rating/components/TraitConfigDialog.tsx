import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";

import { TRAIT_PHASE_LABELS, type TraitPhase } from "../ratingTraits";

import styles from "./ConfigDialog.module.css";

export const MAX_LABEL_LENGTH = 80;
export const MAX_TEXT_LENGTH = 200;

export type TraitFormValues = {
  label: string;
  phase: TraitPhase;
  anchor1: string;
  anchor3: string;
  anchor5: string;
};

type Props = {
  mode: "create" | "edit";
  initial?: TraitFormValues;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: TraitFormValues) => void;
};

const EMPTY: TraitFormValues = { label: "", phase: "withBall", anchor1: "", anchor3: "", anchor5: "" };
const PHASES = Object.keys(TRAIT_PHASE_LABELS) as TraitPhase[];

const filled = (value: string, max: number) => value.trim().length > 0 && value.length <= max;

export default function TraitConfigDialog({ mode, initial = EMPTY, saving, onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<TraitFormValues>(initial);
  const title = mode === "create" ? "Nuevo rasgo" : "Editar rasgo";

  const canSave =
    filled(values.label, MAX_LABEL_LENGTH) &&
    filled(values.anchor1, MAX_TEXT_LENGTH) &&
    filled(values.anchor3, MAX_TEXT_LENGTH) &&
    filled(values.anchor5, MAX_TEXT_LENGTH);

  function set<K extends keyof TraitFormValues>(key: K, value: TraitFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth aria-labelledby="trait-dialog-title">
      <DialogTitle id="trait-dialog-title">{title}</DialogTitle>
      <DialogContent className={styles.content}>
        <TextField
          label="Etiqueta"
          size="small"
          fullWidth
          required
          value={values.label}
          onChange={(e) => set("label", e.target.value)}
          inputProps={{ maxLength: MAX_LABEL_LENGTH }}
        />
        <TextField select label="Fase" size="small" fullWidth value={values.phase} onChange={(e) => set("phase", e.target.value as TraitPhase)}>
          {PHASES.map((phase) => (
            <MenuItem key={phase} value={phase}>
              {TRAIT_PHASE_LABELS[phase]}
            </MenuItem>
          ))}
        </TextField>
        {([1, 3, 5] as const).map((level) => (
          <TextField
            key={level}
            label={`Descriptor del nivel ${level}`}
            size="small"
            fullWidth
            required
            multiline
            minRows={2}
            value={values[`anchor${level}`]}
            onChange={(e) => set(`anchor${level}`, e.target.value)}
            inputProps={{ maxLength: MAX_TEXT_LENGTH }}
          />
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit" size="small" disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={() => onSubmit(values)} variant="contained" size="small" disabled={!canSave || saving}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
