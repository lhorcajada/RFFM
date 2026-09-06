import { useState } from "react";
import {
  Button,
} from "@mui/material";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import StyleIcon from "@mui/icons-material/Style";
import type { LiveMatchPhase } from "./liveMatch.types";
import type { SimSlotPlayer } from "./SimulationPlayerSlot";
import CardEventDialog, { type CardEventSubmitPayload } from "./CardEventDialog";
import GoalEventDialog, { type GoalEventSubmitPayload } from "./GoalEventDialog";
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
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [pendingIsOwnGoal, setPendingIsOwnGoal] = useState(false);

  const canScore =
    matchPhase === "firstHalf" ||
    matchPhase === "halftime" ||
    matchPhase === "secondHalf";

  function openGoalDialog(isOwnTeam: boolean) {
    setPendingIsOwnGoal(isOwnTeam);
    setGoalDialogOpen(true);
  }

  function handleGoalSubmit(payload: GoalEventSubmitPayload) {
    setGoalDialogOpen(false);
    onAddGoal(
      payload.scorerId,
      payload.scorerName,
      payload.scorerDorsal,
      payload.isOwnTeam,
      payload.pitchZone,
      payload.bodyPart,
    );
  }

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
      <GoalEventDialog
        open={goalDialogOpen}
        players={fieldPlayers}
        isOwnTeam={pendingIsOwnGoal}
        onClose={() => setGoalDialogOpen(false)}
        onSubmit={handleGoalSubmit}
      />

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
