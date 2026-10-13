import type {
  AttributableAbsence,
  AttributableAbsenceKind,
  LeagueAbsence,
  PlayerStatistics,
} from "../../services/teamPlayerStatisticsService";
import { formatShortDate, matchTypeLabel } from "../../components/MetricBreakdown/breakdownFormat";

/** Shared text helpers for player statistics — used by both the on-screen SquadStatistics
 * cards and the exported PDF, so the two never drift apart. */

export function injuryLabel(player: PlayerStatistics): string | null {
  if (player.daysSinceLastInjury == null) return null;
  const dur =
    player.lastInjuryDurationDays == null
      ? "en curso"
      : `${player.lastInjuryDurationDays} días de baja`;
  return `Lesión: hace ${player.daysSinceLastInjury} días (${dur})`;
}

export function calledButAbsentLabel(calledButAbsent: number): string | null {
  if (calledButAbsent <= 0) return null;
  return calledButAbsent === 1
    ? "No asistió a 1 partido al que fue convocado"
    : `No asistió a ${calledButAbsent} partidos a los que fue convocado`;
}

export function minutesTargetVerdict(
  player: Pick<PlayerStatistics, "minutesTargetStatus" | "minutesPlayedPercentOfAvailable">,
): string | null {
  const ofAvailable =
    player.minutesPlayedPercentOfAvailable == null
      ? null
      : `${Math.round(player.minutesPlayedPercentOfAvailable)}% de sus minutos disponibles`;
  switch (player.minutesTargetStatus) {
    case "Met":
      return "Cumple el objetivo";
    case "NotMetByOwnAbsences":
      return `No llega por sus ausencias: ${ofAvailable ?? "no ha acudido a ningún partido"}`;
    case "NotMet":
      return `No llega al objetivo: ${ofAvailable ?? "sin minutos disponibles"}`;
    default:
      return null;
  }
}

const ABSENCE_KIND_LABELS: Record<AttributableAbsenceKind, string> = {
  NoShow: "No se presentó",
  Declined: "Rechazó la convocatoria",
};

export function attributableAbsenceLine(absence: AttributableAbsence): string {
  const parts = [
    formatShortDate(absence.date),
    `${matchTypeLabel(absence.eventTypeId)} vs ${absence.opponent}`,
    absence.matchMinutes > 0 ? `${absence.matchMinutes}'` : null,
    ABSENCE_KIND_LABELS[absence.kind],
    absence.reason,
  ];
  return parts.filter((p): p is string => !!p).join(" · ");
}

const LEAGUE_EVENT_TYPE_ID = 1;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function leagueAbsenceReason(absence: Pick<LeagueAbsence, "kind" | "reason">): string {
  const reason = absence.reason ? lowerFirst(absence.reason) : null;
  switch (absence.kind) {
    case "TechnicalDecision":
      return "No asistió por decisión técnica";
    case "NoShow":
      return reason ? `No asistió estando convocado (${reason})` : "No asistió estando convocado";
    default:
      return reason ? `No asistió porque no estaba disponible por ${reason}` : "No asistió porque no estaba disponible";
  }
}

export function leagueAbsenceLine(absence: LeagueAbsence): string {
  return [
    formatShortDate(absence.date),
    `${matchTypeLabel(LEAGUE_EVENT_TYPE_ID)} vs ${absence.opponent}`,
    leagueAbsenceReason(absence),
  ].join(" · ");
}

/** Una línea por partido no asistido, más reciente primero: los de liga con su motivo
 * (`leagueAbsences`) y, del resto de partidos, las ausencias imputables al jugador. */
export function matchAbsenceLines(player: Pick<PlayerStatistics, "leagueAbsences" | "attributableAbsences">): string[] {
  const league = player.leagueAbsences.map((a) => ({ date: a.date, text: leagueAbsenceLine(a) }));
  const others = player.attributableAbsences
    .filter((a) => a.eventTypeId !== LEAGUE_EVENT_TYPE_ID)
    .map((a) => ({ date: a.date, text: attributableAbsenceLine(a) }));
  return [...league, ...others].sort((a, b) => b.date.localeCompare(a.date)).map((line) => line.text);
}
