import { useState } from "react";
import { Autocomplete, Chip, MenuItem, Select, TextField } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import EditIcon from "@mui/icons-material/Edit";

import type { PoolPlayer, AttributeScore, RecruitmentStatus } from "../../SeasonPrep";
import type { AttributeKey } from "../evaluationConstants";
import { playerIsGk, GK_GROUPS, FP_GROUPS } from "../evaluationConstants";
import { SummaryDots } from "./SummaryDots";
import { AttributeGroup } from "./AttributeGroup";
import { usePlayerAvgScore } from "../hooks/usePlayerAvgScore";
import styles from "../EvaluationPage.module.css";

const STATUS_OPTIONS: { value: RecruitmentStatus; label: string; color: string }[] = [
  { value: "observando",  label: "Observando",  color: "#9e9e9e" },
  { value: "interesado",  label: "Interesado",  color: "#4d9de0" },
  { value: "fichado",     label: "Fichado",     color: "#22c55e" },
  { value: "descartado",  label: "Descartado",  color: "#ef4444" },
];

function statusColor(s: RecruitmentStatus | undefined): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.color ?? "#9e9e9e";
}

interface PlayerRowProps {
  player: PoolPlayer;
  expanded: boolean;
  onToggle: () => void;
  onEvalChange: (key: AttributeKey, val: AttributeScore) => void;
  onPositionChange: (pos: string) => void;
  onStatusChange: (status: RecruitmentStatus) => void;
  positionOptions: string[];
}

export function PlayerRow({
  player,
  expanded,
  onToggle,
  onEvalChange,
  onPositionChange,
  onStatusChange,
  positionOptions,
}: PlayerRowProps) {
  const eval_ = player.evaluation ?? {};
  const [editingPos, setEditingPos] = useState(false);
  const [posValue, setPosValue] = useState(player.position ?? "");
  const { avg, color } = usePlayerAvgScore(player);
  const status = player.recruitmentStatus ?? "observando";

  function commitPos() {
    setEditingPos(false);
    if (posValue.trim() !== player.position) onPositionChange(posValue.trim());
  }

  return (
    <div className={`${styles.playerRow} ${expanded ? styles.playerRowExpanded : ""}`}>
      {/* Collapsed header — always visible */}
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
          {(player.matches?.starter ?? 0) > 0 && (
            <Chip size="small" label={`T:${player.matches!.starter}`} sx={{ fontSize: "0.68rem", height: 18, opacity: 0.7 }} title="Titularidades" />
          )}
          {(player.matches?.totalGoals ?? 0) > 0 && (
            <Chip size="small" label={`⚽${player.matches!.totalGoals}`} sx={{ fontSize: "0.68rem", height: 18, opacity: 0.7 }} title="Goles" />
          )}
        </div>
        <div className={styles.playerRowRight}>
          <SummaryDots evaluation={eval_} isGoalkeeper={playerIsGk(player)} />
          {avg !== null && color !== null && (
            <span className={styles.avgBadge} style={{ color }}>
              {avg.toFixed(1)}
            </span>
          )}
          {/* Recruitment status selector */}
          <Select
            size="small"
            value={status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onStatusChange(e.target.value as RecruitmentStatus);
            }}
            variant="outlined"
            sx={{
              fontSize: "0.7rem",
              height: 22,
              minWidth: 108,
              "& .MuiSelect-select": { py: "1px !important", pl: "6px !important", pr: "24px !important" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: statusColor(status) },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: statusColor(status) },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: statusColor(status) },
              color: statusColor(status),
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.78rem", color: o.color }}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
          {expanded
            ? <ExpandLessIcon sx={{ fontSize: 18, opacity: 0.5 }} />
            : <ExpandMoreIcon sx={{ fontSize: 18, opacity: 0.5 }} />
          }
        </div>
      </div>

      {/* Expanded evaluation card */}
      {expanded && (
        <div className={styles.evalCard}>
          {(playerIsGk(player) ? GK_GROUPS : FP_GROUPS).map(({ title, attrs }) => (
            <AttributeGroup
              key={title}
              title={title}
              attrs={attrs}
              evaluation={eval_}
              onChange={onEvalChange}
            />
          ))}
          <div className={styles.notesRow}>
            <TextField
              fullWidth
              size="small"
              label="Nota"
              placeholder="Observación rápida..."
              value={eval_.notes ?? ""}
              onChange={(e) =>
                onEvalChange("notes" as AttributeKey, e.target.value as unknown as AttributeScore)
              }
              inputProps={{ maxLength: 150 }}
              sx={{ mt: 1 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
