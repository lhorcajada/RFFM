import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, type DeconvocationRuleConfig } from "./ruleCatalog";

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
    const factor = { key: "weeklyTraining", label: rule.text, value: weekStats.attendedTrainings, impact: 0 };
    return { factors: [factor], delta: 0, forced: true };
  }
  return { factors: [], delta: 0 };
}
