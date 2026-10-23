import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ShareIcon from "@mui/icons-material/Share";
import styles from "./PendingSanctionsWhatsAppDialog.module.css";

type Props = {
  open: boolean;
  message: string;
  onClose: () => void;
};

export default function PendingSanctionsWhatsAppDialog({ open, message, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the message stays visible in the dialog for manual copy.
    }
  }

  async function handleShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: message });
      } catch {
        // The user dismissed the native share sheet.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Sanciones pendientes</DialogTitle>
      <DialogContent>
        <TextField
          label="Mensaje para WhatsApp"
          multiline
          minRows={8}
          fullWidth
          value={message}
          InputProps={{ readOnly: true }}
          className={styles.message}
        />
      </DialogContent>
      <DialogActions className={styles.actions}>
        <Button
          onClick={handleCopy}
          startIcon={<ContentCopyIcon fontSize="small" />}
          color={copied ? "success" : "primary"}
        >
          {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button onClick={handleShare} startIcon={<ShareIcon fontSize="small" />} variant="contained" color="success">
          Compartir
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
