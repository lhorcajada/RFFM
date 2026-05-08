import type { Rule, RuleResult, RuleContext } from "./types";

function diffDays(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

export default function recentRecoveryRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const { lastInjuryEndMap, player, currentIso } = ctx;
  const lastInjuryEnd = lastInjuryEndMap.get(ctx.playerId) ?? null;
  if (!player.isInjured && currentIso && lastInjuryEnd) {
    const days = diffDays(lastInjuryEnd.slice(0, 10), currentIso);
    if (days >= 0 && days <= 7) {
      const factor = { key: "recentRecovery", label: "Solo una semana desde el alta de lesión", value: days, impact: -100 };
      return { factors: [factor], delta: -100, forced: true };
    }
  }
  return { factors: [], delta: 0 };
}
