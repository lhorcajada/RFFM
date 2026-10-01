import { useState } from "react";
import { Button, Chip, IconButton, Paper, TextField } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { format, parseISO } from "date-fns";
import {
  ASSESSMENT_LABELS,
  type ObservationAssessment,
  type PlayerObservation,
  type UpdatePlayerObservationRequest,
} from "../../../../services/playerTrackingService";
import AssessmentButtons from "./AssessmentButtons";
import HabilidadesPicker from "./HabilidadesPicker";
import styles from "./PlayerObservationCard.module.css";

const COMMENT_MAX_LENGTH = 500;

const ASSESSMENT_COLORS: Record<ObservationAssessment, "success" | "warning" | "error"> = {
  Achieved: "success",
  Partial: "warning",
  NotAchieved: "error",
};

type Props = {
  observation: PlayerObservation;
  onUpdate: (observationId: string, request: UpdatePlayerObservationRequest) => Promise<void>;
  onDelete: (observation: PlayerObservation) => void;
};

export default function PlayerObservationCard({ observation, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [assessment, setAssessment] = useState<ObservationAssessment | null>(observation.assessment);
  const [comment, setComment] = useState(observation.comment ?? "");
  const [habilidades, setHabilidades] = useState<string[]>(observation.habilidades);
  const [saving, setSaving] = useState(false);
  const isAttitude = observation.kind === "Attitude";

  const startEditing = () => {
    setAssessment(observation.assessment);
    setComment(observation.comment ?? "");
    setHabilidades(observation.habilidades);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!assessment) return;
    setSaving(true);
    try {
      const base = { assessment, comment: comment.trim() || null };
      await onUpdate(observation.id, isAttitude ? base : { ...base, habilidades });
      setEditing(false);
    } catch {
      // El aviso lo muestra quien actualiza; se mantiene la edición para reintentar.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper className={styles.card} elevation={0}>
      <div className={styles.header}>
        <span className={styles.date}>{format(parseISO(observation.date), "dd/MM/yyyy")}</span>
        {!editing && (
          <div className={styles.headerActions}>
            <Chip
              size="small"
              color={ASSESSMENT_COLORS[observation.assessment]}
              label={ASSESSMENT_LABELS[observation.assessment]}
            />
            <IconButton size="small" aria-label="Editar observación" onClick={startEditing}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label="Eliminar observación" onClick={() => onDelete(observation)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </div>
        )}
      </div>
      <p className={styles.context}>
        {isAttitude ? "Actitud" : [observation.momentName, observation.principleLabel].filter(Boolean).join(" · ")}
      </p>
      <p className={styles.subprincipio}>{isAttitude ? observation.attitudeLabel : observation.subprincipioLabel}</p>
      {!editing && observation.habilidades.length > 0 && (
        <div className={styles.habilidades}>
          {observation.habilidades.map((h) => (
            <Chip key={h} label={h} size="small" variant="outlined" />
          ))}
        </div>
      )}

      {editing ? (
        <div className={styles.editor}>
          <AssessmentButtons value={assessment} onChange={setAssessment} />
          {!isAttitude && <HabilidadesPicker value={habilidades} onChange={setHabilidades} />}
          <TextField
            label="Comentario"
            multiline
            minRows={2}
            size="small"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            inputProps={{ maxLength: COMMENT_MAX_LENGTH }}
            fullWidth
          />
          <div className={styles.editorActions}>
            <Button size="small" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="small" variant="contained" onClick={handleSave} disabled={!assessment || saving}>
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        observation.comment && <p className={styles.comment}>{observation.comment}</p>
      )}

      {observation.trainingSessionName && (
        <p className={styles.session}>{`Sesión: ${observation.trainingSessionName}`}</p>
      )}
    </Paper>
  );
}
