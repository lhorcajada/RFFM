import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Chip,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import type { PoolPlayer, RecruitmentStatus } from "../../SeasonPrep";
import type { PlayerRating, RatingAnswer } from "../../../../types/playerRating";
import { playerIsGk, FP_GROUPS, GK_GROUPS, getCategoryLabel } from "../evaluationConstants";
import { AttributeGroup } from "./AttributeGroup";
import { RecruitmentStatusChips } from "./RecruitmentStatusChips";
import styles from "./EvaluationPanel.module.css";

function emptyRating(playerId: string, isGoalkeeper: boolean): PlayerRating {
  return {
    id: `draft-${playerId}`,
    teamPlayerId: playerId,
    isGoalkeeper,
    physical: 0,
    technical: 0,
    tactical: 0,
    competitiveness: 0,
    answers: [],
    ratedAt: new Date().toISOString(),
    notes: null,
  };
}

function roundUpToOneDecimal(value: number): number {
  return Math.ceil(value * 10) / 10;
}

function buildRating(player: PoolPlayer, rating: PlayerRating, answer?: RatingAnswer, notes?: string): PlayerRating {
  const answers = answer
    ? [...rating.answers.filter((a) => a.characteristicKey !== answer.characteristicKey), answer]
    : rating.answers;
  const scoreFor = (categoryKey: "physical" | "technical" | "tactical" | "competitiveness") => {
    const levels = answers.filter((a) => a.categoryKey === categoryKey).map((a) => a.level);
    return levels.length === 0 ? 0 : roundUpToOneDecimal(levels.reduce((sum, level) => sum + level, 0) / levels.length);
  };

  return {
    ...rating,
    teamPlayerId: player.uniqueId,
    isGoalkeeper: playerIsGk(player),
    answers,
    physical: scoreFor("physical"),
    technical: scoreFor("technical"),
    tactical: scoreFor("tactical"),
    competitiveness: scoreFor("competitiveness"),
    notes: notes === undefined ? rating.notes : notes || null,
  };
}

interface EvaluationPanelProps {
  player: PoolPlayer;
  positionOptions: string[];
  onRatingChange: (rating: PlayerRating) => void;
  onPositionChange: (pos: string) => void;
  onStatusChange: (status: RecruitmentStatus) => void;
}

export function EvaluationPanel({
  player,
  positionOptions,
  onRatingChange,
  onPositionChange,
  onStatusChange,
}: EvaluationPanelProps) {
  const isGk = playerIsGk(player);
  const groups = isGk ? GK_GROUPS : FP_GROUPS;
  const [activeTab, setActiveTab] = useState(0);
  const [editingPos, setEditingPos] = useState(false);
  const [posValue, setPosValue] = useState(player.position ?? "");

  const rating = useMemo(() => player.rating ?? emptyRating(player.uniqueId, isGk), [player.rating, player.uniqueId, isGk]);
  const status = player.recruitmentStatus ?? "observando";
  const activeGroup = groups[activeTab] ?? groups[0];

  useEffect(() => {
    setPosValue(player.position ?? "");
  }, [player.position]);

  function commitPos() {
    setEditingPos(false);
    if (posValue.trim() !== player.position) onPositionChange(posValue.trim());
  }

  function handleAnswer(answer: RatingAnswer) {
    onRatingChange(buildRating(player, rating, answer));
  }

  function handleNotesChange(notes: string) {
    onRatingChange(buildRating(player, rating, undefined, notes));
  }

  return (
    <div className={styles.panel}>
      <div className={styles.playerHeader}>
        <div className={styles.playerIdentity}>
          {player.jerseyNumber != null && player.jerseyNumber !== "" && player.jerseyNumber !== "0" && (
            <span className={styles.dorsal}>{player.jerseyNumber}</span>
          )}
          <span className={styles.name}>{player.name}</span>

          {editingPos ? (
            <Autocomplete
              freeSolo
              size="small"
              options={positionOptions}
              value={posValue}
              onInputChange={(_e, v) => setPosValue(v)}
              onChange={(_e, v) => setPosValue(v ?? "")}
              onBlur={commitPos}
              sx={{ width: 160, "& .MuiInputBase-input": { fontSize: "0.8rem", py: "2px" } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") commitPos(); }}
                />
              )}
            />
          ) : (
            <Chip
              size="small"
              label={player.position || "Sin pos."}
              onClick={() => {
                setPosValue(player.position ?? "");
                setEditingPos(true);
              }}
              icon={<EditIcon sx={{ fontSize: "0.7rem !important" }} />}
              sx={{ fontSize: "0.7rem", height: 22, cursor: "pointer" }}
            />
          )}
        </div>

        <RecruitmentStatusChips value={status} onChange={onStatusChange} />
      </div>

      <Tabs
        value={activeTab}
        onChange={(_e, v: number) => setActiveTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 44,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          "& .MuiTab-root": {
            minHeight: 44,
            fontSize: "0.8rem",
            fontWeight: 700,
            textTransform: "none",
            letterSpacing: "0.01em",
          },
          "& .Mui-selected": { color: "#4ec9b0 !important" },
          "& .MuiTabs-indicator": { backgroundColor: "#4ec9b0" },
        }}
      >
        {groups.map((g) => (
          <Tab key={g.title} label={g.title} />
        ))}
      </Tabs>

      <div className={styles.conceptsArea}>
        <AttributeGroup
          title={getCategoryLabel(activeGroup.concepts[0]?.categoryKey ?? "technical")}
          concepts={activeGroup.concepts}
          rating={rating}
          onChange={handleAnswer}
        />

        {activeTab === groups.length - 1 && (
          <div className={styles.notesRow}>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              placeholder="Nota sobre el jugador…"
              value={rating.notes ?? ""}
              onChange={(e) => handleNotesChange(e.target.value.slice(0, 150))}
              inputProps={{ maxLength: 150 }}
              helperText={`${(rating.notes ?? "").length}/150`}
              sx={{ mt: 1 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}