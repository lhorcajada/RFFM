import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { GoalEvent } from "./liveMatch.types";
import styles from "./GoalTimeline.module.css";

interface GoalTimelineProps {
  goals: GoalEvent[];
  onRemoveGoal: (goalId: string) => void;
  /** When true, hides the delete button (used in read-only saved-data summary) */
  readOnly?: boolean;
}

export default function GoalTimeline({ goals, onRemoveGoal, readOnly = false }: GoalTimelineProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (goals.length === 0) return null;

  function handleConfirmRemove() {
    if (confirmId) onRemoveGoal(confirmId);
    setConfirmId(null);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <SportsSoccerIcon sx={{ fontSize: 14, color: "#fb923c" }} />
        <span className={styles.headerLabel}>Goles</span>
      </div>

      <div className={styles.list}>
        {goals.map((goal) => (
          <div key={goal.id} className={`${styles.entry} ${goal.isOwnTeam ? styles.entryOwn : styles.entryRival}`}>
            <span className={styles.minute}>{goal.minute}&apos;</span>

            <span className={styles.result}>
              {goal.scoreAtMoment.local}:{goal.scoreAtMoment.visitor}
            </span>

            <SportsSoccerIcon sx={{ fontSize: 11, opacity: 0.7 }} />

            <span className={styles.scorer}>
              {goal.isOwnTeam
                ? goal.scorerName
                  ? `${goal.scorerName}${goal.scorerDorsal != null ? ` (${goal.scorerDorsal})` : ""}`
                  : "Sin goleador"
                : goal.scorerName ?? "Jugador rival"}
            </span>

            <button
              className={styles.removeBtn}
              title="Eliminar gol"
              onClick={() => setConfirmId(goal.id)}
              style={readOnly ? { display: "none" } : undefined}
            >
              <DeleteOutlineIcon sx={{ fontSize: 14 }} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm remove dialog */}
      <Dialog
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>
          ¿Eliminar gol?
        </DialogTitle>
        <DialogContent sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.88rem" }}>
          El marcador se actualizará automáticamente.
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setConfirmId(null)} color="inherit" size="small">
            Cancelar
          </Button>
          <Button onClick={handleConfirmRemove} variant="contained" color="error" size="small">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
