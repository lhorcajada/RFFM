import { RULE_CONDITIONS, buildDefaultRule, type DeconvocationRuleConfig, type RuleCondition } from "./ruleCatalog";

const KNOWN = new Set<string>(RULE_CONDITIONS);
const ADDED_BY_FUNNEL: RuleCondition[] = ["injuryRest", "otherDeconvocation", "rivalDifficulty"];

/**
 * Brings a saved configuration to the current catalog. A configuration with obsolete conditions (points
 * rules from before the decision funnel) loses them, keeps the texts of the rules that remain, gets the
 * default technical window and receives the rules the funnel added. A current configuration is not touched,
 * so a rule the coach removed stays removed.
 */
export function migrateRules(rules: DeconvocationRuleConfig[]): DeconvocationRuleConfig[] {
  const isLegacy = rules.some((r) => !KNOWN.has(r.condition));
  if (!isLegacy) return rules;

  const kept = rules
    .filter((r) => KNOWN.has(r.condition))
    .map((r) => (r.condition === "recentDeconvocation" ? { ...r, points: { window: buildDefaultRule(r.condition).points.window } } : r));
  const present = new Set(kept.map((r) => r.condition));
  return [...kept, ...ADDED_BY_FUNNEL.filter((c) => !present.has(c)).map(buildDefaultRule)];
}
