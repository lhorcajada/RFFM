import type { RuleContext, RuleResult } from './types';
import * as streakRuleMod from './streakRule';
import * as technicalTotalRuleMod from './technicalTotalRule';
import * as combinedRuleMod from './combinedRule';
import * as minimumRuleMod from './minimumRule';
import * as rivalResultRuleMod from './rivalResultRule';
import * as injuredRuleMod from './injuredRule';
import * as weeklyTrainingRuleMod from './weeklyTrainingRule';
import * as recentRecoveryRuleMod from './recentRecoveryRule';
import * as goalsRuleMod from './goalsRule';

type NamedRule = { name: string; fn: (ctx: RuleContext, prev: Record<string, RuleResult>) => RuleResult };

const RULES: NamedRule[] = [
  { name: 'streak', fn: (streakRuleMod as any).default ?? (streakRuleMod as any) },
  { name: 'technicalTotal', fn: (technicalTotalRuleMod as any).default ?? (technicalTotalRuleMod as any) },
  { name: 'combined', fn: (combinedRuleMod as any).default ?? (combinedRuleMod as any) },
  { name: 'goals', fn: (goalsRuleMod as any).default ?? (goalsRuleMod as any) },
  { name: 'minimum', fn: (minimumRuleMod as any).default ?? (minimumRuleMod as any) },
  { name: 'rivalResult', fn: (rivalResultRuleMod as any).default ?? (rivalResultRuleMod as any) },
  { name: 'injured', fn: (injuredRuleMod as any).default ?? (injuredRuleMod as any) },
  { name: 'weeklyTraining', fn: (weeklyTrainingRuleMod as any).default ?? (weeklyTrainingRuleMod as any) },
  { name: 'recentRecovery', fn: (recentRecoveryRuleMod as any).default ?? (recentRecoveryRuleMod as any) },
];

export function runRules(ctx: RuleContext): RuleResult[] {
  const prev: Record<string, RuleResult> = {};
  const out: RuleResult[] = [];
  for (const r of RULES) {
    try {
      const res = r.fn(ctx, prev);
      prev[r.name] = res;
      out.push(res);
    } catch (e) {
      // Fail-safe: if a rule throws, continue with empty result
      prev[r.name] = { factors: [], delta: 0 };
      out.push({ factors: [], delta: 0 });
    }
  }
  return out;
}

export default runRules;
