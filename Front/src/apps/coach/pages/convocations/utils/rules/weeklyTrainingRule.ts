import type { Rule, RuleResult, RuleContext } from "./types";

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

const RELIABLE_SEASON_ATTENDANCE = 0.8;

export default function weeklyTrainingRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const { weekStats, weekTrainingCount } = ctx;
  if (weekTrainingCount <= 0 || weekStats.totalTrainings <= 0) return { factors: [], delta: 0 };

  // A player who usually trains is not forced out for missing one week.
  const hasReliableSeasonAttendance =
    weekStats.totalTrainingsSeason > 0 &&
    weekStats.attendedTrainingsSeason / weekStats.totalTrainingsSeason >= RELIABLE_SEASON_ATTENDANCE;
  const noWeeklyAttendance = weekStats.attendedTrainings === 0 && !hasReliableSeasonAttendance;
  const hasKnownUnavailable = weekStats.knownUnavailableTrainings > 0;
  const allWeeklyTrainingsResolved = weekStats.unresolvedTrainings === 0;

  if (noWeeklyAttendance && (hasKnownUnavailable || allWeeklyTrainingsResolved)) {
    const factor = { key: "weeklyTraining", label: "Semana de partido sin asistir a entrenamientos", value: weekStats.attendedTrainings, impact: -100 };
    return { factors: [factor], delta: -100, forced: true };
  }

  // A one-off absence from a player who usually trains is not counted.
  const forgivesOneAbsence = hasReliableSeasonAttendance && weekStats.attendedTrainings < weekStats.totalTrainings;
  const countedAttendedTrainings = weekStats.attendedTrainings + (forgivesOneAbsence ? 1 : 0);
  const weeklyAttendanceRate = clamp01(countedAttendedTrainings / weekStats.totalTrainings);

  const weeklyAttendanceDelta = weeklyAttendanceRate * 12;
  const label = forgivesOneAbsence
    ? "Asistencia semanal a entrenamientos (falta puntual no computada por asistencia habitual)"
    : "Asistencia semanal a entrenamientos";
  const factor = { key: "weeklyTraining", label, value: Number((weeklyAttendanceRate * 100).toFixed(2)), impact: Number(weeklyAttendanceDelta.toFixed(2)) };
  return { factors: [factor], delta: weeklyAttendanceDelta };
}
