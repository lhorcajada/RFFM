import client from "../../../core/api/client";
import type { DeconvocationRuleConfig } from "../pages/convocations/utils/rules/ruleCatalog";

export type DeconvocationRulesResponse = {
  /** `null` when the team has no saved configuration (the default set applies). */
  rules: DeconvocationRuleConfig[] | null;
  isDefault: boolean;
};

const url = (teamId: string) => `/api/teams/${encodeURIComponent(teamId)}/deconvocation-rules`;

export async function getDeconvocationRules(teamId: string): Promise<DeconvocationRulesResponse> {
  const res = await client.get<DeconvocationRulesResponse>(url(teamId));
  return res.data;
}

export async function saveDeconvocationRules(
  teamId: string,
  rules: DeconvocationRuleConfig[],
): Promise<DeconvocationRulesResponse> {
  const res = await client.put<DeconvocationRulesResponse>(url(teamId), { rules });
  return res.data;
}

export async function resetDeconvocationRules(teamId: string): Promise<void> {
  await client.delete(url(teamId));
}
