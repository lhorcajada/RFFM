import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import styles from "./MinutesReasonsListDialog.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlayerMinutesReason = {
  id: string;
  /** Player display name/alias, used for row labels and accessible names. */
  label: string;
  /** Current reason text, null when there is none. */
  reason: string | null;
};

type Props = {
  open: boolean;
  players: PlayerMinutesReason[];
  onClose: () => void;
  /** Persists the reason (or clears it when `null` is passed) for a single player. Each row
   *  saves independently — never required to close the dialog or save the lineup/match. */
  onSave: (playerId: string, reason: string | null) => Promise<void>;
};

const MAX_LENGTH = 500;

// ─── Component ────────────────────────────────────────────────────────────────

/** Single dialog listing every player's minutes reason, editable inline row by row.
 *  Closing the dialog (X, backdrop, Escape, "Cerrar") never depends on any save. */
export default function MinutesReasonsListDialog({ open, players, onClose, onSave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setEditingId(null);
    setEditingText("");
    setSavingId(null);
    setErrorId(null);
  }, [open]);

  const startEditing = (player: PlayerMinutesReason) => {
    setEditingId(player.id);
    setEditingText(player.reason ?? "");
    setErrorId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingText("");
    setErrorId(null);
  };

  const persist = async (playerId: string, reason: string | null) => {
    if (savingId) return;
    setSavingId(playerId);
    setErrorId(null);
    try {
      await onSave(playerId, reason);
      cancelEditing();
    } catch {
      setErrorId(playerId);
    } finally {
      setSavingId(null);
    }
  };

  const handleSave = (playerId: string) => {
    const trimmed = editingText.trim();
    void persist(playerId, trimmed.length > 0 ? trimmed : null);
  };

  const handleClear = (playerId: string) => {
    void persist(playerId, null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className={styles.title}>
        Motivos de minutos
        <IconButton aria-label="Cerrar" size="small" onClick={onClose} className={styles.closeIconBtn}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {players.length === 0 ? (
          <span className={styles.emptyText}>No hay jugadores disponibles.</span>
        ) : (
          <ul className={styles.list}>
            {players.map((player) => {
              const hasReason = Boolean(player.reason && player.reason.trim().length > 0);
              const isEditing = editingId === player.id;
              const isSaving = savingId === player.id;

              return (
                <li key={player.id} className={styles.row}>
                  {isEditing ? (
                    <div className={styles.editRow}>
                      <span className={styles.editRowLabel}>{player.label}</span>
                      <TextField
                        autoFocus
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={5}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value.slice(0, MAX_LENGTH))}
                        disabled={isSaving}
                        helperText={`${editingText.length}/${MAX_LENGTH}`}
                        inputProps={{
                          maxLength: MAX_LENGTH,
                          "aria-label": `Motivo de ${player.label}`,
                        }}
                      />
                      {errorId === player.id && (
                        <span className={styles.error}>
                          Error al guardar el motivo. Inténtalo de nuevo.
                        </span>
                      )}
                      <div className={styles.editRowActions}>
                        {hasReason && (
                          <Button
                            color="error"
                            size="small"
                            onClick={() => handleClear(player.id)}
                            disabled={isSaving}
                          >
                            Borrar motivo
                          </Button>
                        )}
                        <Button size="small" onClick={cancelEditing} disabled={isSaving}>
                          Cancelar
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleSave(player.id)}
                          disabled={isSaving}
                        >
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className={styles.rowLabel}>{player.label}</span>
                      <span className={styles.rowReason}>
                        {hasReason ? player.reason : "Sin motivo"}
                      </span>
                      <IconButton
                        size="small"
                        aria-label={`Editar motivo de ${player.label}`}
                        onClick={() => startEditing(player)}
                        className={styles.editIconBtn}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
