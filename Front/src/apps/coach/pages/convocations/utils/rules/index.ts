import type { RuleContext, RuleResult } from "./types";
import injuredRule from "./injuredRule";
import weeklyTrainingRule from "./weeklyTrainingRule";
import recentRecoveryRule from "./recentRecoveryRule";
import { DEFAULT_RULES } from "./defaultRules";
import { resolveRule, type DeconvocationRuleConfig, type RuleCondition } from "./ruleCatalog";

type SingleRule = (ctx: RuleContext, prev: Record<string, RuleResult>, cfg: DeconvocationRuleConfig) => RuleResult;

/** Rules that can force a deconvocation, in the order they run. The other conditions are settings of the funnel. */
const SINGLE_RULES: Array<{ condition: RuleCondition; fn: SingleRule }> = [
  { condition: "injured", fn: injuredRule },
  { condition: "weeklyTraining", fn: weeklyTrainingRule },
  { condition: "recentRecovery", fn: recentRecoveryRule },
];

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
    const cfg = resolveRule(condition, rules);
    if (!cfg) continue;
    const res = safely(() => fn(ctx, prev, cfg));
    prev[condition] = res;
    out.push(res);
  }
  return out;
}

export default runRules;
