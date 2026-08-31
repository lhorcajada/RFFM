import type { KeyboardEvent } from "react";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HandshakeIcon from "@mui/icons-material/Handshake";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import type { NormalizedMatch } from "../types";
import type { EventAttendanceSummaryDto } from "../../../services/eventAttendanceSummaryService";
import { getMatchResult } from "../helpers/convocationUtils";
import { EventAttendanceBadges } from "../../../components/EventAttendanceBadges/EventAttendanceBadges";
import convStyles from "../Convocations.module.css";
import localStyles from "./MatchCard.module.css";

interface Props {
  match: NormalizedMatch;
  onNavigate: (m: NormalizedMatch) => void;
  attendanceSummary?: EventAttendanceSummaryDto;
  isPlayer?: boolean;
}

const CATEGORY_META: Record<
  "League" | "Friendly" | "Tournament",
  { label: string; className: string; icon: typeof SportsSoccerIcon }
> = {
  League: { label: "Liga", className: "categoryChipLeague", icon: SportsSoccerIcon },
  Friendly: { label: "Amistoso", className: "categoryChipFriendly", icon: HandshakeIcon },
  Tournament: { label: "Torneo", className: "categoryChipTournament", icon: EmojiEventsIcon },
};

export default function MatchCard({ match, onNavigate, attendanceSummary, isPlayer }: Props) {
  const result = getMatchResult(match);
  const categoryMeta = match.matchCategory ? CATEGORY_META[match.matchCategory] : null;
  const CategoryIcon = categoryMeta?.icon;
  const cardClass = [
    convStyles.matchCard,
    isPlayer ? localStyles.nonInteractive : "",
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
      onClick={isPlayer ? undefined : () => onNavigate(match)}
      role={isPlayer ? undefined : "button"}
      tabIndex={isPlayer ? undefined : 0}
      onKeyDown={isPlayer ? undefined : (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter") onNavigate(match);
      }}
    >
      {categoryMeta && CategoryIcon && (
        <span
          className={`${localStyles.categoryChip} ${localStyles[categoryMeta.className] ?? ""}`}
        >
          <CategoryIcon className={localStyles.categoryChipIcon} />
          {categoryMeta.label}
        </span>
      )}

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
      {match.eventId && attendanceSummary && (
        <EventAttendanceBadges summary={attendanceSummary} isPlayer={!!isPlayer} />
      )}
    </div>
  );
}
