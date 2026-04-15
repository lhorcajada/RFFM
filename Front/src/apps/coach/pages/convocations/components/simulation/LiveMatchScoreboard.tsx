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
} from "@mui/material";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import type { LiveMatchPhase } from "./liveMatch.types";
import type { SimSlotPlayer } from "./SimulationPlayerSlot";
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
}: LiveMatchScoreboardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingIsOwn, setPendingIsOwn] = useState(false);

  const canScore =
    matchPhase === "firstHalf" ||
    matchPhase === "halftime" ||
    matchPhase === "secondHalf";

  function openGoalDialog(isOwnTeam: boolean) {
    if (!isOwnTeam) {
      // Rival goal — no scorer selection needed
      onAddGoal(null, null, null, false);
      return;
    }
    setPendingIsOwn(true);
    setDialogOpen(true);
  }

  function handleSelectScorer(player: SimSlotPlayer | "own") {
    setDialogOpen(false);
    if (player === "own") {
      // Own goal (counts for visitor)
      onAddGoal(null, "Gol en propia puerta", null, false);
    } else {
      onAddGoal(
        player.teamPlayerId,
        player.displayName,
        player.dorsal ?? null,
        true,
      );
    }
  }

  return (
    <div className={styles.root}>
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

      {/* Scorer selection dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, minWidth: 280 } }}
      >
        <DialogTitle sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>
          ¿Quién marcó el gol?
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
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
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" size="small">
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
