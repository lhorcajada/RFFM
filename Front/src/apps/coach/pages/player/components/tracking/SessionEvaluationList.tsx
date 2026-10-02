import { Alert, Button, Chip, CircularProgress, Paper } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import { format, parseISO } from "date-fns";
import type { PlayerSessionListItem } from "../../../../services/playerTrackingService";
import { ATTENDANCE_LABELS, attendanceFromAssistanceType, isAbsent } from "../../utils/sessionAttendance";
import styles from "./SessionEvaluationList.module.css";

type Props = {
  items: PlayerSessionListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onCreate: (sessionId: string) => void;
  onEdit: (sessionId: string) => void;
  onDelete: (item: PlayerSessionListItem) => void;
};

function cardLabel(item: PlayerSessionListItem): string {
  return `${format(parseISO(item.date), "dd/MM/yyyy")} · ${item.name}`;
}

export default function SessionEvaluationList({ items, loading, error, onRetry, onCreate, onEdit, onDelete }: Props) {
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

  if (items.length === 0) {
    return <p className={styles.state}>No hay sesiones con fecha en esta temporada</p>;
  }

  return (
    <ul className={styles.list} aria-label="Sesiones">
      {items.map((item) => {
        const attendance = attendanceFromAssistanceType(item.hasCalendarEvent, item.assistanceTypeId);
        return (
          <li key={item.sessionId} aria-label={cardLabel(item)}>
            <Paper className={styles.card} elevation={0}>
              <div className={styles.header}>
                <span className={styles.date}>{format(parseISO(item.date), "dd/MM/yyyy")}</span>
                {item.isHeld && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color={isAbsent(attendance) ? "warning" : "default"}
                    label={ATTENDANCE_LABELS[attendance]}
                  />
                )}
              </div>
              <p className={styles.name}>{item.name}</p>

              {!item.isHeld ? (
                <p className={styles.muted}>Aún no se ha celebrado</p>
              ) : (
                <div className={styles.footer}>
                  {item.evaluation ? (
                    <div className={styles.status}>
                      <span className={styles.evaluated}>Valorado</span>
                      <span className={styles.count} aria-label={`Lo hace: ${item.evaluation.achieved}`}>
                        <CheckCircleOutlineIcon fontSize="inherit" color="success" /> {item.evaluation.achieved}
                      </span>
                      <span className={styles.count} aria-label={`A veces: ${item.evaluation.partial}`}>
                        <RemoveCircleOutlineIcon fontSize="inherit" color="warning" /> {item.evaluation.partial}
                      </span>
                      <span className={styles.count} aria-label={`No lo hace: ${item.evaluation.notAchieved}`}>
                        <HighlightOffIcon fontSize="inherit" color="error" /> {item.evaluation.notAchieved}
                      </span>
                    </div>
                  ) : (
                    <span className={styles.muted}>Sin valorar</span>
                  )}
                  <div className={styles.actions}>
                    {item.evaluation ? (
                      <>
                        <Button size="small" onClick={() => onEdit(item.sessionId)}>
                          Editar
                        </Button>
                        <Button size="small" color="error" onClick={() => onDelete(item)}>
                          Eliminar
                        </Button>
                      </>
                    ) : (
                      <Button size="small" variant="outlined" onClick={() => onCreate(item.sessionId)}>
                        Crear
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Paper>
          </li>
        );
      })}
    </ul>
  );
}
