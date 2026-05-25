import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, CircularProgress } from "@mui/material";

type Props = {
  open: boolean;
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  processing?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({ open, title, description, confirmText = "Confirmar", cancelText = "Cancelar", processing = false, onCancel, onConfirm }: Props) {
  React.useEffect(() => {
    if (!open) return;
    try {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && typeof ae.blur === "function") ae.blur();
    } catch {
      // ignore
    }
  }, [open]);
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      {title && <DialogTitle>{title}</DialogTitle>}
      <DialogContent>
        {description && (
          typeof description === "string" ? (
            <DialogContentText>{description}</DialogContentText>
          ) : (
            description
          )
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit" size="small" disabled={processing}>{cancelText}</Button>
        <Button autoFocus onClick={onConfirm} variant="contained" color="primary" size="small" disabled={processing} startIcon={processing ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
