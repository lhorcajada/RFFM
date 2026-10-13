import { useState, useEffect } from "react";
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
  /** Match minute of the card; only reported when the dialog lets the coach edit it */
  minute?: number;
}

const MAX_MINUTE = 200;

interface CardEventDialogProps {
  open: boolean;
  /** Own-team players eligible for a card (usually the full squad, not just on-field) */
  players: SimSlotPlayer[];
  onClose: () => void;
  onSubmit: (payload: CardEventSubmitPayload) => void;
  /** Pre-filled values when editing an existing card; omitted when adding a new one */
  initialValue?: CardEventSubmitPayload;
  /** Restricts the dialog to own-team players or to a rival dorsal; omitted offers both */
  side?: "own" | "rival";
  /** Shows a minute field so the coach can set when the card was shown (manual edit of a finished match) */
  editableMinute?: boolean;
}

export default function CardEventDialog({
  open,
  players,
  onClose,
  onSubmit,
  initialValue,
  side,
  editableMinute = false,
}: CardEventDialogProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<SimSlotPlayer | null>(null);
  const [isRival, setIsRival] = useState(false);
  const [rivalDorsal, setRivalDorsal] = useState("");
  const [cardType, setCardType] = useState<"yellow" | "red" | null>(null);
  const [minute, setMinute] = useState("0");

  // Reset or pre-fill state when dialog opens with initialValue
  useEffect(() => {
    if (!open) return;

    if (initialValue) {
      // Edit mode: pre-fill from initialValue
      if (initialValue.isRivalPlayer) {
        setSelectedPlayer(null);
        setIsRival(true);
        setRivalDorsal(initialValue.rivalDorsal?.toString() ?? "");
      } else if (initialValue.teamPlayerId) {
        const player = players.find((p) => p.teamPlayerId === initialValue.teamPlayerId);
        if (player) setSelectedPlayer(player);
        setIsRival(false);
        setRivalDorsal("");
      }
      setCardType(initialValue.cardType);
      setMinute(String(initialValue.minute ?? 0));
    } else {
      // Add mode: reset
      setSelectedPlayer(null);
      setIsRival(side === "rival");
      setRivalDorsal("");
      setCardType(null);
      setMinute("0");
    }
  }, [open, initialValue, players, side]);

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

  const parsedMinute = Number(minute);
  const minuteIsValid =
    !editableMinute ||
    (minute.trim() !== "" && Number.isInteger(parsedMinute) && parsedMinute >= 0 && parsedMinute <= MAX_MINUTE);
  const canSubmit =
    cardType !== null && minuteIsValid && (isRival ? rivalDorsal.trim() !== "" : selectedPlayer !== null);

  function handleSubmit() {
    if (!canSubmit || !cardType) return;
    const minutePayload = editableMinute ? { minute: parsedMinute } : {};
    if (isRival) {
      onSubmit({
        teamPlayerId: null,
        playerName: null,
        isRivalPlayer: true,
        rivalDorsal: Number(rivalDorsal.trim()),
        cardType,
        ...minutePayload,
      });
    } else if (selectedPlayer) {
      onSubmit({
        teamPlayerId: selectedPlayer.teamPlayerId,
        playerName: selectedPlayer.displayName,
        isRivalPlayer: false,
        rivalDorsal: null,
        cardType,
        ...minutePayload,
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
          {side !== "rival" && players.map((p) => (
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
          {side === undefined && (
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
          )}
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

        {editableMinute && (
          <TextField
            label="Minuto"
            type="number"
            size="small"
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            InputLabelProps={{ sx: { color: "rgba(255,255,255,0.6)" } }}
            inputProps={{ min: 0, max: MAX_MINUTE, step: 1, style: { color: "#fff" } }}
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
