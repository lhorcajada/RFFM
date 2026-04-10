import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { MatchSimulation } from "./simulation.types";
import styles from "./SavedSimulationsPanel.module.css";

interface SavedSimulationsPanelProps {
  savedSimulations: MatchSimulation[];
  onSave: (name: string) => void;
  onLoad: (sim: MatchSimulation) => void;
  onDelete: (id: string) => void;
}

export default function SavedSimulationsPanel({
  savedSimulations,
  onSave,
  onLoad,
  onDelete,
}: SavedSimulationsPanelProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [simName, setSimName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function handleSave() {
    const trimmed = simName.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setSimName("");
    setSaveDialogOpen(false);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>Simulaciones guardadas</span>
        <span className={styles.badge}>{savedSimulations.length}</span>
        <Button
          size="small"
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={() => setSaveDialogOpen(true)}
          sx={{ ml: "auto", fontSize: "0.7rem" }}
        >
          Guardar actual
        </Button>
      </div>

      {savedSimulations.length === 0 ? (
        <p className={styles.empty}>No hay simulaciones guardadas para este partido.</p>
      ) : (
        <div className={styles.list}>
          {savedSimulations.map((sim) => (
            <div key={sim.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{sim.name}</span>
                <span className={styles.itemMeta}>
                  Min {sim.savedAtMinute} · {sim.windows.length} ventana
                  {sim.windows.length !== 1 ? "s" : ""}
                </span>
                <span className={styles.itemDate}>
                  {new Date(sim.createdAt).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div className={styles.itemActions}>
                <Tooltip title="Cargar simulación">
                  <IconButton size="small" onClick={() => onLoad(sim)} className={styles.loadBtn}>
                    <FolderOpenIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton
                    size="small"
                    onClick={() => setDeleteConfirm(sim.id)}
                    className={styles.deleteBtn}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
          Guardar simulación
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Nombre"
            value={simName}
            onChange={(e) => setSimName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={!simName.trim()} onClick={handleSave}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
          Eliminar simulación
        </DialogTitle>
        <DialogContent>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>
            ¿Seguro que quieres eliminar esta simulación? No se puede deshacer.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (deleteConfirm) onDelete(deleteConfirm);
              setDeleteConfirm(null);
            }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
