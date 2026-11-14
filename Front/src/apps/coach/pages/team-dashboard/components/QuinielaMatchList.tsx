import type { QuinielaMatchRow, TicketSummary } from "../utils/quinielaMatchResults";
import { formatKickoff } from "../../quiniela/quinielaHelpers";
import styles from "./QuinielaMatchList.module.css";

type Props = {
  rows: QuinielaMatchRow[];
  summaries: TicketSummary[];
};

const OUTCOME_LABEL = { hit: "acierto", miss: "fallo" } as const;

function summaryText(s: TicketSummary): string {
  const hits = `${s.hits} ${s.hits === 1 ? "acierto" : "aciertos"}`;
  const played = `${s.played} ${s.played === 1 ? "partido jugado" : "partidos jugados"}`;
  return `${hits} de ${played}`;
}

export default function QuinielaMatchList({ rows, summaries }: Props) {
  if (rows.length === 0) return null;
  const severalTickets = rows[0].picks.length > 1;
  const visibleSummaries = summaries.filter((s) => s.played > 0);

  return (
    <div className={styles.wrapper}>
      <h4 className={styles.heading}>Partidos de la quiniela</h4>
      {visibleSummaries.length > 0 && (
        <ul className={styles.summaries}>
          {visibleSummaries.map((s) => (
            <li key={s.number} className={styles.summary}>
              {severalTickets ? `Boleto ${s.number}: ` : ""}
              {summaryText(s)}
            </li>
          ))}
        </ul>
      )}
      <ol className={styles.list} aria-label="Partidos de la quiniela">
        {rows.map((row) => (
          <li key={row.recordCode} className={styles.row}>
            <span className={styles.teams}>
              <span className={styles.team}>{row.homeTeam}</span>
              <span className={styles.team}>{row.awayTeam}</span>
            </span>
            <span className={styles.state}>
              {row.status === "final" && <strong className={styles.score}>{row.score}</strong>}
              {row.status === "live" && <span className={styles.live}>En juego</span>}
              {row.status === "upcoming" && <span className={styles.when}>{formatKickoff(row.kickoffUtc)}</span>}
              {row.isPleno && <span className={styles.pleno}>Pleno</span>}
            </span>
            {row.picks.some((p) => p.sign) && (
              <span className={styles.picks}>
                {row.picks.map((p) => {
                  if (!p.sign) return null;
                  const outcome = p.outcome === "hit" || p.outcome === "miss" ? OUTCOME_LABEL[p.outcome] : null;
                  const label = [
                    severalTickets ? `Boleto ${p.ticketNumber}: ` : "",
                    `pronóstico ${p.sign}`,
                    outcome ? `, ${outcome}` : "",
                  ].join("");
                  return (
                    <span
                      key={p.ticketNumber}
                      aria-label={severalTickets ? label : label.replace(/^pronóstico/, "Pronóstico")}
                      className={`${styles.pick} ${
                        p.outcome === "hit" ? styles.hit : p.outcome === "miss" ? styles.miss : ""
                      } ${p.participates ? "" : styles.inactive}`}
                    >
                      {severalTickets && <span className={styles.ticketNo}>{`B${p.ticketNumber}`}</span>}
                      <span>{p.sign}</span>
                      {p.outcome === "hit" && <span aria-hidden="true">✓</span>}
                      {p.outcome === "miss" && <span aria-hidden="true">✗</span>}
                    </span>
                  );
                })}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
