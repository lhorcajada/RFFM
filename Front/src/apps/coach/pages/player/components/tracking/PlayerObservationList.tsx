import { Alert, Button, Chip, CircularProgress, Paper } from "@mui/material";
import { format, parseISO } from "date-fns";
import {
  ASSESSMENT_LABELS,
  type ObservationAssessment,
  type PlayerObservation,
} from "../../../../services/playerTrackingService";
import styles from "./PlayerObservationList.module.css";

const ASSESSMENT_COLORS: Record<ObservationAssessment, "success" | "warning" | "error"> = {
  Achieved: "success",
  Partial: "warning",
  NotAchieved: "error",
};

type Props = {
  observations: PlayerObservation[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export default function PlayerObservationList({ observations, loading, error, onRetry }: Props) {
  if (loading) {
    return (
      <div className={styles.state}>
        <CircularProgress size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Reintentar
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (observations.length === 0) {
    return <p className={styles.state}>Aún no hay observaciones para este jugador</p>;
  }

  return (
    <ul className={styles.list} aria-label="Observaciones">
      {observations.map((observation) => (
        <li key={observation.id}>
          <Paper className={styles.card} elevation={0}>
            <div className={styles.header}>
              <span className={styles.date}>{format(parseISO(observation.date), "dd/MM/yyyy")}</span>
              <Chip
                size="small"
                color={ASSESSMENT_COLORS[observation.assessment]}
                label={ASSESSMENT_LABELS[observation.assessment]}
              />
            </div>
            <p className={styles.context}>
              {[observation.momentName, observation.principleLabel].filter(Boolean).join(" · ")}
            </p>
            <p className={styles.subprincipio}>{observation.subprincipioLabel}</p>
            {observation.comment && <p className={styles.comment}>{observation.comment}</p>}
            {observation.trainingSessionName && (
              <p className={styles.session}>{`Sesión: ${observation.trainingSessionName}`}</p>
            )}
          </Paper>
        </li>
      ))}
    </ul>
  );
}
