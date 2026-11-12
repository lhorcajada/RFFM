import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, type DeconvocationRuleConfig } from "./ruleCatalog";

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

export default function weeklyTrainingRule(
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  cfg: DeconvocationRuleConfig = buildDefaultRule("weeklyTraining"),
): RuleResult {
  const rule = resolveRule("weeklyTraining", [cfg])!;
  const { weekStats } = ctx;
  if (weekStats.totalTrainings <= 0) return { factors: [], delta: 0 };

  // A player who usually trains is not forced out for missing one week.
  const hasReliableSeasonAttendance =
    weekStats.totalTrainingsSeason > 0 &&
    weekStats.weightedAttendedTrainingsSeason / weekStats.totalTrainingsSeason >= rule.weights.reliableAttendance;
  const noWeeklyAttendance = weekStats.attendedTrainings === 0 && !hasReliableSeasonAttendance;
  const hasAbsenceForcingDeconvocation = weekStats.knownUnavailableTrainings > 0;

  if (noWeeklyAttendance && hasAbsenceForcingDeconvocation) {
    const factor = { key: "weeklyTraining", label: "Semana de partido sin asistir a entrenamientos", value: weekStats.attendedTrainings, impact: rule.points.forced };
    return { factors: [factor], delta: rule.points.forced, forced: true };
  }

  const weeklyAttendanceRate = clamp01(weekStats.weightedAttendedTrainings / weekStats.totalTrainings);
  const weeklyAttendanceDelta = weeklyAttendanceRate * rule.points.maxAttendance;
  const factor = {
    key: "weeklyTraining",
    label: rule.text,
    format: "percent" as const,
    value: Number((weeklyAttendanceRate * 100).toFixed(2)),
    impact: Number(weeklyAttendanceDelta.toFixed(2)),
  };
  return { factors: [factor], delta: weeklyAttendanceDelta };
}
