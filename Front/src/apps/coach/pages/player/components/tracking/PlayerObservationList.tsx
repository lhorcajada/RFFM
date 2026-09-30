import { Alert, Button, CircularProgress } from "@mui/material";
import type { PlayerObservation, UpdatePlayerObservationRequest } from "../../../../services/playerTrackingService";
import PlayerObservationCard from "./PlayerObservationCard";
import styles from "./PlayerObservationList.module.css";

type Props = {
  observations: PlayerObservation[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onUpdate: (observationId: string, request: UpdatePlayerObservationRequest) => Promise<void>;
  onDelete: (observation: PlayerObservation) => void;
};

export default function PlayerObservationList({ observations, loading, error, onRetry, onUpdate, onDelete }: Props) {
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
          <PlayerObservationCard observation={observation} onUpdate={onUpdate} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  );
}
