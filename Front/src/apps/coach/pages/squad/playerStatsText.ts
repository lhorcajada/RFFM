import type {
  AttributableAbsence,
  AttributableAbsenceKind,
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

export function minutesTargetCaption(player: PlayerStatistics): string {
  return `Partidos no asistidos: ${player.matchesAbsentAttributableToPlayer}`;
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
