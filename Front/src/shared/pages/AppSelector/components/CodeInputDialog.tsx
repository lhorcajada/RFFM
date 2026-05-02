import {
  Button,
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
  onClose: () => void;
  onAccept: (code: string) => void;
}

export default function CodeInputDialog({
  open,
  title,
  description,
  label,
  onClose,
  onAccept,
}: CodeInputDialogProps) {
  const [code, setCode] = React.useState("");

  function handleAccept() {
    onAccept(code.trim());
    setCode("");
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
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim()) handleAccept();
          }}
          inputProps={{ "aria-label": label }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="outlined" color="primary" aria-label="Cancelar">
          Cancelar
        </Button>
        <Button
          onClick={handleAccept}
          disabled={!code.trim()}
          variant="contained"
          color="primary"
          aria-label="Acceder"
        >
          Acceder
        </Button>
      </DialogActions>
    </Dialog>
  );
}
