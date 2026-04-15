import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import type { LiveMatchBackup } from "./liveMatch.types";

interface LiveMatchRecoveryDialogProps {
  backup: LiveMatchBackup;
  onAccept: () => void;
  onDiscard: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  preMatch: "Antes del partido",
  firstHalf: "1ª Parte en curso",
  halftime: "Descanso",
  secondHalf: "2ª Parte en curso",
  finished: "Finalizado",
};

export default function LiveMatchRecoveryDialog({
  backup,
  onAccept,
  onDiscard,
}: LiveMatchRecoveryDialogProps) {
  const savedAt = new Date(backup.savedAt);
  const elapsed = Math.round((Date.now() - savedAt.getTime()) / 60000);

  return (
    <Dialog
      open
      PaperProps={{
        sx: {
          bgcolor: "#19192e",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 3,
          maxWidth: 380,
        },
      }}
    >
      <DialogTitle
        sx={{ color: "#fb923c", fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}
      >
        <RestoreIcon sx={{ fontSize: 18 }} />
        Partido en progreso encontrado
      </DialogTitle>
      <DialogContent
        sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: 1 }}
      >
        <p style={{ margin: 0 }}>
          Se encontró un partido guardado automáticamente hace{" "}
          <strong style={{ color: "#fff" }}>{elapsed} min</strong>.
        </p>
        <p style={{ margin: 0 }}>
          Fase:{" "}
          <strong style={{ color: "#4d9de0" }}>
            {PHASE_LABELS[backup.matchPhase] ?? backup.matchPhase}
          </strong>
        </p>
        <p style={{ margin: "0", color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>
          Si recuperas, el cronómetro sumará el tiempo transcurrido desde que abandonaste la página.
        </p>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button onClick={onDiscard} color="inherit" size="small">
          Descartar
        </Button>
        <Button onClick={onAccept} variant="contained" size="small" autoFocus>
          Recuperar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
