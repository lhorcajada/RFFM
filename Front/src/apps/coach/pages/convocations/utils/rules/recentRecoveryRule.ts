import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, type DeconvocationRuleConfig } from "./ruleCatalog";
import { daysIntoRecovery, isInjuryAbsence, isLongInjury } from "../injuryRecovery";

function alreadyMissedPreviousMatchAndTraining(ctx: RuleContext): boolean {
  const previousMatch = ctx.seasonColumns[0];
  const previousCell = previousMatch ? ctx.enrichedGrid.get(previousMatch.eventId)?.get(ctx.playerId) : undefined;
  return isInjuryAbsence(previousCell) && ctx.weekStats.attendedTrainings > 0;
}

export default function recentRecoveryRule(
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  cfg: DeconvocationRuleConfig = buildDefaultRule("recentRecovery"),
): RuleResult {
  const rule = resolveRule("recentRecovery", [cfg])!;
  const { lastInjuryEndMap, lastInjuryStartMap, lastInjuryMissedEventsMap, player, currentIso } = ctx;
  const lastInjuryEnd = lastInjuryEndMap.get(ctx.playerId) ?? null;
  // A short injury during a rest period (no trainings or matches missed) does not count.
  const missedNoEvents = lastInjuryMissedEventsMap?.get(ctx.playerId) === 0;
  const days = daysIntoRecovery(lastInjuryEnd, currentIso);
  if (player.isInjured || days === null || missedNoEvents) return { factors: [], delta: 0 };

  // Short injuries are not punished twice: a player who already missed the previous match and is back
  // training this week is protected by the injury rest window, not forced out.
  const longInjury = isLongInjury(lastInjuryStartMap?.get(ctx.playerId), lastInjuryEnd);
  if (!longInjury && alreadyMissedPreviousMatchAndTraining(ctx)) return { factors: [], delta: 0 };

  const label = longInjury ? rule.text : "Solo una semana desde el alta de lesión";
  const factor = { key: "recentRecovery", label, value: days, impact: 0 };
  return { factors: [factor], delta: 0, forced: true };
}
