import { useState } from "react";
import { Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { format, parseISO } from "date-fns";
import ConfirmDialog from "../../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import {
  deleteSessionEvaluation,
  saveSessionEvaluation,
  type PlayerSessionListItem,
  type SaveSessionEvaluationItem,
} from "../../../../services/playerTrackingService";
import { useSessionEvaluations } from "../../hooks/useSessionEvaluations";
import SessionEvaluationDialog from "./SessionEvaluationDialog";
import SessionEvaluationList from "./SessionEvaluationList";
import styles from "./PlayerTrackingPanel.module.css";

function showSnackbar(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function errorDetail(error: unknown): string | undefined {
  const detail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data?.detail;
  return typeof detail === "string" ? detail : undefined;
}

type DialogState = { open: false } | { open: true; sessionId: string | null };

type Props = {
  teamId: string;
  teamPlayerId: string;
};

/** Seguimiento del jugador: sesiones de la temporada con su asistencia y su valoración. */
export default function PlayerTrackingPanel({ teamId, teamPlayerId }: Props) {
  const { items, loading, error, reload } = useSessionEvaluations(teamId, teamPlayerId);
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlayerSessionListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (sessionId: string, evaluations: SaveSessionEvaluationItem[]) => {
    setSaving(true);
    try {
      await saveSessionEvaluation(teamId, teamPlayerId, sessionId, evaluations);
      showSnackbar("Seguimiento guardado", "success");
      setDialog({ open: false });
      reload();
    } catch (e) {
      showSnackbar(errorDetail(e) ?? "No se pudo guardar el seguimiento", "error");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSessionEvaluation(teamId, teamPlayerId, deleteTarget.sessionId);
      showSnackbar("Seguimiento eliminado", "success");
      setDeleteTarget(null);
      reload();
    } catch (e) {
      showSnackbar(errorDetail(e) ?? "No se pudo eliminar el seguimiento", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.listHeader}>
        <h3 className={styles.title}>Sesiones</h3>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDialog({ open: true, sessionId: null })}>
          Nuevo seguimiento
        </Button>
      </div>

      <SessionEvaluationList
        items={items}
        loading={loading}
        error={error}
        onRetry={reload}
        onCreate={(sessionId) => setDialog({ open: true, sessionId })}
        onEdit={(sessionId) => setDialog({ open: true, sessionId })}
        onDelete={setDeleteTarget}
      />

      {dialog.open && (
        <SessionEvaluationDialog
          open
          teamId={teamId}
          teamPlayerId={teamPlayerId}
          sessions={items}
          initialSessionId={dialog.sessionId}
          saving={saving}
          onClose={() => setDialog({ open: false })}
          onSubmit={handleSubmit}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar seguimiento"
        description={
          deleteTarget
            ? `¿Eliminar el seguimiento de la sesión «${deleteTarget.name}» del ${format(parseISO(deleteTarget.date), "dd/MM/yyyy")}? Esta acción no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        processing={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
