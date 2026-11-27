import { useMemo, useState } from "react";
import { Popover } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { buildProposalHistory } from "../utils/proposalHistory";
import type { GridCell, MatchColumn } from "./convocationMatchDetail.types";
import styles from "./ProposalHistory.module.css";

export type ProposalHistoryData = {
  /** Past matches, newest first. */
  columns: MatchColumn[];
  grid: Map<string, Map<string, GridCell>>;
};

type Props = ProposalHistoryData & { playerId: string; playerName: string };

/** "J7 · 21 nov" → "J7": the date does not fit in a cell, it stays in the tooltip. */
function matchday(label: string): string {
  return label.split(" · ")[0];
}

/** Compact league deconvocation history of a player; the reasons float over the card so it never grows. */
export default function ProposalHistory({ playerId, playerName, columns, grid }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { total, technical, streak, season, causes, last } = useMemo(
    () => buildProposalHistory(playerId, columns, grid),
    [playerId, columns, grid],
  );

  return (
    <div className={styles.history} role="group" aria-label={`Historial de ${playerName}`}>
      <div className={styles.stats}>
        <span className={styles.stat}>
          <strong className={styles.value}>{total}</strong>
          <span className={styles.label}>desconv.</span>
        </span>
        <span className={styles.stat}>
          <strong className={`${styles.value} ${styles.technical}`}>{technical}</strong>
          <span className={styles.label}>técnica</span>
        </span>
        <span className={styles.stat}>
          <strong className={`${styles.value} ${styles.streak}`}>{streak}</strong>
          <span className={styles.label}>jorn. sin técnica</span>
        </span>
      </div>

      <div
        className={styles.strip}
        role="img"
        aria-label={`Temporada de ${playerName}: ${total} desconvocatorias en ${season.length} partidos de liga`}
      >
        {season.map((cell) => (
          <div
            key={cell.eventId}
            className={`${styles.cell} ${cell.cause ? styles.cellOut : ""}`}
            title={cell.cause ? `${cell.label} · ${cell.cause.label}` : cell.label}
            style={cell.cause ? { background: cell.cause.text } : undefined}
          >
            {matchday(cell.label)}
          </div>
        ))}
      </div>

      {last ? (
        <div className={styles.footer}>
          <span className={styles.last}>
            Última: <strong>{last.label}</strong> · <span style={{ color: last.cause.text }}>{last.cause.label}</span>
          </span>
          <button
            type="button"
            className={styles.causesButton}
            aria-label={`Motivos de ${playerName}`}
            aria-expanded={anchor !== null}
            onClick={(event) => setAnchor(event.currentTarget)}
          >
            Motivos
            <ExpandMoreIcon fontSize="small" aria-hidden="true" />
          </button>
          <Popover
            open={anchor !== null}
            anchorEl={anchor}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            transformOrigin={{ vertical: "bottom", horizontal: "right" }}
            slotProps={{ paper: { className: styles.popover } }}
          >
            <ul className={styles.causes} aria-label={`Motivos de desconvocatoria de ${playerName}`}>
              {causes.map(({ cause, count }) => (
                <li key={cause.label} className={styles.cause}>
                  <span className={styles.dot} aria-hidden="true" style={{ background: cause.text }} />
                  <span className={styles.causeLabel}>{cause.label}</span>
                  <strong style={{ color: cause.text }}>{count}</strong>
                </li>
              ))}
            </ul>
          </Popover>
        </div>
      ) : (
        <p className={styles.empty}>Sin desconvocatorias esta temporada</p>
      )}
    </div>
  );
}
