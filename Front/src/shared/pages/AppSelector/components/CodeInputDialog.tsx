import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";

interface CodeInputDialogProps {
  open: boolean;
  title: string;
  description: string;
  label: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onAccept: (code: string) => void;
}

export default function CodeInputDialog({
  open,
  title,
  description,
  label,
  loading = false,
  error,
  onClose,
  onAccept,
}: CodeInputDialogProps) {
  const [code, setCode] = React.useState("");

  function handleAccept() {
    onAccept(code.trim());
  }

  function handleClose() {
    setCode("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} aria-labelledby="code-input-dialog" fullWidth maxWidth="xs">
      <DialogTitle id="code-input-dialog">{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label={label}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim() && !loading) handleAccept();
          }}
          inputProps={{ "aria-label": label }}
          error={!!error}
          disabled={loading}
        />
        {error && (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="outlined" color="primary" aria-label="Cancelar" disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleAccept}
          disabled={!code.trim() || loading}
          variant="contained"
          color="primary"
          aria-label="Acceder"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? "Verificando..." : "Acceder"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
