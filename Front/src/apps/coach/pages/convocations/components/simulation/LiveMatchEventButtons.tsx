import { useState } from "react";
import { Button } from "@mui/material";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import StyleIcon from "@mui/icons-material/Style";
import type { LiveMatchPhase } from "./liveMatch.types";
import type { SimSlotPlayer } from "./SimulationPlayerSlot";
import CardEventDialog, { type CardEventSubmitPayload } from "./CardEventDialog";
import GoalEventDialog, { type GoalEventSubmitPayload } from "./GoalEventDialog";
import styles from "./LiveMatchEventButtons.module.css";

interface LiveMatchEventButtonsProps {
  matchPhase: LiveMatchPhase;
  /** Players currently on the field (for scorer and carded-player selection) */
  fieldPlayers: SimSlotPlayer[];
  /** Current match minute, used to pre-fill (and let the coach adjust) the goal's minute */
  currentMinute?: number;
  onAddGoal: (
    scorerId: string | null,
    scorerName: string | null,
    scorerDorsal: number | null,
    isOwnTeam: boolean,
    pitchZone: { col: number; row: number } | null,
    bodyPart: "head" | "foot" | null,
    minute?: number,
  ) => void;
  onAddCard: (
    teamPlayerId: string | null,
    playerName: string | null,
    isRivalPlayer: boolean,
    rivalDorsal: number | null,
    cardType: "yellow" | "red",
  ) => void;
}

type CardSide = "own" | "rival";

/** Goal and card buttons of the live match, shown below the bench. */
export default function LiveMatchEventButtons({
  matchPhase,
  fieldPlayers,
  currentMinute = 0,
  onAddGoal,
  onAddCard,
}: LiveMatchEventButtonsProps) {
  const [goalIsOwnTeam, setGoalIsOwnTeam] = useState<boolean | null>(null);
  const [cardSide, setCardSide] = useState<CardSide | null>(null);

  const canRegister =
    matchPhase === "firstHalf" ||
    matchPhase === "halftime" ||
    matchPhase === "secondHalf";

  function handleGoalSubmit(payload: GoalEventSubmitPayload) {
    setGoalIsOwnTeam(null);
    onAddGoal(
      payload.scorerId,
      payload.scorerName,
      payload.scorerDorsal,
      payload.isOwnTeam,
      payload.pitchZone,
      payload.bodyPart,
      payload.minute,
    );
  }

  function handleCardSubmit(payload: CardEventSubmitPayload) {
    setCardSide(null);
    onAddCard(
      payload.teamPlayerId,
      payload.playerName,
      payload.isRivalPlayer,
      payload.rivalDorsal,
      payload.cardType,
    );
  }

  return (
    <div className={styles.root}>
      <Button
        size="small"
        variant="outlined"
        color="success"
        className={styles.button}
        startIcon={<SportsSoccerIcon sx={{ fontSize: 16 }} />}
        disabled={!canRegister}
        onClick={() => setGoalIsOwnTeam(true)}
      >
        Gol a favor
      </Button>
      <Button
        size="small"
        variant="outlined"
        color="error"
        className={styles.button}
        startIcon={<SportsSoccerIcon sx={{ fontSize: 16 }} />}
        disabled={!canRegister}
        onClick={() => setGoalIsOwnTeam(false)}
      >
        Gol en contra
      </Button>
      <Button
        size="small"
        variant="outlined"
        color="warning"
        className={styles.button}
        startIcon={<StyleIcon sx={{ fontSize: 16 }} />}
        disabled={!canRegister}
        onClick={() => setCardSide("own")}
      >
        Tarjeta nuestra
      </Button>
      <Button
        size="small"
        variant="outlined"
        color="warning"
        className={styles.button}
        startIcon={<StyleIcon sx={{ fontSize: 16 }} />}
        disabled={!canRegister}
        onClick={() => setCardSide("rival")}
      >
        Tarjeta rival
      </Button>

      <GoalEventDialog
        open={goalIsOwnTeam !== null}
        players={fieldPlayers}
        isOwnTeam={goalIsOwnTeam ?? false}
        onClose={() => setGoalIsOwnTeam(null)}
        onSubmit={handleGoalSubmit}
        defaultMinute={currentMinute}
      />

      <CardEventDialog
        open={cardSide !== null}
        players={fieldPlayers}
        side={cardSide ?? undefined}
        onClose={() => setCardSide(null)}
        onSubmit={handleCardSubmit}
      />
    </div>
  );
}
