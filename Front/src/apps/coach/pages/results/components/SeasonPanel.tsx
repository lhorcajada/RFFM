import { CircularProgress } from "@mui/material";
import type { CalendarMatch } from "../../../../federation/types/calendarMatchDay";
import { isSuspended, ownOutcome, ownScore, seasonSummary, type OwnRoundEntry } from "../utils/ownMatch";
import { formatMatchDay } from "../utils/matchDates";
import OutcomeBadge from "./OutcomeBadge";
import TeamCrest from "./TeamCrest";
import styles from "./SeasonPanel.module.css";

export type SeasonRound = {
  number: number;
  entry: OwnRoundEntry | undefined;
};

type Props = {
  rounds: SeasonRound[];
  teamCode: string;
  selectedNumber: number | undefined;
  currentNumber: number | undefined;
  loading: boolean;
  error: boolean;
  onSelect: (number: number) => void;
};

const OUTCOME_LABEL = { V: "victoria", E: "empate", D: "derrota" } as const;

function rivalOf(entry: CalendarMatch, teamCode: string) {
  const isHome = String(entry.localTeamCode).trim() === teamCode.trim();
  return isHome
    ? { isHome, name: entry.visitorTeamName, imageUrl: entry.visitorTeamImageUrl }
    : { isHome, name: entry.localTeamName, imageUrl: entry.localTeamImageUrl };
}

function rowLabel(number: number, entry: OwnRoundEntry | undefined, teamCode: string) {
  if (!entry) return `Jornada ${number}, sin partido`;
  if (entry === "bye") return `Jornada ${number}, descansa`;
  const rival = rivalOf(entry, teamCode);
  const parts = [`Jornada ${number}`, rival.name, rival.isHome ? "casa" : "fuera"];
  const score = ownScore(entry, teamCode);
  const outcome = ownOutcome(entry, teamCode);
  if (isSuspended(entry)) parts.push("suspendido");
  else if (score && outcome) parts.push(`${score.mine}–${score.theirs}`, OUTCOME_LABEL[outcome]);
  else parts.push("por jugar");
  return parts.join(", ");
}

function RowContent({ entry, teamCode }: { entry: OwnRoundEntry | undefined; teamCode: string }) {
  if (!entry || entry === "bye") {
    return (
      <span className={styles.info}>
        <span className={styles.rival}>{entry === "bye" ? "Descansa" : "—"}</span>
      </span>
    );
  }
  const rival = rivalOf(entry, teamCode);
  const day = formatMatchDay(entry.date);
  const score = ownScore(entry, teamCode);
  const outcome = ownOutcome(entry, teamCode);
  let result: React.ReactNode = <span className={styles.pending}>{entry.time?.trim()}</span>;
  if (isSuspended(entry)) result = <span className={styles.suspended}>Suspendido</span>;
  else if (score && outcome)
    result = (
      <>
        <span className={styles.score}>{`${score.mine}–${score.theirs}`}</span>
        <OutcomeBadge outcome={outcome} />
      </>
    );
  return (
    <>
      <TeamCrest name={rival.name} imageUrl={rival.imageUrl} size="sm" />
      <span className={styles.info}>
        <span className={styles.rival}>{rival.name}</span>
        <span className={styles.meta}>{[rival.isHome ? "Casa" : "Fuera", day].filter(Boolean).join(" · ")}</span>
      </span>
      {result}
    </>
  );
}

export default function SeasonPanel({ rounds, teamCode, selectedNumber, currentNumber, loading, error, onSelect }: Props) {
  const byRound = Object.fromEntries(
    rounds.filter((r) => r.entry !== undefined).map((r) => [r.number, r.entry as OwnRoundEntry]),
  );
  const summary = seasonSummary(byRound, teamCode);

  return (
    <aside aria-labelledby="season-panel-title" className={styles.panel}>
      <div className={styles.header}>
        <h2 id="season-panel-title" className={styles.title}>Tu temporada</h2>
        {!loading && !error && (
          <div className={styles.summary}>
            <span className={styles.record}>{`${summary.wins} V · ${summary.draws} E · ${summary.losses} D`}</span>
            <span className={styles.goals}>{`${summary.goalsFor} GF · ${summary.goalsAgainst} GC`}</span>
          </div>
        )}
      </div>
      {loading && (
        <div className={styles.center}>
          <CircularProgress size={28} />
        </div>
      )}
      {!loading && error && <p className={styles.message}>No se ha podido cargar la temporada del equipo.</p>}
      {!loading && !error && (
        <ol className={styles.list}>
          {rounds.map((round) => {
            const isSelected = round.number === selectedNumber;
            const className = [
              styles.row,
              round.number === currentNumber ? styles.current : "",
              isSelected ? styles.selected : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={round.number}>
                <button
                  type="button"
                  className={className}
                  aria-pressed={isSelected}
                  aria-label={rowLabel(round.number, round.entry, teamCode)}
                  onClick={() => onSelect(round.number)}
                >
                  <span className={styles.number} aria-hidden="true">{`J${round.number}`}</span>
                  <RowContent entry={round.entry} teamCode={teamCode} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
