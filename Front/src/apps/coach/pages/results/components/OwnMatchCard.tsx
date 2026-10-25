import { Link } from "react-router-dom";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import type { CalendarMatch } from "../../../../federation/types/calendarMatchDay";
import { isPlayed, isSuspended, ownOutcome, ownScore, type Outcome } from "../utils/ownMatch";
import { formatMatchDay } from "../utils/matchDates";
import OutcomeBadge from "./OutcomeBadge";
import TeamCrest from "./TeamCrest";
import styles from "./OwnMatchCard.module.css";

type Props = {
  match: CalendarMatch | null;
  bye: boolean;
  teamCode: string;
  isCurrentRound: boolean;
  actaLink: string | null;
};

const OUTCOME_WORD: Record<Outcome, string> = { V: "Victoria", E: "Empate", D: "Derrota" };

function Team({ name, imageUrl, own, side }: { name: string; imageUrl: string; own: boolean; side: string }) {
  return (
    <div className={styles.team}>
      <TeamCrest name={name} imageUrl={imageUrl} size="lg" own={own} />
      <div>
        <div className={own ? `${styles.teamName} ${styles.teamNameOwn}` : styles.teamName}>{name}</div>
        <div className={styles.side}>{side}</div>
      </div>
    </div>
  );
}

export default function OwnMatchCard({ match, bye, teamCode, isCurrentRound, actaLink }: Props) {
  const played = match ? isPlayed(match) : false;
  const outcome = match ? ownOutcome(match, teamCode) : null;
  const score = match ? ownScore(match, teamCode) : null;

  let status = "Programado";
  let statusClass = styles.statusScheduled;
  if (match && isSuspended(match)) {
    status = "Suspendido";
    statusClass = styles.statusSuspended;
  } else if (played) {
    status = "Finalizado";
    statusClass = styles.statusPlayed;
  } else if (isCurrentRound) {
    status = "Próximo";
    statusClass = styles.statusCurrent;
  }

  const homeIsOwn = match ? String(match.localTeamCode).trim() === teamCode.trim() : false;
  const day = match ? formatMatchDay(match.date) : "";
  const when = [day, match?.time?.trim()].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="own-match-title" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id="own-match-title" className={styles.sectionTitle}>Tu partido</h2>
        {match && <span className={`${styles.status} ${statusClass}`}>{status}</span>}
      </div>
      <article className={styles.card}>
        {!match && bye && <p className={styles.bye}>Descansa</p>}
        {match && (
          <>
            <div className={styles.teams}>
              <Team name={match.localTeamName} imageUrl={match.localTeamImageUrl} own={homeIsOwn} side="Local" />
              {played ? (
                <div className={styles.score} aria-label={`Marcador ${match.localGoals.trim()} a ${match.visitorGoals.trim()}`}>
                  <span aria-hidden="true">{match.localGoals.trim()}</span>
                  <span aria-hidden="true" className={styles.dash}>–</span>
                  <span aria-hidden="true">{match.visitorGoals.trim()}</span>
                </div>
              ) : (
                <div className={styles.kickoff}>
                  <span className={styles.time}>{match.time?.trim() || "—"}</span>
                  <span className={styles.vs}>vs</span>
                </div>
              )}
              <Team name={match.visitorTeamName} imageUrl={match.visitorTeamImageUrl} own={!homeIsOwn} side="Visitante" />
            </div>
            <div className={styles.meta}>
              {when && (
                <span className={styles.metaItem}>
                  <CalendarTodayOutlinedIcon fontSize="small" aria-hidden="true" />
                  {when}
                </span>
              )}
              {match.field?.trim() && (
                <span className={styles.metaItem}>
                  <PlaceOutlinedIcon fontSize="small" aria-hidden="true" />
                  {match.field.trim()}
                </span>
              )}
            </div>
            {(outcome || actaLink) && (
              <div className={styles.actions}>
                {outcome && score && (
                  <OutcomeBadge outcome={outcome} size="lg">
                    {`${OUTCOME_WORD[outcome]} ${score.mine}–${score.theirs}`}
                  </OutcomeBadge>
                )}
                {actaLink && (
                  <Link to={actaLink} className={styles.acta}>
                    <DescriptionOutlinedIcon fontSize="small" aria-hidden="true" />
                    Ver acta
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </article>
    </section>
  );
}
