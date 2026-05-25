import type { KeyboardEvent } from "react";
import type { NormalizedMatch } from "../types";
import { getMatchResult } from "../helpers/convocationUtils";
import convStyles from "../Convocations.module.css";
import localStyles from "./MatchCard.module.css";

export default function MatchCard({ match, onNavigate }:
  { match: NormalizedMatch; onNavigate: (m: NormalizedMatch) => void }) {
  const result = getMatchResult(match);
  const cardClass = [
    convStyles.matchCard,
    result === "won"  ? convStyles.matchCardWon  : "",
    result === "draw" ? convStyles.matchCardDraw : "",
    result === "lost" ? convStyles.matchCardLost : "",
  ].filter(Boolean).join(" ");

  const statusClass = [
    convStyles.matchStatus,
    result === "won"    ? convStyles.matchStatusWon    : "",
    result === "draw"   ? convStyles.matchStatusDraw   : "",
    result === "lost"   ? convStyles.matchStatusLost   : "",
    result === "played" ? convStyles.matchStatusPlayed : "",
  ].filter(Boolean).join(" ");

  const statusLabel =
    result === "won"  ? "Victoria" :
    result === "draw" ? "Empate"   :
    result === "lost" ? "Derrota"  :
    "Finalizado";

  return (
    <div
      className={cardClass}
      onClick={() => onNavigate(match)}
      role="button"
      tabIndex={0}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => { if ((e as any).key === "Enter") onNavigate(match); }}
    >
      <div className={convStyles.matchCardInner}>
        <div className={convStyles.matchTeamBlock}>
          {match.localTeamShield ? (
            <img
              src={match.localTeamShield}
              alt=""
              className={convStyles.matchTeamShield}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className={convStyles.matchTeamShieldPlaceholder} />
          )}
          <span className={convStyles.matchTeamName}>{match.localTeamName || "—"}</span>
        </div>

        <div className={convStyles.matchScoreBlock}>
          {match.isFinished ? (
            <>
              {match.localGoals !== null && match.visitorGoals !== null ? (
                <span className={convStyles.matchScoreValue}>
                  {match.localGoals}
                  <span className={convStyles.matchScoreDash}>-</span>
                  {match.visitorGoals}
                </span>
              ) : null}
              <span className={statusClass}>{statusLabel}</span>
            </>
          ) : (
            <>
              <span className={convStyles.matchTimePlanned}>{match.time || "--:--"}</span>
              <span className={convStyles.matchTimeLabel}>kick-off</span>
            </>
          )}
        </div>

        <div className={convStyles.matchTeamBlock}>
          {match.visitorTeamShield ? (
            <img
              src={match.visitorTeamShield}
              alt=""
              className={convStyles.matchTeamShield}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className={convStyles.matchTeamShieldPlaceholder} />
          )}
          <span className={convStyles.matchTeamName}>{match.visitorTeamName || "—"}</span>
        </div>
      </div>

      {match.field && (
        <div className={convStyles.matchField}>{match.field}</div>
      )}
    </div>
  );
}
