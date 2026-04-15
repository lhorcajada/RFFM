import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Alert,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";
import styles from "./LiveMatchManualEditDialog.module.css";

interface ManualMinutes {
  [teamPlayerId: string]: string; // string so the input works uncontrolled
}

interface LiveMatchManualEditDialogProps {
  open: boolean;
  onClose: () => void;
  lineupPlayers: SquadPlayer[];
  /** Initial minutes per teamPlayerId */
  currentMinutes: Record<string, number>;
  onSave: (overrides: Record<string, number>) => void;
}

export default function LiveMatchManualEditDialog({
  open,
  onClose,
  lineupPlayers,
  currentMinutes,
  onSave,
}: LiveMatchManualEditDialogProps) {
  const [values, setValues] = useState<ManualMinutes>(() =>
    Object.fromEntries(lineupPlayers.map((p) => [p.id, String(currentMinutes[p.id] ?? 0)])),
  );
  const [error, setError] = useState<string | null>(null);

  function handleChange(playerId: string, raw: string) {
    setValues((prev) => ({ ...prev, [playerId]: raw }));
    setError(null);
  }

  function handleSave() {
    const overrides: Record<string, number> = {};
    for (const [pid, raw] of Object.entries(values)) {
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 200) {
        setError("Revisa los minutos introducidos (deben ser números entre 0 y 200).");
        return;
      }
      overrides[pid] = parsed;
    }
    onSave(overrides);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3 } }}
    >
      <DialogTitle
        sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}
      >
        <EditIcon sx={{ fontSize: 18, color: "#fb923c" }} />
        Edición manual de minutos
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        <div className={styles.grid}>
          {lineupPlayers.map((p) => {
            const name = p.alias?.trim() || p.displayName.split(" ").slice(0, 2).join(" ");
            return (
              <div key={p.id} className={styles.row}>
                {p.dorsal != null && (
                  <span className={styles.dorsal}>{p.dorsal}</span>
                )}
                <span className={styles.name}>{name}</span>
                <TextField
                  size="small"
                  type="number"
                  inputProps={{ min: 0, max: 200, step: 1 }}
                  value={values[p.id] ?? "0"}
                  onChange={(e) => handleChange(p.id, e.target.value)}
                  sx={{
                    width: 80,
                    "& .MuiInputBase-input": { color: "#fff", textAlign: "center" },
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
                  }}
                />
                <span className={styles.minLabel}>min</span>
              </div>
            );
          })}
        </div>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit" size="small">
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" size="small">
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
