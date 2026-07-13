import React from "react";
import { Button, CircularProgress, FormControlLabel, Switch, TextField, Typography } from "@mui/material";
import SeasonClubField from "../SeasonClubField/SeasonClubField";
import styles from "./SeasonEditorForm.module.css";

export interface SeasonFormState {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface SeasonEditorFormProps {
  form: SeasonFormState;
  isEditing: boolean;
  selectedSeasonLabel?: string;
  saving: boolean;
  clubId: string;
  onClubIdChange: (clubId: string) => void;
  onChange: (nextForm: SeasonFormState) => void;
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export default function SeasonEditorForm({
  form,
  isEditing,
  selectedSeasonLabel,
  saving,
  clubId,
  onClubIdChange,
  onChange,
  onReset,
  onCancel,
  onSave,
}: SeasonEditorFormProps) {
  const updateField = <K extends keyof SeasonFormState>(field: K, value: SeasonFormState[K]) => {
    onChange({ ...form, [field]: value });
  };

  return (
    <div className={styles.panel}>
      <Typography variant="subtitle1" fontWeight={700}>
        {isEditing ? "Editar temporada" : "Crear temporada"}
      </Typography>

      <div className={styles.formGrid}>
        {!isEditing && (
          <div className={styles.fullWidth}>
            <SeasonClubField value={clubId} onChange={onClubIdChange} disabled={saving} />
          </div>
        )}
        <TextField
          className={styles.fullWidth}
          label="Nombre"
          value={form.name}
          onChange={(event) => updateField("name", event.target.value)}
          size="small"
          inputProps={{ maxLength: 200 }}
        />
        <TextField
          label="Fecha de inicio"
          type="date"
          value={form.startDate}
          onChange={(event) => updateField("startDate", event.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Fecha de fin"
          type="date"
          value={form.endDate}
          onChange={(event) => updateField("endDate", event.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
        />
        <div className={styles.fullWidth}>
          <FormControlLabel
            control={<Switch checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />}
            label="Marcar como activa"
          />
        </div>
      </div>

      <Typography variant="body2" className={styles.helperText}>
        {isEditing
          ? `Estás editando ${selectedSeasonLabel ?? "esta temporada"}.`
          : "Completa el formulario para crear una nueva temporada."}
      </Typography>

      <div className={styles.actionButtons}>
        {!isEditing && (
          <Button onClick={onReset} variant="outlined" size="small">
            Limpiar
          </Button>
        )}
        <Button onClick={onCancel} variant="text" size="small" disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          size="small"
          disabled={saving || !form.name.trim() || (!isEditing && !clubId)}
        >
          {saving ? <CircularProgress size={16} color="inherit" /> : isEditing ? "Guardar cambios" : "Crear temporada"}
        </Button>
      </div>
    </div>
  );
}
