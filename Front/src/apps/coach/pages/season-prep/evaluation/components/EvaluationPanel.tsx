import { useState } from "react";
import {
  Autocomplete,
  Chip,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import type { PoolPlayer, ConceptEval, RecruitmentStatus } from "../../SeasonPrep";
import type { ConceptKey } from "../evaluationConstants";
import { playerIsGk, FP_GROUPS, GK_GROUPS } from "../evaluationConstants";
import { AttributeGroup } from "./AttributeGroup";
import styles from "./EvaluationPanel.module.css";

const STATUS_OPTIONS: { value: RecruitmentStatus; label: string; color: string }[] = [
  { value: "observando",  label: "Observando",  color: "#9e9e9e" },
  { value: "interesado",  label: "Interesado",  color: "#4d9de0" },
  { value: "fichado",     label: "Fichado",     color: "#22c55e" },
  { value: "descartado",  label: "Descartado",  color: "#ef4444" },
];

function statusColor(s: RecruitmentStatus | undefined): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.color ?? "#9e9e9e";
}

interface EvaluationPanelProps {
  player: PoolPlayer;
  positionOptions: string[];
  onEvalChange: (key: ConceptKey, val: ConceptEval) => void;
  onNotesChange: (notes: string) => void;
  onPositionChange: (pos: string) => void;
  onStatusChange: (status: RecruitmentStatus) => void;
}

export function EvaluationPanel({
  player,
  positionOptions,
  onEvalChange,
  onNotesChange,
  onPositionChange,
  onStatusChange,
}: EvaluationPanelProps) {
  const isGk = playerIsGk(player);
  const groups = isGk ? GK_GROUPS : FP_GROUPS;
  const [activeTab, setActiveTab] = useState(0);
  const [editingPos, setEditingPos] = useState(false);
  const [posValue, setPosValue] = useState(player.position ?? "");

  const eval_ = player.evaluation ?? {};
  const status = player.recruitmentStatus ?? "observando";
  const activeGroup = groups[activeTab] ?? groups[0];

  function commitPos() {
    setEditingPos(false);
    if (posValue.trim() !== player.position) onPositionChange(posValue.trim());
  }

  return (
    <div className={styles.panel}>
      {/* ── Player header ─────────────────────────────────── */}
      <div className={styles.playerHeader}>
        <div className={styles.playerIdentity}>
          {player.jerseyNumber != null &&
            player.jerseyNumber !== "" &&
            player.jerseyNumber !== "0" && (
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

        <Select
          size="small"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as RecruitmentStatus)}
          sx={{
            fontSize: "0.8rem",
            minWidth: 120,
            "& .MuiSelect-select": { py: "5px" },
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: statusColor(status),
            },
            color: statusColor(status),
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: "0.8rem" }}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </div>

      {/* ── Category tabs ──────────────────────────────────── */}
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
          "& .Mui-selected": {
            color: "#4ec9b0 !important",
          },
          "& .MuiTabs-indicator": {
            backgroundColor: "#4ec9b0",
          },
        }}
      >
        {groups.map((g) => (
          <Tab key={g.title} label={g.title} />
        ))}
      </Tabs>

      {/* ── Concepts for active category ───────────────────── */}
      <div className={styles.conceptsArea}>
        <AttributeGroup
          title=""
          concepts={activeGroup.concepts}
          evaluation={eval_}
          onChange={onEvalChange}
        />

        {/* Notes — shown on the last tab */}
        {activeTab === groups.length - 1 && (
          <div className={styles.notesRow}>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              placeholder="Nota sobre el jugador…"
              value={eval_.notes ?? ""}
              onChange={(e) => onNotesChange(e.target.value.slice(0, 150))}
              inputProps={{ maxLength: 150 }}
              helperText={`${(eval_.notes ?? "").length}/150`}
              sx={{ mt: 1 }}
            />
          </div>
        )}
      </div>

      {/* ── Empty-state placeholder ────────────────────────── */}
      {!player && (
        <Typography sx={{ opacity: 0.35, textAlign: "center", mt: 6 }}>
          Selecciona un jugador para evaluar
        </Typography>
      )}
    </div>
  );
}
