import { Accordion, AccordionDetails, AccordionSummary, ToggleButton, ToggleButtonGroup } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { TraitTrend } from "../../../../types/traitRating";
import {
  DEFENDER_CATEGORY,
  FORWARD_CATEGORY,
  MIDFIELDER_CATEGORY,
  positionCategory,
} from "../positionCategory";
import {
  MAX_TRAIT_LEVEL,
  MIN_TRAIT_LEVEL,
  TRAIT_CATALOG,
  TRAIT_PHASE_LABELS,
  type TraitDefinition,
  type TraitPhase,
} from "../ratingTraits";
import type { PlayerTraitDraft, TraitLevels } from "../useTraitRating";
import { playerDisplayName } from "./RatingSheetBoard";

import styles from "./TraitPlayerCard.module.css";

type Props = {
  player: PlayerResponse;
  draft: PlayerTraitDraft;
  previousLevels: TraitLevels;
  readOnly: boolean;
  expanded: boolean;
  onToggle: () => void;
  onLevel: (traitKey: string, level: number | null) => void;
  onTrend: (trend: TraitTrend) => void;
};

const PHASES: TraitPhase[] = ["withBall", "withoutBall", "transitions", "transversal"];
const LEVELS = Array.from({ length: MAX_TRAIT_LEVEL - MIN_TRAIT_LEVEL + 1 }, (_, i) => MIN_TRAIT_LEVEL + i);

const TREND_OPTIONS: { value: TraitTrend; label: string }[] = [
  { value: "up", label: "Sube" },
  { value: "same", label: "Igual" },
  { value: "down", label: "Baja" },
];

const ACCENT_CLASS: Record<number, string> = {
  [DEFENDER_CATEGORY]: styles.accentDefender,
  [MIDFIELDER_CATEGORY]: styles.accentMidfielder,
  [FORWARD_CATEGORY]: styles.accentForward,
};

const TREND_SYMBOL: Record<TraitTrend, string> = { up: "↗", same: "=", down: "↘" };

function anchorOf(trait: TraitDefinition, level: number): string | undefined {
  return level === 1 || level === 3 || level === 5 ? trait.anchors[level] : undefined;
}

export default function TraitPlayerCard({
  player,
  draft,
  previousLevels,
  readOnly,
  expanded,
  onToggle,
  onLevel,
  onTrend,
}: Props) {
  const rated = TRAIT_CATALOG.filter((trait) => draft.levels[trait.key] != null).length;

  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      disableGutters
      slotProps={{ transition: { unmountOnExit: true } }}
      className={styles.card}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <span className={styles.summary}>
          <span className={`${styles.accent} ${ACCENT_CLASS[positionCategory(player.position)] ?? ""}`} aria-hidden="true" />
          <span className={styles.name}>{playerDisplayName(player)}</span>
          {player.dorsal != null && <span className={styles.meta}>#{player.dorsal}</span>}
          {player.position && <span className={styles.meta}>{player.position}</span>}
          <span className={styles.progress}>{rated}/{TRAIT_CATALOG.length}</span>
          {draft.trend !== "same" && <span className={styles.trendMark} aria-hidden="true">{TREND_SYMBOL[draft.trend]}</span>}
        </span>
      </AccordionSummary>
      <AccordionDetails>
        <div role="group" aria-label="Tendencia" className={styles.trendRow}>
          <span className={styles.trendLabel}>Tendencia esta semana</span>
          <ToggleButtonGroup
            value={draft.trend}
            exclusive
            size="small"
            disabled={readOnly}
            onChange={(_, value: TraitTrend | null) => { if (value) onTrend(value); }}
          >
            {TREND_OPTIONS.map(({ value, label }) => (
              <ToggleButton key={value} value={value} className={styles.trendBtn}>
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        {PHASES.map((phase) => (
          <section key={phase} className={styles.phase}>
            <h3 className={styles.phaseTitle}>{TRAIT_PHASE_LABELS[phase]}</h3>
            {TRAIT_CATALOG.filter((trait) => trait.phase === phase).map((trait) => (
              <div key={trait.key} role="group" aria-label={trait.label} className={styles.trait}>
                <span className={styles.traitLabel}>{trait.label}</span>
                <span className={styles.levels}>
                  {LEVELS.map((level) => {
                    const selected = draft.levels[trait.key] === level;
                    const previous = previousLevels[trait.key] === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        className={`${styles.level} ${selected ? styles.levelSelected : ""} ${previous ? styles.levelPrevious : ""}`}
                        aria-pressed={selected}
                        aria-label={`${trait.label}: nivel ${level}${previous ? " (anterior)" : ""}`}
                        title={anchorOf(trait, level)}
                        disabled={readOnly}
                        onClick={() => onLevel(trait.key, selected ? null : level)}
                      >
                        {level}
                      </button>
                    );
                  })}
                </span>
              </div>
            ))}
          </section>
        ))}
      </AccordionDetails>
    </Accordion>
  );
}
