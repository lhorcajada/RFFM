import type { RuleResult, RuleContext } from "./types";

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

const RELIABLE_SEASON_ATTENDANCE = 0.8;
const WEEKLY_ATTENDANCE_MAX_POINTS = 12;

export default function weeklyTrainingRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const { weekStats } = ctx;
  if (weekStats.totalTrainings <= 0) return { factors: [], delta: 0 };

  // A player who usually trains is not forced out for missing one week.
  const hasReliableSeasonAttendance =
    weekStats.totalTrainingsSeason > 0 &&
    weekStats.weightedAttendedTrainingsSeason / weekStats.totalTrainingsSeason >= RELIABLE_SEASON_ATTENDANCE;
  const noWeeklyAttendance = weekStats.attendedTrainings === 0 && !hasReliableSeasonAttendance;
  const hasAbsenceForcingDeconvocation = weekStats.knownUnavailableTrainings > 0;

  if (noWeeklyAttendance && hasAbsenceForcingDeconvocation) {
    const factor = { key: "weeklyTraining", label: "Semana de partido sin asistir a entrenamientos", value: weekStats.attendedTrainings, impact: -100 };
    return { factors: [factor], delta: -100, forced: true };
  }

  const weeklyAttendanceRate = clamp01(weekStats.weightedAttendedTrainings / weekStats.totalTrainings);
  const weeklyAttendanceDelta = weeklyAttendanceRate * WEEKLY_ATTENDANCE_MAX_POINTS;
  const factor = {
    key: "weeklyTraining",
    label: "Puntos por asistencia a entrenamientos y amistosos",
    value: Number((weeklyAttendanceRate * 100).toFixed(2)),
    impact: Number(weeklyAttendanceDelta.toFixed(2)),
  };
  return { factors: [factor], delta: weeklyAttendanceDelta };
}
