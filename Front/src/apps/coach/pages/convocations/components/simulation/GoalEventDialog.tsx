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
import PitchZoneGrid from "./PitchZoneGrid";
import styles from "./GoalEventDialog.module.css";

export interface GoalEventSubmitPayload {
  scorerId: string | null;
  scorerName: string | null;
  scorerDorsal: number | null;
  isOwnTeam: boolean;
  pitchZone: { col: number; row: number } | null;
  bodyPart: "head" | "foot" | null;
}

interface GoalEventDialogProps {
  open: boolean;
  players: SimSlotPlayer[];
  /** Which side this dialog is registering a goal for; drives "own goal" vs rival-scorer copy */
  isOwnTeam: boolean;
  onClose: () => void;
  onSubmit: (payload: GoalEventSubmitPayload) => void;
  /** Pre-filled values when editing an existing goal; omitted when adding a new one */
  initialValue?: GoalEventSubmitPayload;
}

export default function GoalEventDialog({
  open,
  players,
  isOwnTeam,
  onClose,
  onSubmit,
  initialValue,
}: GoalEventDialogProps) {
  const [selectedScorer, setSelectedScorer] = useState<SimSlotPlayer | null>(null);
  const [rivalDorsal, setRivalDorsal] = useState("");
  const [pitchZone, setPitchZone] = useState<{ col: number; row: number } | null>(null);
  const [bodyPart, setBodyPart] = useState<"head" | "foot" | null>(null);

  // Reset or pre-fill state when dialog opens with initialValue
  useEffect(() => {
    if (!open) return;

    if (initialValue) {
      // Edit mode: pre-fill from initialValue
      if (initialValue.scorerId) {
        const scorer = players.find((p) => p.teamPlayerId === initialValue.scorerId);
        if (scorer) setSelectedScorer(scorer);
      }
      setRivalDorsal(initialValue.scorerDorsal?.toString() ?? "");
      setPitchZone(initialValue.pitchZone);
      setBodyPart(initialValue.bodyPart);
    } else {
      // Add mode: reset
      setSelectedScorer(null);
      setRivalDorsal("");
      setPitchZone(null);
      setBodyPart(null);
    }
  }, [open, initialValue, players]);

  function handleClose() {
    onClose();
  }

  function handleSelectScorer(player: SimSlotPlayer | "own") {
    if (player === "own") {
      handleClose();
      // Own goal (counts for visitor)
      onSubmit({
        scorerId: null,
        scorerName: "Gol en propia puerta",
        scorerDorsal: null,
        isOwnTeam: false,
        pitchZone: null,
        bodyPart: null,
      });
      return;
    }
    setSelectedScorer(player);
  }

  function handleConfirm() {
    if (isOwnTeam) {
      if (!selectedScorer) return;
      onSubmit({
        scorerId: selectedScorer.teamPlayerId,
        scorerName: selectedScorer.displayName,
        scorerDorsal: selectedScorer.dorsal ?? null,
        isOwnTeam: true,
        pitchZone,
        bodyPart,
      });
    } else {
      const parsedDorsal = rivalDorsal.trim() ? Number(rivalDorsal.trim()) : null;
      onSubmit({
        scorerId: null,
        scorerName: null,
        scorerDorsal: Number.isFinite(parsedDorsal) ? parsedDorsal : null,
        isOwnTeam: false,
        pitchZone,
        bodyPart,
      });
    }
  }

  // Details step: shown once a scorer is chosen (own team) or immediately (rival)
  const showDetailsStep = isOwnTeam ? selectedScorer !== null : true;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, minWidth: 280 } }}
    >
      <DialogTitle sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>
        {isOwnTeam ? "¿Quién marcó el gol?" : "Gol del rival"}
      </DialogTitle>
      <DialogContent sx={{ p: showDetailsStep ? 2 : 0 }}>
        {isOwnTeam && !showDetailsStep && (
          <List dense>
            {players.map((p) => (
              <ListItemButton
                key={p.teamPlayerId}
                onClick={() => handleSelectScorer(p)}
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
              onClick={() => handleSelectScorer("own")}
              sx={{ "&:hover": { bgcolor: "rgba(251,146,60,0.1)" } }}
            >
              <ListItemText
                primary="Gol en propia puerta"
                primaryTypographyProps={{ sx: { color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", fontStyle: "italic" } }}
              />
            </ListItemButton>
          </List>
        )}

        {showDetailsStep && (
          <div className={styles.goalDetailsForm}>
            {!isOwnTeam && (
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

            <div className={styles.zoneLabel}>Zona del campo</div>
            <PitchZoneGrid value={pitchZone} onChange={setPitchZone} />

            <div className={styles.zoneLabel}>Parte del cuerpo</div>
            <ToggleButtonGroup
              exclusive
              value={bodyPart}
              onChange={(_, value) => setBodyPart(value)}
              size="small"
              sx={{ mt: 1 }}
            >
              <ToggleButton value="head">Cabeza</ToggleButton>
              <ToggleButton value="foot">Pie</ToggleButton>
            </ToggleButtonGroup>
          </div>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={handleClose} color="inherit" size="small">
          Cancelar
        </Button>
        {showDetailsStep && (
          <Button onClick={handleConfirm} variant="contained" color="success" size="small">
            Confirmar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
