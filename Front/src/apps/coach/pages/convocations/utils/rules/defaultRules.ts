import { RULE_CONDITIONS, buildDefaultRule, type DeconvocationRuleConfig } from "./ruleCatalog";

/** Default rule set: reproduces the values the proposal used before rules became configurable. */
export const DEFAULT_RULES: DeconvocationRuleConfig[] = RULE_CONDITIONS.map(buildDefaultRule);
