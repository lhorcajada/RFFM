import { useCallback, useEffect, useState } from "react";
import { getDeconvocationRules } from "../../../services/deconvocationRulesService";
import { DEFAULT_RULES } from "../utils/rules/defaultRules";
import type { DeconvocationRuleConfig } from "../utils/rules/ruleCatalog";
import { migrateRules } from "../utils/rules/rulesMigration";

type UseDeconvocationRules = {
  /** The team's rules; the default set while loading, when none is saved or when the read fails. */
  rules: DeconvocationRuleConfig[];
  /** Reads the team's current configuration again. */
  reload: () => Promise<void>;
};

export function useDeconvocationRules(teamId: string): UseDeconvocationRules {
  const [saved, setSaved] = useState<DeconvocationRuleConfig[] | null>(null);

  const reload = useCallback(async () => {
    if (!teamId) return;
    try {
      const response = await getDeconvocationRules(teamId);
      setSaved(response.rules ? migrateRules(response.rules) : null);
    } catch {
      setSaved(null);
    }
  }, [teamId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rules: saved ?? DEFAULT_RULES, reload };
}
