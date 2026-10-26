import React, { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./EventCard.module.css";
import { SportEventResponse } from "../../services/sportEventService";
import { EventAttendanceBadges } from "../../components/EventAttendanceBadges/EventAttendanceBadges";
import type { EventAttendanceSummaryDto } from "../../services/eventAttendanceSummaryService";
import { resolveStorageUrl } from "../../../../shared/utils/resolveStorageUrl";
import { TRAINING_TYPE_LABELS, TrainingTypeCode } from "./trainingTypes";

interface Props {
  event: SportEventResponse;
  eventTypeName?: string | undefined | null;
  attendanceSummary?: EventAttendanceSummaryDto;
  isPlayer?: boolean;
  /** Smaller variant for read-only previews. */
  compact?: boolean;
}

const TRAINING_ORDER: TrainingTypeCode[] = ["Fisico", "Tactico", "Tecnico"];

function getTrainingLabel(trainingTypes: string[] | null | undefined): string | null {
  if (!trainingTypes || trainingTypes.length === 0) return null;
  const valid = TRAINING_ORDER.filter((code) => trainingTypes.includes(code));
  if (valid.length === 0) return null;
  return valid.map((code) => TRAINING_TYPE_LABELS[code]).join(" + ");
}

function getStripeClass(eventTypeName: string, isMatch: boolean): string {
  const name = eventTypeName.toLowerCase();
  if (isMatch) return styles.stripeMatch;
  if (name.includes("entrenamiento")) return styles.stripeTraining;
  if (name.includes("torneo") || name.includes("competici")) return styles.stripeTournament;
  return styles.stripeDefault;
}

type MatchResult = "won" | "draw" | "lost" | null;
function getMatchResult(event: SportEventResponse): MatchResult {
  const lg = event.localGoals;
  const vg = event.visitorGoals;
  if (lg == null || lg === "" || vg == null || vg === "") return null;
  const lNum = parseInt(lg, 10);
  const vNum = parseInt(vg, 10);
  if (isNaN(lNum) || isNaN(vNum)) return null;
  const isHome = event.isHomeMatch !== false;
  const myGoals = isHome ? lNum : vNum;
  const theirGoals = isHome ? vNum : lNum;
  if (myGoals > theirGoals) return "won";
  if (myGoals === theirGoals) return "draw";
  return "lost";
}

function ShieldImg({ src, alt }: { src: string; alt: string }) {
  const [hidden, setHidden] = useState(false);
  if (!src || hidden) return <div className={styles.shieldPlaceholder} />;
  return <img src={src} alt={alt} className={styles.shield} onError={() => setHidden(true)} />;
}

function parseDate(input?: string | number | null): Date | null {
  if (input == null) return null;
  try {
    if (typeof input === "number") {
      const d = new Date(input);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof input === "string") {
      const s = input.trim();
      const msMatch = s.match(/\/Date\((-?\d+)\)\//);
      if (msMatch) {
        const d = new Date(Number(msMatch[1]));
        if (!isNaN(d.getTime())) return d;
      }
      if (/^-?\d+$/.test(s)) {
        const d = new Date(Number(s));
        if (!isNaN(d.getTime())) return d;
      }
      let candidate = s;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) candidate = s + "T00:00:00";
      let d = new Date(candidate);
      if (!isNaN(d.getTime())) return d;
      d = new Date(s.replace(" ", "T"));
      if (!isNaN(d.getTime())) return d;
    }
  } catch {
    // ignore
  }
  return null;
}

const RESULT_LABELS: Record<Exclude<MatchResult, null>, string> = {
  won: "Victoria",
  draw: "Empate",
  lost: "Derrota",
};

export default function EventCard({ event, eventTypeName, attendanceSummary, isPlayer, compact }: Props) {
  const rawStart = event.startTime ?? event.start ?? event.eveDateTime ?? null;
  const startDate = parseDate(rawStart ?? undefined);
  const weekday = startDate
    ? startDate.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")
    : "";
  const dayNumber = startDate ? String(startDate.getDate()).padStart(2, "0") : "";
  const startTimeStr = startDate
    ? startDate.toLocaleTimeString("es-ES", { timeStyle: "short" })
    : "";

  const isMatch = (eventTypeName ?? "").toLowerCase().includes("partido");
  const isTraining = (eventTypeName ?? "").toLowerCase().includes("entrenamiento");

  const arrivalDate = parseDate(event.arrivalDate ?? event.arrival ?? undefined);
  const arrivalTimeStr = arrivalDate
    ? arrivalDate.toLocaleTimeString("es-ES", { timeStyle: "short" })
    : "";

  const isHome = event.isHomeMatch === true;
  const isAway = event.isHomeMatch === false;
  const myTeamName = event.teamName ?? "";
  const myTeamShield = resolveStorageUrl(event.teamPhotoUrl);
  const rivalName = event.rivalName ?? "";
  const rivalShield = resolveStorageUrl(event.rivalPhotoUrl);
  const hasScore =
    event.localGoals != null && event.localGoals !== "" &&
    event.visitorGoals != null && event.visitorGoals !== "";

  // Score in DB is always local-visitor: when away the rival is the local team.
  const leftTeamName = isAway ? rivalName : myTeamName;
  const leftShield = isAway ? rivalShield : myTeamShield;
  const rightTeamName = isAway ? myTeamName : rivalName;
  const rightShield = isAway ? myTeamShield : rivalShield;

  // A league match's eveDateTime may be RFFM's placeholder date before the kickoff
  // time is published: only event.startTime means a real, known time.
  const kickoffTimeStr =
    isMatch && event.startTime
      ? (parseDate(event.startTime)?.toLocaleTimeString("es-ES", { timeStyle: "short" }) ?? "")
      : "";
  const blockTime = isMatch ? kickoffTimeStr : startTimeStr;

  const matchResult = isMatch ? getMatchResult(event) : null;
  const trainingLabel = isTraining ? getTrainingLabel(event.trainingTypes) : null;

  return (
    <div
      className={`${styles.card} ${compact ? styles.compact : ""} ${
        isTraining
          ? event.hasConvokedPlayers
            ? styles.cardConvocationOpen
            : styles.cardConvocationPending
          : ""
      }`}
    >
      <Link
        to={`/coach/attendance/${encodeURIComponent(String(event.id))}`}
        className={styles.cardLink}
        aria-label={`Abrir evento ${event.title}`}
      />
      <div className={`${styles.stripe} ${getStripeClass(eventTypeName ?? "", isMatch)}`} />
      <div className={styles.dateBlock}>
        {startDate ? (
          <>
            <span className={styles.dateWeekday}>{weekday}</span>
            <span className={styles.dateDay}>{dayNumber}</span>
            {blockTime && !hasScore && <span className={styles.dateTime}>{blockTime}</span>}
          </>
        ) : (
          <span className={styles.dateUnknown}>Por confirmar</span>
        )}
      </div>
      <div className={styles.content}>
        <div className={styles.topRow}>
          {eventTypeName && <span className={styles.typeLabel}>{eventTypeName}</span>}
          {isHome && <span className={styles.tag}>Local</span>}
          {isAway && <span className={styles.tag}>Visitante</span>}
          {isTraining && (
            <span
              className={`${styles.tag} ${
                event.hasConvokedPlayers ? styles.convocationOpen : styles.convocationPending
              }`}
            >
              {event.hasConvokedPlayers ? "Convocatoria abierta" : "Convocatoria sin iniciar"}
            </span>
          )}
          {trainingLabel && <span className={styles.tag}>{trainingLabel}</span>}
        </div>

        {isMatch ? (
          <div className={styles.matchRow}>
            <div className={styles.matchTeam}>
              <ShieldImg src={leftShield} alt={leftTeamName} />
              <span className={styles.matchTeamName} data-testid="match-team-name">
                {leftTeamName || (isAway ? "Rival" : "Mi equipo")}
              </span>
            </div>
            <div className={styles.matchCenter}>
              {hasScore ? (
                <span className={styles.matchScore}>{`${event.localGoals} – ${event.visitorGoals}`}</span>
              ) : (
                <span className={styles.matchVs}>vs</span>
              )}
              {matchResult && (
                <span
                  className={`${styles.result} ${
                    matchResult === "won" ? styles.resultWon :
                    matchResult === "draw" ? styles.resultDraw :
                    styles.resultLost
                  }`}
                >
                  {RESULT_LABELS[matchResult]}
                </span>
              )}
            </div>
            <div className={`${styles.matchTeam} ${styles.matchTeamRight}`}>
              <span className={styles.matchTeamName} data-testid="match-team-name">
                {rightTeamName || (isAway ? "Mi equipo" : "Rival")}
              </span>
              <ShieldImg src={rightShield} alt={rightTeamName} />
            </div>
          </div>
        ) : (
          <div className={styles.title} title={event.title}>{event.title}</div>
        )}

        {(event.location || arrivalTimeStr) && (
          <div className={styles.locationRow}>
            {event.location && (
              <span className={styles.location} title={event.location}>
                {event.locationMapUrl ? (
                  <a
                    className={styles.locationLink}
                    href={event.locationMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {event.location}
                  </a>
                ) : (
                  event.location
                )}
              </span>
            )}
            {arrivalTimeStr && <span className={styles.arrival}>{`Llegada ${arrivalTimeStr}`}</span>}
          </div>
        )}
        {!isMatch && event.rivalName && (
          <div className={styles.rival} title={event.rivalName}>
            <span className={styles.rivalLabel}>Rival:</span> {event.rivalName}
          </div>
        )}
        {event.name && event.name !== event.title && (
          <div className={styles.eventName} title={event.name}>{event.name}</div>
        )}
        {event.description && (
          <div className={styles.description} title={event.description}>{event.description}</div>
        )}
        <div className={styles.bottomTags}>
          <EventAttendanceBadges
            summary={attendanceSummary}
            isPlayer={!!isPlayer}
            isLeagueMatch={event.matchCategory === "League"}
          />
        </div>
      </div>
    </div>
  );
}
