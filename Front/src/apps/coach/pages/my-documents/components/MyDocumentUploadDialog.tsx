import { useRef, useState } from "react";
import { Button, CircularProgress, Dialog, DialogContent, DialogTitle, Stack } from "@mui/material";
import {
  uploadPlayerDocument,
  mapPlayerDocumentError,
} from "../../../services/playerDocumentService";

type Props = {
  open: boolean;
  onClose: () => void;
  teamPlayerId: string;
  documentTypeId: string;
  onUploaded: () => void;
};

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function notify(message: string, severity: "success" | "error" | "warning") {
  window.dispatchEvent(
    new CustomEvent("rffm.show_snackbar", { detail: { message, severity } })
  );
}

export default function MyDocumentUploadDialog({
  open,
  onClose,
  teamPlayerId,
  documentTypeId,
  onUploaded,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      const error = mapPlayerDocumentError("PlayerDocumentInvalidFile");
      notify(error.message, error.severity);
      return;
    }

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      const error = mapPlayerDocumentError("PlayerDocumentFileTooLarge");
      notify(error.message, error.severity);
      return;
    }

    setUploading(true);
    try {
      await uploadPlayerDocument(teamPlayerId, documentTypeId, file);
      notify("Documento subido correctamente", "success");
      onUploaded();
      onClose();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const error = mapPlayerDocumentError(code);
      notify(error.message, error.severity);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Subir documento</DialogTitle>
      <DialogContent>
        <Stack sx={{ pt: 2 }} spacing={2}>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileSelected}
            accept=".pdf,.jpg,.jpeg,.png"
          />
          <Button
            variant="contained"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={16} /> : undefined}
          >
            {uploading ? "Subiendo..." : "Seleccionar archivo"}
          </Button>
          <Button variant="text" onClick={onClose} disabled={uploading}>
            Cancelar
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
