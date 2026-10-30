import { useMemo, useState } from "react";
import GavelIcon from "@mui/icons-material/Gavel";
import styles from "./DeconvocationHistory.module.css";

const VISIBLE_ROWS = 3;

export type HistoryCause = { label: string; bg: string; text: string };

/** One cell of the season strip; `cause` is null when the player was not deconvoked in that match. */
export type SeasonCell = { eventId: string; label: string; cause: HistoryCause | null };

export type HistoryEntry = {
  eventId: string;
  label: string;
  date: string;
  title: string;
  cause: HistoryCause;
  sanction: boolean;
};

type Props = {
  playerName: string;
  /** Every match of the season, oldest first. */
  seasonCells: SeasonCell[];
  /** The player's deconvocations, newest first. */
  entries: HistoryEntry[];
};

function formatShortDate(date: string): string {
  const parsed = new Date(date.length === 10 ? `${date}T00:00:00` : date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function DeconvocationHistory({ playerName, seasonCells, entries }: Props) {
  const [causeFilter, setCauseFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const causes = useMemo(() => {
    const counts = new Map<string, { cause: HistoryCause; count: number }>();
    for (const entry of entries) {
      const existing = counts.get(entry.cause.label);
      if (existing) existing.count++;
      else counts.set(entry.cause.label, { cause: entry.cause, count: 1 });
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [entries]);

  const filtered = causeFilter ? entries.filter((e) => e.cause.label === causeFilter) : entries;
  const folds = !causeFilter && entries.length > VISIBLE_ROWS;
  const shown = folds && !expanded ? filtered.slice(0, VISIBLE_ROWS) : filtered;
  const hiddenCount = entries.length - VISIBLE_ROWS;
  const scrolls = shown.length > VISIBLE_ROWS;

  const toggleCause = (label: string) => setCauseFilter((current) => (current === label ? null : label));

  return (
    <div className={styles.history}>
      <section className={styles.season} aria-label={`Temporada de ${playerName}`}>
        <div className={styles.seasonHeader}>
          <span>Temporada · {seasonCells.length} partidos</span>
        </div>
        <div className={styles.strip} aria-hidden="true">
          {seasonCells.map((cell) => (
            <div
              key={cell.eventId}
              className={styles.cell}
              title={cell.cause ? `${cell.label} · ${cell.cause.label}` : cell.label}
              style={cell.cause ? { background: cell.cause.text } : undefined}
            />
          ))}
        </div>
        <div className={styles.stripEnds} aria-hidden="true">
          <span>{seasonCells[0]?.label}</span>
          <span>{seasonCells[seasonCells.length - 1]?.label}</span>
        </div>
      </section>

      <div className={styles.causes}>
        {causes.map(({ cause, count }) => (
          <button
            key={cause.label}
            type="button"
            className={`${styles.causeBtn} ${causeFilter === cause.label ? styles.causeBtnActive : ""}`}
            aria-pressed={causeFilter === cause.label}
            onClick={() => toggleCause(cause.label)}
          >
            <span className={styles.causeDot} aria-hidden="true" style={{ background: cause.text }} />
            {cause.label} <strong style={{ color: cause.text }}>{count}</strong>
          </button>
        ))}
      </div>

      <div className={styles.listHeader}>
        <span className={styles.listTitle}>
          {causeFilter ? causeFilter : folds ? `Últimas ${VISIBLE_ROWS}` : "Partidos"}
        </span>
        {causeFilter && (
          <button type="button" className={styles.linkBtn} onClick={() => setCauseFilter(null)}>
            Quitar filtro
          </button>
        )}
      </div>

      <ul
        className={`${styles.rows} ${scrolls ? styles.rowsScroll : ""}`}
        aria-label={`Partidos de ${playerName}`}
      >
        {shown.map((entry) => (
          <li key={entry.eventId} className={styles.row} title={entry.title}>
            <span className={styles.rowDot} aria-hidden="true" style={{ background: entry.cause.text }} />
            <strong className={styles.rowMatch}>
              {entry.label} · {formatShortDate(entry.date)}
            </strong>
            <span className={styles.rowCause} style={{ color: entry.cause.text }}>
              {entry.cause.label}
            </span>
            {entry.sanction && (
              <span
                className={styles.sanctionBadge}
                title="Desconvocado por sanción deportiva"
                aria-label="Desconvocado por sanción deportiva"
              >
                <GavelIcon sx={{ fontSize: 12 }} />
              </span>
            )}
          </li>
        ))}
      </ul>

      {causeFilter && (
        <p className={styles.note}>
          Mostrando {filtered.length} de {entries.length}
        </p>
      )}

      {folds && (
        <button
          type="button"
          className={styles.foldBtn}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Ver menos" : `Ver las ${hiddenCount} restantes`}
        </button>
      )}
    </div>
  );
}
