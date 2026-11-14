import { useMemo, useState } from "react";
import { MenuItem, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";

import type { PlayerResponse } from "../../../../services/teamplayerService";
import {
  MAX_TRAIT_LEVEL,
  MIN_TRAIT_LEVEL,
  TRAIT_CATALOG,
  TRAIT_PHASE_LABELS,
  type TraitDefinition,
  type TraitPhase,
} from "../ratingTraits";
import type { SheetDraft } from "../ratingSheet";
import type { TraitDraft } from "../useTraitRating";
import RatingSheetBoard, { type BoardCharacteristic } from "./RatingSheetBoard";

import styles from "./TraitBoardView.module.css";

type Props = {
  players: PlayerResponse[];
  draft: TraitDraft;
  readOnly: boolean;
  /** `null` quita el nivel de los jugadores. */
  onPlace: (playerIds: string[], traitKey: string, level: number | null) => void;
};

const PHASES: TraitPhase[] = ["withBall", "withoutBall", "transitions", "transversal"];

function boardCharacteristic(trait: TraitDefinition): BoardCharacteristic {
  const levels = Array.from({ length: MAX_TRAIT_LEVEL - MIN_TRAIT_LEVEL + 1 }, (_, index) => {
    const level = MIN_TRAIT_LEVEL + index;
    const anchor = level === 1 || level === 3 || level === 5 ? trait.anchors[level] : undefined;
    return { concept: anchor ?? `Intermedio entre el nivel ${level - 1} y el ${level + 1}` };
  });
  return { key: trait.key, levels };
}

export default function TraitBoardView({ players, draft, readOnly, onPlace }: Props) {
  const theme = useTheme();
  const isNarrowViewport = useMediaQuery(theme.breakpoints.down("md"));
  const [selectedKey, setSelectedKey] = useState<string>(TRAIT_CATALOG[0].key);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  const selected = TRAIT_CATALOG.find((trait) => trait.key === selectedKey) ?? TRAIT_CATALOG[0];
  const levelsDraft: SheetDraft = useMemo(
    () => Object.fromEntries(Object.entries(draft).map(([playerId, d]) => [playerId, d.levels])),
    [draft],
  );

  function progressOf(traitKey: string): string {
    const placed = players.filter((player) => levelsDraft[player.id]?.[traitKey] != null).length;
    return `${placed}/${players.length}`;
  }

  function selectTrait(traitKey: string) {
    setSelectedKey(traitKey);
    setSelectedIds(new Set());
  }

  function togglePlayer(playerId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(playerId)) next.add(playerId);
      return next;
    });
  }

  function placeSelected(level: number | null) {
    if (selectedIds.size === 0) return;
    onPlace([...selectedIds], selected.key, level);
    setSelectedIds(new Set());
  }

  if (players.length === 0) {
    return <Typography className={styles.emptyMessage}>No hay jugadores de campo en la plantilla.</Typography>;
  }

  return (
    <div className={`${styles.layout} ${isNarrowViewport ? styles.layoutNarrow : ""}`}>
      {isNarrowViewport ? (
        <TextField select fullWidth size="small" label="Rasgo" value={selected.key} onChange={(e) => selectTrait(e.target.value)}>
          {TRAIT_CATALOG.map((trait) => (
            <MenuItem key={trait.key} value={trait.key}>
              {TRAIT_PHASE_LABELS[trait.phase]} · {trait.label} ({progressOf(trait.key)})
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <div className={styles.leftPanel}>
          {PHASES.map((phase) => (
            <div key={phase} className={styles.phaseSection}>
              <div className={styles.phaseHeader}>{TRAIT_PHASE_LABELS[phase]}</div>
              {TRAIT_CATALOG.filter((trait) => trait.phase === phase).map((trait) => (
                <button
                  key={trait.key}
                  type="button"
                  className={`${styles.traitRow} ${trait.key === selected.key ? styles.traitRowSelected : ""}`}
                  aria-current={trait.key === selected.key}
                  onClick={() => selectTrait(trait.key)}
                >
                  <span className={styles.traitLabel}>{trait.label}</span>
                  <span className={styles.traitProgress}>{progressOf(trait.key)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className={styles.rightPanel}>
        <Typography variant="subtitle1" className={styles.boardTitle}>
          {selected.label}
        </Typography>
        {!readOnly && (
          <Typography variant="caption" className={styles.hint}>
            Toca uno o varios jugadores y después el nivel donde quieres colocarlos.
          </Typography>
        )}
        <RatingSheetBoard
          characteristic={boardCharacteristic(selected)}
          players={players}
          draft={levelsDraft}
          selectedIds={selectedIds}
          readOnly={readOnly}
          onTogglePlayer={togglePlayer}
          onPlace={placeSelected}
        />
      </div>
    </div>
  );
}
