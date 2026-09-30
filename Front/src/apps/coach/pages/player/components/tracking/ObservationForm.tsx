import { useState } from "react";
import { Alert, Autocomplete, Button, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import {
  ASSESSMENT_LABELS,
  type CreatePlayerObservationRequest,
  type ObservationAssessment,
} from "../../../../services/playerTrackingService";
import type { SubprincipioOption } from "../../hooks/useSubprincipioOptions";
import styles from "./ObservationForm.module.css";

const COMMENT_MAX_LENGTH = 500;

const ASSESSMENT_BUTTONS: { value: ObservationAssessment; icon: JSX.Element; color: "success" | "warning" | "error" }[] = [
  { value: "Achieved", icon: <CheckCircleOutlineIcon fontSize="small" />, color: "success" },
  { value: "Partial", icon: <RemoveCircleOutlineIcon fontSize="small" />, color: "warning" },
  { value: "NotAchieved", icon: <HighlightOffIcon fontSize="small" />, color: "error" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  options: SubprincipioOption[];
  hasModel: boolean;
  saving: boolean;
  onSubmit: (request: CreatePlayerObservationRequest) => Promise<void>;
};

export default function ObservationForm({ options, hasModel, saving, onSubmit }: Props) {
  const [date, setDate] = useState(todayIso);
  const [subprincipio, setSubprincipio] = useState<SubprincipioOption | null>(null);
  const [assessment, setAssessment] = useState<ObservationAssessment | null>(null);
  const [comment, setComment] = useState("");

  if (!hasModel) {
    return (
      <Alert severity="info" className={styles.notice}>
        El equipo no tiene modelo de juego en la temporada activa. Créalo en Modelo de juego para registrar
        observaciones.
      </Alert>
    );
  }

  const canSave = !!subprincipio && !!assessment && !!date && !saving;

  const handleSubmit = async () => {
    if (!subprincipio || !assessment) return;
    try {
      await onSubmit({
        date,
        subprincipioId: subprincipio.id,
        assessment,
        comment: comment.trim() || null,
      });
      setSubprincipio(null);
      setAssessment(null);
      setComment("");
    } catch {
      // El aviso lo muestra quien guarda; el formulario conserva lo escrito para reintentar.
    }
  };

  return (
    <section className={styles.form} aria-label="Registrar observación">
      <div className={styles.row}>
        <TextField
          label="Fecha"
          type="date"
          size="small"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ max: todayIso() }}
          className={styles.date}
        />
        <Autocomplete
          options={options}
          groupBy={(option) => option.group}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          value={subprincipio}
          onChange={(_, value) => setSubprincipio(value)}
          className={styles.subprincipio}
          renderInput={(params) => <TextField {...params} label="Subprincipio" size="small" />}
        />
      </div>

      <ToggleButtonGroup
        exclusive
        value={assessment}
        onChange={(_, value: ObservationAssessment | null) => setAssessment(value)}
        className={styles.assessment}
        aria-label="Valoración"
      >
        {ASSESSMENT_BUTTONS.map((button) => (
          <ToggleButton
            key={button.value}
            value={button.value}
            color={button.color}
            aria-label={ASSESSMENT_LABELS[button.value]}
            className={styles.assessmentButton}
          >
            {button.icon}
            <span>{ASSESSMENT_LABELS[button.value]}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <TextField
        label="Comentario (opcional)"
        multiline
        minRows={2}
        size="small"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        inputProps={{ maxLength: COMMENT_MAX_LENGTH }}
        helperText={`${comment.length}/${COMMENT_MAX_LENGTH}`}
        fullWidth
      />

      <div className={styles.actions}>
        <Button variant="contained" onClick={handleSubmit} disabled={!canSave}>
          Guardar
        </Button>
      </div>
    </section>
  );
}
