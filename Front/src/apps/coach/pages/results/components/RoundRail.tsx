import { useEffect, useRef } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { Outcome } from "../utils/ownMatch";
import OutcomeBadge from "./OutcomeBadge";
import styles from "./RoundRail.module.css";

export type RailRound = {
  number: number;
  outcome: Outcome | null;
  dateLabel: string;
  suspended?: boolean;
};

type Props = {
  rounds: RailRound[];
  selectedIndex: number;
  currentIndex: number;
  selectedDateLabel: string;
  onSelect: (index: number) => void;
};

const OUTCOME_LABEL: Record<Outcome, string> = { V: "victoria", E: "empate", D: "derrota" };

function chipLabel(round: RailRound, isCurrent: boolean) {
  if (round.suspended) return `Jornada ${round.number}, suspendido`;
  if (round.outcome) return `Jornada ${round.number}, ${OUTCOME_LABEL[round.outcome]}`;
  return `Jornada ${round.number}, ${isCurrent ? "jornada actual" : "por jugar"}`;
}

export default function RoundRail({ rounds, selectedIndex, currentIndex, selectedDateLabel, onSelect }: Props) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const selected = rounds[selectedIndex];

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  return (
    <nav aria-label="Jornadas" className={styles.rail}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Jornada anterior"
          disabled={selectedIndex <= 0}
          onClick={() => onSelect(selectedIndex - 1)}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </button>
        <div className={styles.heading}>
          <div className={styles.title}>
            <span>Jornada {selected?.number}</span> <span className={styles.total}>/ {rounds.length}</span>
          </div>
          <div className={styles.date}>{selectedDateLabel}</div>
        </div>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Jornada siguiente"
          disabled={selectedIndex >= rounds.length - 1}
          onClick={() => onSelect(selectedIndex + 1)}
        >
          <ChevronRightIcon aria-hidden="true" />
        </button>
      </div>

      <div className={styles.chips}>
        {rounds.map((round, index) => {
          const isSelected = index === selectedIndex;
          const isCurrent = index === currentIndex;
          const className = [
            styles.chip,
            !round.outcome && !isCurrent ? styles.upcoming : "",
            isCurrent ? styles.current : "",
            isSelected ? styles.selected : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={round.number}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              className={className}
              aria-pressed={isSelected}
              aria-label={chipLabel(round, isCurrent)}
              onClick={() => onSelect(index)}
            >
              <span className={styles.chipLabel}>J{round.number}</span>
              {round.suspended ? (
                <span className={styles.chipSuspended}>Susp.</span>
              ) : round.outcome ? (
                <OutcomeBadge outcome={round.outcome} inverted={isSelected} />
              ) : (
                <span className={styles.chipDate}>{round.dateLabel}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.footer}>
        <span className={styles.legend}>V victoria · E empate · D derrota</span>
        <button type="button" className={styles.today} disabled={selectedIndex === currentIndex} onClick={() => onSelect(currentIndex)}>
          Jornada actual
        </button>
      </div>
    </nav>
  );
}
