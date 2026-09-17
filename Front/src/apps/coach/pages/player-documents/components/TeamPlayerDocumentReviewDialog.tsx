import { useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  reviewPlayerDocument,
  mapPlayerDocumentError,
} from "../../../services/playerDocumentService";
import type { TeamPlayerDocumentStatusResponse } from "../../../services/playerDocumentService";
import styles from "./TeamPlayerDocumentReviewDialog.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  row: TeamPlayerDocumentStatusResponse | null;
  documentTypeId: string;
  teamId: string;
  onChanged: () => void;
  mode: "approve" | "reject";
};

function notify(message: string, severity: "success" | "error" | "warning") {
  window.dispatchEvent(
    new CustomEvent("rffm.show_snackbar", { detail: { message, severity } })
  );
}

export default function TeamPlayerDocumentReviewDialog({
  open,
  onClose,
  row,
  documentTypeId,
  teamId,
  onChanged,
  mode,
}: Props) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const isApprove = mode === "approve";
  const dialogTitle = isApprove ? "Aprobar documento" : "Rechazar documento";

  async function handleConfirm() {
    if (!row) return;

    setLoading(true);
    try {
      await reviewPlayerDocument(
        row.teamPlayerId,
        documentTypeId,
        isApprove,
        isApprove ? null : note || null
      );
      notify(
        isApprove ? "Documento aprobado" : "Documento rechazado",
        "success"
      );
      setNote("");
      onChanged();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const error = mapPlayerDocumentError(code);
      notify(error.message, error.severity);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setNote("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 2 }}>
          <div>
            <Typography variant="subtitle2" color="text.secondary">
              Jugador
            </Typography>
            <Typography>{row?.playerName}</Typography>
          </div>

          {!isApprove && (
            <TextField
              label="Nota (opcional)"
              multiline
              rows={3}
              fullWidth
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
              placeholder="Explica por qué rechazas el documento..."
            />
          )}

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="text"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={loading}
              color={isApprove ? "success" : "error"}
              startIcon={loading ? <CircularProgress size={16} /> : undefined}
            >
              {loading ? "Procesando..." : "Confirmar"}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
