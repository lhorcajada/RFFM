import { useState } from "react";
import { Card, IconButton, Tooltip, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import PlayerDocumentStatusChip from "../../../../../shared/components/ui/PlayerDocumentStatusChip/PlayerDocumentStatusChip";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import TeamPlayerDocumentUploadDialog from "./TeamPlayerDocumentUploadDialog";
import TeamPlayerDocumentReviewDialog from "./TeamPlayerDocumentReviewDialog";
import {
  deletePlayerDocument,
  mapPlayerDocumentError,
  type TeamPlayerDocumentStatusResponse,
} from "../../../services/playerDocumentService";
import styles from "./TeamPlayerDocumentCard.module.css";

type Props = {
  row: TeamPlayerDocumentStatusResponse;
  documentTypeId: string;
  teamId: string;
  onChanged: () => void;
};

export default function TeamPlayerDocumentCard({
  row,
  documentTypeId,
  teamId,
  onChanged,
}: Props) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject">("approve");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasFile = row.status !== "Pending";
  const isDelivered = row.status === "Delivered";

  function handleApprove() {
    setReviewMode("approve");
    setReviewDialogOpen(true);
  }

  function handleReject() {
    setReviewMode("reject");
    setReviewDialogOpen(true);
  }

  async function handleDeleteConfirmed() {
    setDeleting(true);
    try {
      await deletePlayerDocument(row.teamPlayerId, documentTypeId);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "Documento eliminado", severity: "success" },
        })
      );
      setDeleteDialogOpen(false);
      onChanged();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const error = mapPlayerDocumentError(code);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: error.message, severity: error.severity },
        })
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card className={styles.card}>
        <div className={styles.header}>
          <div>
            <Typography variant="h6">{row.playerName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.dorsal ?? "—"}
            </Typography>
          </div>
          <PlayerDocumentStatusChip status={row.status} />
        </div>

        <div className={styles.actions}>
          <Tooltip title={hasFile ? "Actualizar documento" : "Subir en nombre del jugador"}>
            <IconButton
              size="small"
              color="primary"
              onClick={() => setUploadDialogOpen(true)}
              aria-label={hasFile ? "Actualizar documento" : "Subir en nombre del jugador"}
            >
              {hasFile ? <EditIcon fontSize="small" /> : <UploadFileIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {isDelivered && (
            <>
              <Tooltip title="Aprobar">
                <IconButton
                  size="small"
                  color="success"
                  onClick={handleApprove}
                  aria-label="Aprobar"
                >
                  <CheckCircleOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Rechazar">
                <IconButton
                  size="small"
                  color="error"
                  onClick={handleReject}
                  aria-label="Rechazar"
                >
                  <CancelOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          {hasFile && (
            <Tooltip title="Eliminar documento">
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteDialogOpen(true)}
                aria-label="Eliminar documento"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </Card>

      <TeamPlayerDocumentUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        teamPlayerId={row.teamPlayerId}
        documentTypeId={documentTypeId}
        onUploaded={() => {
          setUploadDialogOpen(false);
          onChanged();
        }}
      />

      <TeamPlayerDocumentReviewDialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        row={row}
        documentTypeId={documentTypeId}
        teamId={teamId}
        onChanged={() => {
          setReviewDialogOpen(false);
          onChanged();
        }}
        mode={reviewMode}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Eliminar documento"
        description="¿Seguro que quieres eliminar este documento? El jugador tendrá que volver a subirlo."
        confirmText="Eliminar"
        processing={deleting}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirmed}
      />
    </>
  );
}
