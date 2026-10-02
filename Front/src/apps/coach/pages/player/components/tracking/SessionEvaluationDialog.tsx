import { useEffect, useState } from "react";
import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { format, parseISO } from "date-fns";
import {
  getSessionEvaluation,
  type PlayerSessionListItem,
  type SaveSessionEvaluationItem,
  type SessionEvaluation,
} from "../../../../services/playerTrackingService";
import { useSessionDetail } from "../../hooks/useSessionDetail";
import SessionEvaluationForm from "./SessionEvaluationForm";
import styles from "./SessionEvaluationDialog.module.css";

type Props = {
  open: boolean;
  teamId: string;
  teamPlayerId: string;
  sessions: PlayerSessionListItem[];
  /** Sesión ya elegida (Crear o Editar desde su tarjeta). Sin ella se muestra el selector. */
  initialSessionId: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (sessionId: string, items: SaveSessionEvaluationItem[]) => Promise<void>;
};

export default function SessionEvaluationDialog({
  open,
  teamId,
  teamPlayerId,
  sessions,
  initialSessionId,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [initial, setInitial] = useState<SessionEvaluation | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);

  const session = sessions.find((s) => s.sessionId === sessionId) ?? null;
  const { detail, loading: loadingDetail } = useSessionDetail(session?.sessionId ?? null);
  const selectable = sessions.filter((s) => s.isHeld && !s.evaluation);

  useEffect(() => {
    setInitial(null);
    if (!session?.evaluation) return;
    let cancelled = false;
    setLoadingInitial(true);
    getSessionEvaluation(teamId, teamPlayerId, session.sessionId)
      .then((result) => {
        if (!cancelled) setInitial(result);
      })
      .catch(() => {
        if (!cancelled) setInitial(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, teamPlayerId, session?.sessionId, session?.evaluation]);

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md" aria-labelledby="session-evaluation-title">
      <DialogTitle id="session-evaluation-title" className={styles.title}>
        {initial ? "Editar seguimiento" : "Seguimiento de la sesión"}
        <IconButton aria-label="Cerrar" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers className={styles.content}>
        {!initialSessionId && (
          <TextField
            select
            label="Sesión"
            size="small"
            value={sessionId ?? ""}
            onChange={(e) => setSessionId(e.target.value || null)}
            fullWidth
            helperText={selectable.length === 0 ? "Todas las sesiones celebradas ya tienen seguimiento" : undefined}
          >
            {selectable.map((s) => (
              <MenuItem key={s.sessionId} value={s.sessionId}>
                {`${format(parseISO(s.date), "dd/MM")} · ${s.name}`}
              </MenuItem>
            ))}
          </TextField>
        )}

        {session &&
          (loadingInitial ? (
            <div className={styles.state}>
              <CircularProgress size={24} />
            </div>
          ) : (
            <SessionEvaluationForm
              key={`${session.sessionId}:${initial?.id ?? "nuevo"}`}
              session={session}
              detail={detail}
              loadingDetail={loadingDetail}
              initial={initial}
              saving={saving}
              onSubmit={(items) => onSubmit(session.sessionId, items)}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}
