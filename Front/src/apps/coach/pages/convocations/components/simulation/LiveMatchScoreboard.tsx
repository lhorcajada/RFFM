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
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import StyleIcon from "@mui/icons-material/Style";
import type { LiveMatchPhase } from "./liveMatch.types";
import type { SimSlotPlayer } from "./SimulationPlayerSlot";
import PitchZoneGrid from "./PitchZoneGrid";
import CardEventDialog, { type CardEventSubmitPayload } from "./CardEventDialog";
import styles from "./LiveMatchScoreboard.module.css";

interface LiveMatchScoreboardProps {
  localTeamName: string;
  localTeamShield?: string | null;
  visitorTeamName: string;
  visitorTeamShield?: string | null;
  scoreLocal: number;
  scoreVisitor: number;
  matchPhase: LiveMatchPhase;
  /** Players currently on the field (for scorer selection) */
  fieldPlayers: SimSlotPlayer[];
  /** true if the user's team is the local/home team; defaults to true */
  isHomeTeam?: boolean;
  onAddGoal: (
    scorerId: string | null,
    scorerName: string | null,
    scorerDorsal: number | null,
    isOwnTeam: boolean,
    pitchZone: { col: number; row: number } | null,
    bodyPart: "head" | "foot" | null,
  ) => void;
  /** Optional — enables the "Tarjeta" button when provided */
  onAddCard?: (
    teamPlayerId: string | null,
    playerName: string | null,
    isRivalPlayer: boolean,
    rivalDorsal: number | null,
    cardType: "yellow" | "red",
  ) => void;
}

export default function LiveMatchScoreboard({
  localTeamName,
  localTeamShield,
  visitorTeamName,
  visitorTeamShield,
  scoreLocal,
  scoreVisitor,
  matchPhase,
  fieldPlayers,
  isHomeTeam = true,
  onAddGoal,
  onAddCard,
}: LiveMatchScoreboardProps) {
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingIsOwn, setPendingIsOwn] = useState(false);
  const [selectedScorer, setSelectedScorer] = useState<SimSlotPlayer | null>(null);
  const [rivalDorsal, setRivalDorsal] = useState("");
  const [pitchZone, setPitchZone] = useState<{ col: number; row: number } | null>(null);
  const [bodyPart, setBodyPart] = useState<"head" | "foot" | null>(null);

  const canScore =
    matchPhase === "firstHalf" ||
    matchPhase === "halftime" ||
    matchPhase === "secondHalf";

  function resetDialogState() {
    setSelectedScorer(null);
    setRivalDorsal("");
    setPitchZone(null);
    setBodyPart(null);
  }

  function openGoalDialog(isOwnTeam: boolean) {
    setPendingIsOwn(isOwnTeam);
    resetDialogState();
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    resetDialogState();
  }

  function handleSelectScorer(player: SimSlotPlayer | "own") {
    if (player === "own") {
      setDialogOpen(false);
      resetDialogState();
      // Own goal (counts for visitor)
      onAddGoal(null, "Gol en propia puerta", null, false, null, null);
      return;
    }
    setSelectedScorer(player);
  }

  function handleConfirm() {
    setDialogOpen(false);
    if (pendingIsOwn) {
      if (!selectedScorer) return;
      onAddGoal(
        selectedScorer.teamPlayerId,
        selectedScorer.displayName,
        selectedScorer.dorsal ?? null,
        true,
        pitchZone,
        bodyPart,
      );
    } else {
      const parsedDorsal = rivalDorsal.trim() ? Number(rivalDorsal.trim()) : null;
      onAddGoal(null, null, Number.isFinite(parsedDorsal) ? parsedDorsal : null, false, pitchZone, bodyPart);
    }
    resetDialogState();
  }

  // Details step: shown once a scorer is chosen (own team) or immediately (rival)
  const showDetailsStep = pendingIsOwn ? selectedScorer !== null : true;

  function handleCardSubmit(payload: CardEventSubmitPayload) {
    setCardDialogOpen(false);
    onAddCard?.(
      payload.teamPlayerId,
      payload.playerName,
      payload.isRivalPlayer,
      payload.rivalDorsal,
      payload.cardType,
    );
  }

  return (
    <div className={styles.root}>
      {canScore && onAddCard && (
        <Button
          size="small"
          variant="outlined"
          color="warning"
          className={styles.cardBtn}
          startIcon={<StyleIcon sx={{ fontSize: 14 }} />}
          onClick={() => setCardDialogOpen(true)}
        >
          Tarjeta
        </Button>
      )}
      {/* Local team */}
      <div className={styles.team}>
        {localTeamShield && (
          <img
            src={localTeamShield}
            alt=""
            className={styles.shield}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <span className={styles.teamName}>{localTeamName}</span>
        {canScore && (
          <Button
            size="small"
            variant="outlined"
            color={isHomeTeam ? "success" : "error"}
            className={styles.goalBtn}
            startIcon={<SportsSoccerIcon sx={{ fontSize: 14 }} />}
            onClick={() => openGoalDialog(isHomeTeam)}
          >
            {isHomeTeam ? "Gol" : "Gol rival"}
          </Button>
        )}
      </div>

      {/* Score */}
      <div className={styles.scoreBlock}>
        <span className={styles.score}>{scoreLocal}</span>
        <span className={styles.scoreSep}>:</span>
        <span className={styles.score}>{scoreVisitor}</span>
      </div>

      {/* Visitor team */}
      <div className={`${styles.team} ${styles.teamRight}`}>
        {canScore && (
          <Button
            size="small"
            variant="outlined"
            color={!isHomeTeam ? "success" : "error"}
            className={styles.goalBtn}
            startIcon={<SportsSoccerIcon sx={{ fontSize: 14 }} />}
            onClick={() => openGoalDialog(!isHomeTeam)}
          >
            {!isHomeTeam ? "Gol" : "Gol rival"}
          </Button>
        )}
        <span className={styles.teamName}>{visitorTeamName}</span>
        {visitorTeamShield && (
          <img
            src={visitorTeamShield}
            alt=""
            className={styles.shield}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>

      {/* Goal registration dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, minWidth: 280 } }}
      >
        <DialogTitle sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>
          {pendingIsOwn ? "¿Quién marcó el gol?" : "Gol del rival"}
        </DialogTitle>
        <DialogContent sx={{ p: showDetailsStep ? 2 : 0 }}>
          {pendingIsOwn && !showDetailsStep && (
            <List dense>
              {fieldPlayers.map((p) => (
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
              {!pendingIsOwn && (
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

      {/* Card registration dialog */}
      {onAddCard && (
        <CardEventDialog
          open={cardDialogOpen}
          players={fieldPlayers}
          onClose={() => setCardDialogOpen(false)}
          onSubmit={handleCardSubmit}
        />
      )}
    </div>
  );
}
