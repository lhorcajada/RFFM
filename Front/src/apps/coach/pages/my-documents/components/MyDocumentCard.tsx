import { useState } from "react";
import { Card, IconButton, Tooltip, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import { fetchPublicStorageFile } from "../../../../../shared/services/imageService";
import PlayerDocumentStatusChip from "../../../../../shared/components/ui/PlayerDocumentStatusChip/PlayerDocumentStatusChip";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import {
  deletePlayerDocument,
  mapPlayerDocumentError,
  type PlayerDocumentResponse,
} from "../../../services/playerDocumentService";
import MyDocumentUploadDialog from "./MyDocumentUploadDialog";
import styles from "./MyDocumentCard.module.css";

type Props = {
  document: PlayerDocumentResponse;
  teamPlayerId: string;
  onUploaded: () => void;
};

export default function MyDocumentCard({ document, teamPlayerId, onUploaded }: Props) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasFile = Boolean(document.url);
  const showReuploadNotice = (document.status === "Approved" || document.status === "Rejected") && uploadDialogOpen;

  async function handleDownload() {
    if (!document.url) return;
    setDownloading(true);
    try {
      const objectUrl = await fetchPublicStorageFile(document.url);
      if (!objectUrl) return;

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = document.fileName || "documento";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDeleteConfirmed() {
    setDeleting(true);
    try {
      await deletePlayerDocument(teamPlayerId, document.documentTypeId);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "Documento eliminado", severity: "success" },
        })
      );
      setDeleteDialogOpen(false);
      onUploaded();
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
          <div className={styles.titleSection}>
            <Typography variant="h6" className={styles.title}>
              {document.documentTypeName}
            </Typography>
            <PlayerDocumentStatusChip status={document.status} />
          </div>
        </div>

        {showReuploadNotice && (
          <div className={styles.notice}>
            <Typography variant="caption" color="info.main">
              Al subir un nuevo archivo, el documento volverá a estado 'Entregado' y deberá revisarse de nuevo.
            </Typography>
          </div>
        )}

        <div className={styles.actions}>
          <Tooltip title={hasFile ? "Actualizar documento" : "Subir documento"}>
            <IconButton
              size="small"
              color="primary"
              onClick={() => setUploadDialogOpen(true)}
              aria-label={hasFile ? "Actualizar documento" : "Subir documento"}
            >
              {hasFile ? <EditIcon fontSize="small" /> : <UploadFileIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {hasFile && (
            <>
              <Tooltip title="Descargar documento">
                <IconButton
                  size="small"
                  onClick={handleDownload}
                  disabled={downloading}
                  aria-label="Descargar documento"
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>

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
            </>
          )}
        </div>
      </Card>

      <MyDocumentUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        teamPlayerId={teamPlayerId}
        documentTypeId={document.documentTypeId}
        onUploaded={() => {
          setUploadDialogOpen(false);
          onUploaded();
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Eliminar documento"
        description="¿Seguro que quieres eliminar este documento? Tendrás que volver a subirlo."
        confirmText="Eliminar"
        processing={deleting}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirmed}
      />
    </>
  );
}
