import { useEffect, useRef, useState } from "react";
import { Button, CircularProgress, Stack, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import { fetchPublicStorageFile } from "../../../../../shared/services/imageService";
import {
  getInjuryProtocol,
  uploadInjuryProtocolAttachment,
  deleteInjuryProtocolAttachment,
} from "../../../services/injuryProtocolService";
import type { InjuryProtocolAttachment } from "../../../services/injuryProtocolService";
import styles from "./InjuryProtocolDocuments.module.css";

type Props = {
  teamId: string;
  isCoach: boolean;
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function formatUploadDate(value: string): string {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function notify(message: string, severity: "success" | "error") {
  window.dispatchEvent(
    new CustomEvent("rffm.show_snackbar", { detail: { message, severity } })
  );
}

export default function InjuryProtocolDocuments({ teamId, isCoach }: Props) {
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<InjuryProtocolAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InjuryProtocolAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function loadAttachments() {
    setLoading(true);
    return getInjuryProtocol(teamId)
      .then((res) => setAttachments(res?.attachments ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    if (file.type !== "application/pdf") {
      setUploadError("Solo se admiten ficheros PDF");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError("El fichero no puede superar los 10 MB");
      return;
    }

    setUploading(true);
    try {
      await uploadInjuryProtocolAttachment(teamId, file);
      await loadAttachments();
      notify("Documento subido correctamente", "success");
    } catch {
      notify("No se ha podido subir el documento", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(att: InjuryProtocolAttachment) {
    setDownloadingId(att.id);
    try {
      const objectUrl = await fetchPublicStorageFile(att.url);
      if (!objectUrl) {
        notify("No se ha podido descargar el documento", "error");
        return;
      }
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = att.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteInjuryProtocolAttachment(teamId, deleteTarget.id);
      await loadAttachments();
      notify("Documento eliminado", "success");
    } catch {
      notify("No se ha podido eliminar el documento", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      {isCoach && (
        <div className={styles.uploadZone}>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileSelected}
          />
          <div className={styles.uploadText}>
            <Typography className={styles.uploadTitle}>Añadir documento</Typography>
            <Typography className={styles.uploadHint}>Solo PDF · máximo 10 MB</Typography>
            {uploadError && (
              <Typography variant="caption" color="error">
                {uploadError}
              </Typography>
            )}
          </div>
          <Button
            startIcon={
              uploading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />
            }
            onClick={() => fileInputRef.current?.click()}
            variant="contained"
            disabled={uploading}
            className={styles.uploadButton}
          >
            Subir documento
          </Button>
        </div>
      )}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={32} />
        </Stack>
      ) : attachments.length === 0 ? (
        <EmptyState
          title="No hay documentos"
          description="Todavía no se ha subido ningún documento para este protocolo."
        />
      ) : (
        <div className={styles.cardsGrid}>
          {attachments.map((att) => (
            <div key={att.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.pdfBadge}>PDF</div>
                <div className={styles.fileInfo}>
                  <Typography className={styles.fileName}>{att.fileName}</Typography>
                  <Typography className={styles.fileDate}>
                    {`Subido el ${formatUploadDate(att.uploadedAt)}`}
                  </Typography>
                </div>
              </div>
              <div className={styles.actions}>
                <Button
                  variant="contained"
                  onClick={() => handleDownload(att)}
                  aria-label={`Descargar ${att.fileName}`}
                  disabled={downloadingId === att.id}
                  className={styles.downloadButton}
                  startIcon={
                    downloadingId === att.id ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : undefined
                  }
                >
                  Descargar
                </Button>
                {isCoach && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => setDeleteTarget(att)}
                    aria-label="Eliminar"
                    className={styles.deleteButton}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar documento"
        description={`¿Seguro que quieres eliminar "${deleteTarget?.fileName ?? ""}"?`}
        confirmText="Eliminar"
        processing={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
