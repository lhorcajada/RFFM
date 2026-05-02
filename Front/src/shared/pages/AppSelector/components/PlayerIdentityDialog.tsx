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

interface PlayerIdentityDialogProps {
  open: boolean;
  teamName?: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onAccept: (name: string, lastName: string, birthDate: string) => void;
}

export default function PlayerIdentityDialog({
  open,
  teamName,
  loading = false,
  error,
  onClose,
  onAccept,
}: PlayerIdentityDialogProps) {
  const [name, setName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");

  function handleAccept() {
    onAccept(name.trim(), lastName.trim(), birthDate);
  }

  function handleClose() {
    setName("");
    setLastName("");
    setBirthDate("");
    onClose();
  }

  const canSubmit = name.trim().length > 0 && lastName.trim().length > 0 && birthDate.length > 0 && !loading;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="player-identity-dialog"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id="player-identity-dialog">Verificar identidad</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {teamName
            ? `Para unirte al equipo "${teamName}", confirma tus datos tal como están registrados en la plantilla.`
            : "Confirma tus datos tal como están registrados en la plantilla del equipo."}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          sx={{ mb: 2 }}
          inputProps={{ "aria-label": "Nombre" }}
        />
        <TextField
          fullWidth
          label="Apellidos"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={loading}
          sx={{ mb: 2 }}
          inputProps={{ "aria-label": "Apellidos" }}
        />
        <TextField
          fullWidth
          label="Fecha de nacimiento"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          disabled={loading}
          InputLabelProps={{ shrink: true }}
          inputProps={{ "aria-label": "Fecha de nacimiento", max: new Date().toISOString().split("T")[0] }}
        />
        {error && (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="outlined" color="primary" disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleAccept}
          disabled={!canSubmit}
          variant="contained"
          color="primary"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? "Verificando..." : "Acceder"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
