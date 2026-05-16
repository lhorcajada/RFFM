import { useState } from "react";
import { Autocomplete, Chip, TextField } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import EditIcon from "@mui/icons-material/Edit";

import type { PoolPlayer, RecruitmentStatus } from "../../SeasonPrep";
import type { PlayerRating } from "../../../../types/playerRating";
import { playerIsGk } from "../evaluationConstants";
import { SummaryDots } from "./SummaryDots";
import { usePlayerAvgScore } from "../hooks/usePlayerAvgScore";
import { RecruitmentStatusChips } from "./RecruitmentStatusChips";
import styles from "../EvaluationPage.module.css";

interface PlayerRowProps {
  player: PoolPlayer;
  expanded: boolean;
  onToggle: () => void;
  onRatingChange: (rating: PlayerRating) => void;
  onPositionChange: (pos: string) => void;
  onStatusChange: (status: RecruitmentStatus) => void;
  positionOptions: string[];
}

export function PlayerRow({
  player,
  expanded,
  onToggle,
  onRatingChange,
  onPositionChange,
  onStatusChange,
  positionOptions,
}: PlayerRowProps) {
  const [editingPos, setEditingPos] = useState(false);
  const [posValue, setPosValue] = useState(player.position ?? "");
  const { filled, total, avg } = usePlayerAvgScore(player);
  const status = player.recruitmentStatus ?? "observando";
  const isGk = playerIsGk(player);
  const avgLabel = avg > 0 ? avg.toFixed(1) : "--";

  function commitPos() {
    setEditingPos(false);
    if (posValue.trim() !== player.position) onPositionChange(posValue.trim());
  }

  const rating = player.rating ?? {
    id: `draft-${player.uniqueId}`,
    teamPlayerId: player.uniqueId,
    isGoalkeeper: isGk,
    physical: 0,
    technical: 0,
    tactical: 0,
    competitiveness: 0,
    answers: [],
    ratedAt: new Date().toISOString(),
    notes: null,
  };

  return (
    <div className={`${styles.playerRow} ${expanded ? styles.playerRowExpanded : ""}`}>
      <div className={styles.playerRowHeader} onClick={onToggle}>
        <div className={styles.playerRowLeft}>
          {player.jerseyNumber != null && player.jerseyNumber !== "" && player.jerseyNumber !== "0" && (
            <span className={styles.dorsal}>{player.jerseyNumber}</span>
          )}
          <span className={styles.playerName}>{player.name}</span>
          {editingPos ? (
            <Autocomplete
              freeSolo
              size="small"
              options={positionOptions}
              value={posValue}
              onInputChange={(_e, v) => setPosValue(v)}
              onChange={(_e, v) => setPosValue(v ?? "")}
              onBlur={commitPos}
              sx={{ width: 160, "& .MuiInputBase-input": { fontSize: "0.78rem", py: "2px" } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") commitPos(); }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            />
          ) : (
            <Chip
              size="small"
              label={player.position || "Sin pos."}
              onClick={(e) => {
                e.stopPropagation();
                setPosValue(player.position ?? "");
                setEditingPos(true);
              }}
              icon={<EditIcon sx={{ fontSize: "0.7rem !important" }} />}
              sx={{ fontSize: "0.7rem", height: 20, cursor: "pointer" }}
            />
          )}
          {player.manualEntry && (
            <Chip size="small" label={player.procedencia ?? "Manual"} sx={{ fontSize: "0.68rem", height: 18, opacity: 0.7 }} />
          )}
          {!!player.birthYear && (
            <Chip size="small" label={player.birthYear} sx={{ fontSize: "0.68rem", height: 18, opacity: 0.6 }} />
          )}
        </div>
        <div className={styles.playerRowRight}>
          <SummaryDots rating={rating} isGoalkeeper={isGk} />
          {total > 0 && (
            <span className={styles.avgBadge} style={{ color: filled === total ? "#4ec9b0" : filled > 0 ? "#f59e0b" : "rgba(255,255,255,0.3)" }} title={`Media de evaluación: ${avgLabel}`}>
              {avgLabel}
            </span>
          )}
          <RecruitmentStatusChips value={status} onChange={onStatusChange} />
          {expanded
            ? <ExpandLessIcon sx={{ fontSize: 18, opacity: 0.5 }} />
            : <ExpandMoreIcon sx={{ fontSize: 18, opacity: 0.5 }} />
          }
        </div>
      </div>

      {expanded && (
        <div className={styles.evalCard}>
          <div className={styles.notesRow}>
            <TextField
              fullWidth
              size="small"
              label="Notas"
              placeholder="Observación rápida..."
              value={rating.notes ?? ""}
              onChange={(e) => onRatingChange({ ...rating, notes: e.target.value })}
              inputProps={{ maxLength: 150 }}
              sx={{ mt: 1 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}