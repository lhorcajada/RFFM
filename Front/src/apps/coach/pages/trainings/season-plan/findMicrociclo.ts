import type { Microciclo, SeasonPlan } from "../../../types/seasonPlan";

export function findMicrocicloByApiId(plan: SeasonPlan | null, apiId: string): Microciclo | null {
  if (!plan) return null;
  for (const macrociclo of plan.macrociclos) {
    for (const mesociclo of macrociclo.mesociclos) {
      const found = mesociclo.microciclos.find((m) => m.apiId === apiId);
      if (found) return found;
    }
  }
  return null;
}
