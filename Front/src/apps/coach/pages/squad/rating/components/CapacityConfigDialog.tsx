import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from "@mui/material";

import type { CategoryKey } from "../../../../types/playerRating";
import type { SheetKind } from "../../../../types/ratingConfig";
import { getCategoryLabel } from "../ratingConcepts";
import { MAX_LABEL_LENGTH, MAX_TEXT_LENGTH } from "./TraitConfigDialog";

import styles from "./ConfigDialog.module.css";

export const SHEET_LABELS: Record<SheetKind, string> = { field: "Jugadores", goalkeeper: "Porteros" };

const SHEETS = Object.keys(SHEET_LABELS) as SheetKind[];
const CATEGORIES: CategoryKey[] = ["physical", "technical", "tactical", "competitiveness"];
const LEVEL_COUNT = 10;

export type CapacityFormValues = {
  sheet: SheetKind;
  categoryKey: CategoryKey;
  label: string;
  levelTexts: string[];
};

type Props = {
  mode: "create" | "edit";
  initial?: CapacityFormValues;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: CapacityFormValues) => void;
};

const EMPTY: CapacityFormValues = {
  sheet: "field",
  categoryKey: "physical",
  label: "",
  levelTexts: Array.from({ length: LEVEL_COUNT }, () => ""),
};

const filled = (value: string, max: number) => value.trim().length > 0 && value.length <= max;

export default function CapacityConfigDialog({ mode, initial = EMPTY, saving, onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<CapacityFormValues>(initial);
  const title = mode === "create" ? "Nueva capacidad" : "Editar capacidad";

  const canSave =
    filled(values.label, MAX_LABEL_LENGTH) &&
    values.levelTexts.length === LEVEL_COUNT &&
    values.levelTexts.every((text) => filled(text, MAX_TEXT_LENGTH));

  function setText(index: number, text: string) {
    setValues((prev) => ({ ...prev, levelTexts: prev.levelTexts.map((current, i) => (i === index ? text : current)) }));
  }

  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth aria-labelledby="capacity-dialog-title">
      <DialogTitle id="capacity-dialog-title">{title}</DialogTitle>
      <DialogContent className={styles.content}>
        {mode === "create" ? (
          <>
            <TextField
              select
              label="Hoja"
              size="small"
              fullWidth
              value={values.sheet}
              onChange={(e) => setValues((prev) => ({ ...prev, sheet: e.target.value as SheetKind }))}
            >
              {SHEETS.map((sheet) => (
                <MenuItem key={sheet} value={sheet}>
                  {SHEET_LABELS[sheet]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Categoría"
              size="small"
              fullWidth
              value={values.categoryKey}
              onChange={(e) => setValues((prev) => ({ ...prev, categoryKey: e.target.value as CategoryKey }))}
            >
              {CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>
                  {getCategoryLabel(category)}
                </MenuItem>
              ))}
            </TextField>
          </>
        ) : (
          <Typography variant="caption" className={styles.fixed}>
            Hoja: {SHEET_LABELS[values.sheet]} · Categoría: {getCategoryLabel(values.categoryKey)} (no se pueden cambiar)
          </Typography>
        )}
        <TextField
          label="Etiqueta"
          size="small"
          fullWidth
          required
          value={values.label}
          onChange={(e) => setValues((prev) => ({ ...prev, label: e.target.value }))}
          inputProps={{ maxLength: MAX_LABEL_LENGTH }}
        />
        {values.levelTexts.map((text, index) => (
          <TextField
            key={index}
            label={`Texto del nivel ${index + 1}`}
            size="small"
            fullWidth
            required
            multiline
            value={text}
            onChange={(e) => setText(index, e.target.value)}
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
