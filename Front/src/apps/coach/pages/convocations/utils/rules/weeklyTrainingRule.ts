import type { Rule, RuleResult, RuleContext } from "./types";

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

export default function weeklyTrainingRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const { weekStats, weekTrainingCount } = ctx;
  if (weekTrainingCount <= 0) return { factors: [], delta: 0 };

  const noWeeklyAttendance = weekStats.attendedTrainings === 0;
  const hasKnownUnavailable = weekStats.knownUnavailableTrainings > 0;
  const allWeeklyTrainingsResolved = weekStats.unresolvedTrainings === 0;
  const resolvedWeeklyTrainings = Math.max(0, weekStats.totalTrainings - weekStats.knownUnavailableTrainings - weekStats.unresolvedTrainings);
  const weeklyAttendanceRate = weekStats.totalTrainings > 0
    ? clamp01(weekStats.attendedTrainings / weekStats.totalTrainings)
    : 0;

  if (noWeeklyAttendance && (hasKnownUnavailable || allWeeklyTrainingsResolved)) {
    const factor = { key: "weeklyTraining", label: "Semana de partido sin asistir a entrenamientos", value: weekStats.attendedTrainings, impact: -100 };
    return { factors: [factor], delta: -100, forced: true };
  }

  const weeklyAttendanceDelta = weeklyAttendanceRate * 12;
  const factor = { key: "weeklyTraining", label: "Asistencia semanal a entrenamientos", value: Number((weeklyAttendanceRate * 100).toFixed(2)), impact: Number(weeklyAttendanceDelta.toFixed(2)) };
  return { factors: [factor], delta: weeklyAttendanceDelta };
}
