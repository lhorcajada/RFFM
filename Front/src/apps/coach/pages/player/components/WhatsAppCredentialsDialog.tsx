import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { buildWhatsAppMessage, type FamilyMemberCredentials } from "../utils/familyMemberCredentials";

type Props = {
  open: boolean;
  credentials: FamilyMemberCredentials;
  onClose: () => void;
};

export default function WhatsAppCredentialsDialog({ open, credentials, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const message = buildWhatsAppMessage(credentials);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the message stays visible in the dialog for manual copy.
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cuenta creada</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
          <Typography variant="body2">
            <strong>Usuario:</strong> {credentials.alias}
          </Typography>
          <Typography variant="body2">
            <strong>Contraseña:</strong> {credentials.password}
          </Typography>
          <TextField
            label="Mensaje de WhatsApp"
            multiline
            minRows={6}
            fullWidth
            value={message}
            InputProps={{ readOnly: true }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleCopy}
          startIcon={<ContentCopyIcon fontSize="small" />}
          color={copied ? "success" : "primary"}
        >
          {copied ? "Copiado" : "Copiar mensaje"}
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
