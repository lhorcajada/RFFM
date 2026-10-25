import { useId } from "react";
import { Link } from "react-router-dom";
import type { CalendarMatch } from "../../../../federation/types/calendarMatchDay";
import { isPlayed, isSuspended } from "../utils/ownMatch";
import { formatMatchDay } from "../utils/matchDates";
import TeamCrest from "./TeamCrest";
import styles from "./RoundMatchList.module.css";

type Props = {
  title: string;
  matches: CalendarMatch[];
  resolveActaLink: (codacta: string) => string | null;
};

export default function RoundMatchList({ title, matches, resolveActaLink }: Props) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <h2 id={titleId} className={styles.title}>{title}</h2>
      <ul className={styles.list}>
        {matches.map((m, index) => {
          const played = isPlayed(m);
          const suspended = isSuspended(m);
          const code = String(m.matchRecordCode ?? "").trim();
          const actaLink = code ? resolveActaLink(code) : null;
          return (
            <li key={code || `${m.localTeamName}-${m.visitorTeamName}-${index}`} className={styles.card}>
              <div className={styles.row}>
                <span className={`${styles.team} ${styles.home}`}>
                  <span className={styles.teamName}>{m.localTeamName}</span>
                  <TeamCrest name={m.localTeamName} imageUrl={m.localTeamImageUrl} size="sm" />
                </span>
                {played ? (
                  <span className={styles.score}>{`${m.localGoals.trim()} – ${m.visitorGoals.trim()}`}</span>
                ) : (
                  <span className={styles.time}>{m.time?.trim() || "—"}</span>
                )}
                <span className={styles.team}>
                  <TeamCrest name={m.visitorTeamName} imageUrl={m.visitorTeamImageUrl} size="sm" />
                  <span className={styles.teamName}>{m.visitorTeamName}</span>
                </span>
              </div>
              <div className={styles.footer}>
                {suspended && <span className={styles.suspended}>Suspendido</span>}
                <span>{formatMatchDay(m.date)}</span>
                {actaLink && (
                  <Link to={actaLink} className={styles.acta}>
                    Ver acta
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
