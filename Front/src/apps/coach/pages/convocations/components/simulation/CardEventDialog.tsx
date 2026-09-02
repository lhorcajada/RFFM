import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import type { SimSlotPlayer } from "./SimulationPlayerSlot";
import styles from "./CardEventDialog.module.css";

export interface CardEventSubmitPayload {
  teamPlayerId: string | null;
  playerName: string | null;
  isRivalPlayer: boolean;
  rivalDorsal: number | null;
  cardType: "yellow" | "red";
}

interface CardEventDialogProps {
  open: boolean;
  /** Own-team players eligible for a card (usually the full squad, not just on-field) */
  players: SimSlotPlayer[];
  onClose: () => void;
  onSubmit: (payload: CardEventSubmitPayload) => void;
}

export default function CardEventDialog({ open, players, onClose, onSubmit }: CardEventDialogProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<SimSlotPlayer | null>(null);
  const [isRival, setIsRival] = useState(false);
  const [rivalDorsal, setRivalDorsal] = useState("");
  const [cardType, setCardType] = useState<"yellow" | "red" | null>(null);

  function reset() {
    setSelectedPlayer(null);
    setIsRival(false);
    setRivalDorsal("");
    setCardType(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSelectPlayer(player: SimSlotPlayer) {
    setSelectedPlayer(player);
    setIsRival(false);
  }

  function handleSelectRival() {
    setSelectedPlayer(null);
    setIsRival(true);
  }

  const canSubmit = cardType !== null && (isRival ? rivalDorsal.trim() !== "" : selectedPlayer !== null);

  function handleSubmit() {
    if (!canSubmit || !cardType) return;
    if (isRival) {
      onSubmit({
        teamPlayerId: null,
        playerName: null,
        isRivalPlayer: true,
        rivalDorsal: Number(rivalDorsal.trim()),
        cardType,
      });
    } else if (selectedPlayer) {
      onSubmit({
        teamPlayerId: selectedPlayer.teamPlayerId,
        playerName: selectedPlayer.displayName,
        isRivalPlayer: false,
        rivalDorsal: null,
        cardType,
      });
    }
    reset();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, minWidth: 280 } }}
    >
      <DialogTitle sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>
        Registrar tarjeta
      </DialogTitle>
      <DialogContent>
        <List dense sx={{ mb: 1 }}>
          {players.map((p) => (
            <ListItemButton
              key={p.teamPlayerId}
              selected={selectedPlayer?.teamPlayerId === p.teamPlayerId}
              onClick={() => handleSelectPlayer(p)}
              sx={{ "&:hover": { bgcolor: "rgba(251,146,60,0.1)" } }}
            >
              {p.dorsal != null && (
                <span style={{ minWidth: 28, fontSize: "0.75rem", color: "#fb923c", fontWeight: 700, marginRight: 8 }}>
                  {p.dorsal}
                </span>
              )}
              <ListItemText
                primary={p.alias?.trim() || p.displayName}
                primaryTypographyProps={{ sx: { color: "#fff", fontSize: "0.85rem" } }}
              />
            </ListItemButton>
          ))}
          <ListItemButton
            selected={isRival}
            onClick={handleSelectRival}
            sx={{ "&:hover": { bgcolor: "rgba(251,146,60,0.1)" } }}
          >
            <ListItemText
              primary="Rival"
              primaryTypographyProps={{ sx: { color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", fontStyle: "italic" } }}
            />
          </ListItemButton>
        </List>

        {isRival && (
          <TextField
            label="Dorsal"
            type="number"
            size="small"
            value={rivalDorsal}
            onChange={(e) => setRivalDorsal(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            InputLabelProps={{ sx: { color: "rgba(255,255,255,0.6)" } }}
            inputProps={{ style: { color: "#fff" } }}
          />
        )}

        <div className={styles.cardTypeLabel}>Tipo de tarjeta</div>
        <ToggleButtonGroup
          exclusive
          value={cardType}
          onChange={(_, value) => setCardType(value)}
          size="small"
        >
          <ToggleButton value="yellow">Amarilla</ToggleButton>
          <ToggleButton value="red">Roja</ToggleButton>
        </ToggleButtonGroup>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={handleClose} color="inherit" size="small">
          Cancelar
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="success" size="small" disabled={!canSubmit}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
