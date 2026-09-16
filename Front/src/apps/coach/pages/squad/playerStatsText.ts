import type { PlayerStatistics } from "../../services/teamPlayerStatisticsService";

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
  const matches = player.matchesAbsentAttributableToPlayer;
  if (matches <= 0) {
    return "No ha faltado a ningún partido por su cuenta esta temporada.";
  }
  const percent = Math.round(player.attributableAbsentMinutesPercentOfSeasonTotal ?? 0);
  const matchesLabel = matches === 1 ? "1 partido" : `${matches} partidos`;
  return `Ha dejado de jugar un ${percent}% de esos minutos por faltar a ${matchesLabel} por su cuenta (lesión, no presentarse, etc. — no cuenta si fue decisión del entrenador).`;
}
