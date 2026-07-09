import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import React from "react";
import type { PlayerForSelection } from "../../../../apps/coach/services/teamService";

interface PlayerIdentityDialogProps {
  open: boolean;
  teamName?: string;
  loading?: boolean;
  playersLoading?: boolean;
  players?: PlayerForSelection[];
  error?: string | null;
  onClose: () => void;
  onAccept: (playerId: string) => void;
}

export default function PlayerIdentityDialog({
  open,
  teamName,
  loading = false,
  playersLoading = false,
  players = [],
  error,
  onClose,
  onAccept,
}: PlayerIdentityDialogProps) {
  const [selectedPlayerId, setSelectedPlayerId] = React.useState("");

  function handleAccept() {
    if (selectedPlayerId) {
      onAccept(selectedPlayerId);
    }
  }

  function handleClose() {
    setSelectedPlayerId("");
    onClose();
  }

  const canSubmit = selectedPlayerId.length > 0 && !loading && !playersLoading;

  const getPlayerDisplayName = (player: PlayerForSelection): string => {
    const fullName = [player.name, player.lastName].filter(Boolean).join(" ");
    return player.alias ? `${fullName} (${player.alias})` : fullName;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="player-identity-dialog"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id="player-identity-dialog">Seleccionar jugador</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {teamName
            ? `Selecciona tu nombre de la lista de jugadores del equipo "${teamName}".`
            : "Selecciona tu nombre de la lista de jugadores del equipo."}
        </Typography>
        {playersLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
            <CircularProgress />
          </div>
        ) : players.length === 0 ? (
          <Typography variant="body2" color="error">
            No hay jugadores disponibles en este equipo.
          </Typography>
        ) : (
          <FormControl fullWidth sx={{ mb: 2 }} disabled={loading || playersLoading}>
            <InputLabel id="player-select-label">Jugador</InputLabel>
            <Select
              labelId="player-select-label"
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              label="Jugador"
              autoFocus
            >
              <MenuItem value="">
                <em>Selecciona un jugador</em>
              </MenuItem>
              {players.map((player) => (
                <MenuItem key={player.id} value={player.id}>
                  {getPlayerDisplayName(player)}
                  {player.dorsal ? ` (#${player.dorsal})` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
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
