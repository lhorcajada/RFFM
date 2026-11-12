import type { RuleContext, RuleResult } from "./types";
import streakRule from "./streakRule";
import technicalTotalRule from "./technicalTotalRule";
import combinedRule from "./combinedRule";
import minimumRule from "./minimumRule";
import rivalResultRule from "./rivalResultRule";
import injuredRule from "./injuredRule";
import weeklyTrainingRule from "./weeklyTrainingRule";
import recentRecoveryRule from "./recentRecoveryRule";
import goalsRule from "./goalsRule";
import recentDeconvocationRule from "./recentDeconvocationRule";
import { DEFAULT_RULES } from "./defaultRules";
import { resolveRule, type DeconvocationRuleConfig, type RuleCondition } from "./ruleCatalog";

type SingleRule = (ctx: RuleContext, prev: Record<string, RuleResult>, cfg: DeconvocationRuleConfig) => RuleResult;

/** Rules in the order they run. `combined` groups the rating, necessity and season-attendance conditions. */
const SINGLE_RULES: Array<{ condition: RuleCondition | "combined"; fn?: SingleRule }> = [
  { condition: "streak", fn: streakRule },
  { condition: "technicalTotal", fn: technicalTotalRule },
  { condition: "combined" },
  { condition: "goals", fn: goalsRule },
  { condition: "minimum", fn: minimumRule },
  { condition: "rivalResult", fn: rivalResultRule },
  { condition: "injured", fn: injuredRule },
  { condition: "weeklyTraining", fn: weeklyTrainingRule },
  { condition: "recentRecovery", fn: recentRecoveryRule },
  { condition: "recentDeconvocation", fn: recentDeconvocationRule },
];

const COMBINED_CONDITIONS: RuleCondition[] = ["rating", "necessity", "weeklyTrainingAccum"];
const EMPTY: RuleResult = { factors: [], delta: 0 };

function safely(run: () => RuleResult): RuleResult {
  try {
    return run();
  } catch {
    // Fail-safe: if a rule throws, continue with an empty result
    return EMPTY;
  }
}

/** Runs the team's configured rules (the default set when none is given). A missing rule does not apply. */
export function runRules(ctx: RuleContext, rules: DeconvocationRuleConfig[] = DEFAULT_RULES): RuleResult[] {
  const prev: Record<string, RuleResult> = {};
  const out: RuleResult[] = [];

  for (const { condition, fn } of SINGLE_RULES) {
    if (condition === "combined") {
      if (!COMBINED_CONDITIONS.some((c) => resolveRule(c, rules))) continue;
      const res = safely(() => combinedRule(ctx, prev, rules));
      prev.combined = res;
      out.push(res);
      continue;
    }
    const cfg = resolveRule(condition, rules);
    if (!cfg || !fn) continue;
    const res = safely(() => fn(ctx, prev, cfg));
    prev[condition] = res;
    out.push(res);
  }
  return out;
}

export default runRules;
