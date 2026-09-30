import { useState } from "react";
import { Alert, Autocomplete, Button, TextField } from "@mui/material";
import type { CreatePlayerObservationRequest, ObservationAssessment } from "../../../../services/playerTrackingService";
import type { SubprincipioOption } from "../../hooks/useSubprincipioOptions";
import AssessmentButtons from "./AssessmentButtons";
import styles from "./ObservationForm.module.css";

const COMMENT_MAX_LENGTH = 500;

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

      <AssessmentButtons value={assessment} onChange={setAssessment} />

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
