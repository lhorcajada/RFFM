import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import type { LiveMatchPhase } from "./liveMatch.types";
import type { PendingAction } from "../../hooks/useLiveMatch";
import SimulationConfig from "./SimulationConfig";
import styles from "./LiveMatchTimer.module.css";

interface LiveMatchTimerProps {
  matchPhase: LiveMatchPhase;
  currentMinute: number;
  currentSecond: number;
  half: 1 | 2;
  isHalftime: boolean;
  halfDuration: number;
  onHalfDurationChange: (minutes: number) => void;
  pendingAction: PendingAction;
  onRequestAction: (action: NonNullable<PendingAction>) => void;
  onConfirmAction: () => void;
  onCancelAction: () => void;
}

function formatTime(minute: number, second: number): string {
  return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

const CONFIRM_LABELS: Record<NonNullable<PendingAction>, string> = {
  startMatch: "¿Confirmar inicio del partido?",
  endFirstHalf: "¿Confirmar final de la 1ª parte?",
  startSecondHalf: "¿Confirmar inicio de la 2ª parte?",
  endMatch: "¿Confirmar final del partido?",
};

export default function LiveMatchTimer({
  matchPhase,
  currentMinute,
  currentSecond,
  half,
  isHalftime,
  halfDuration,
  onHalfDurationChange,
  pendingAction,
  onRequestAction,
  onConfirmAction,
  onCancelAction,
}: LiveMatchTimerProps) {
  const phaseBadge = (() => {
    if (matchPhase === "preMatch") return "ANTES";
    if (isHalftime) return "DESCANSO";
    if (matchPhase === "finished") return "FIN";
    return `${half}ª`;
  })();

  const phaseBadgeClass = [
    styles.halfBadge,
    matchPhase === "finished" ? styles.finishedBadge
    : isHalftime ? styles.halftimeBadge
    : half === 2 ? styles.secondHalf
    : "",
  ].join(" ");

  return (
    <div className={styles.root}>
      {/* Phase badge */}
      <span className={phaseBadgeClass}>{phaseBadge}</span>

      {/* Clock */}
      <span className={styles.clock}>{formatTime(currentMinute, currentSecond)}</span>

      {/* Phase action button */}
      <div className={styles.actionGroup}>
        {matchPhase === "preMatch" && (
          <Button
            variant="contained"
            color="success"
            size="small"
            onClick={() => onRequestAction("startMatch")}
          >
            Iniciar partido
          </Button>
        )}
        {matchPhase === "firstHalf" && (
          <Button
            variant="contained"
            color="warning"
            size="small"
            onClick={() => onRequestAction("endFirstHalf")}
          >
            Fin 1ª parte
          </Button>
        )}
        {matchPhase === "halftime" && (
          <Button
            variant="contained"
            color="success"
            size="small"
            onClick={() => onRequestAction("startSecondHalf")}
          >
            Iniciar 2ª parte
          </Button>
        )}
        {matchPhase === "secondHalf" && (
          <Button
            variant="contained"
            color="error"
            size="small"
            onClick={() => onRequestAction("endMatch")}
          >
            Finalizar partido
          </Button>
        )}
        {matchPhase === "finished" && (
          <span className={styles.finishedLabel}>Partido finalizado</span>
        )}
      </div>

      {/* Duration config — only before match starts */}
      {matchPhase === "preMatch" && (
        <SimulationConfig
          halfDuration={halfDuration}
          onHalfDurationChange={onHalfDurationChange}
        />
      )}

      {/* Confirmation dialog */}
      <Dialog
        open={pendingAction !== null}
        onClose={onCancelAction}
        PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: "#fff", fontSize: "1rem", fontWeight: 700 }}>
          Confirmación
        </DialogTitle>
        <DialogContent sx={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9rem" }}>
          {pendingAction ? CONFIRM_LABELS[pendingAction] : ""}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onCancelAction} color="inherit" size="small">
            Cancelar
          </Button>
          <Button onClick={onConfirmAction} variant="contained" size="small" autoFocus>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
