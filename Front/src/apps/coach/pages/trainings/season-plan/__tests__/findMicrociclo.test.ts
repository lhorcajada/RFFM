import { describe, expect, it } from "vitest";
import { findMicrocicloByApiId } from "../findMicrociclo";
import type { Microciclo, SeasonPlan } from "../../../../types/seasonPlan";

function microciclo(apiId: string, weekLabel: string): Microciclo {
  return {
    id: -1,
    apiId,
    order: 1,
    weekLabel,
    startDate: "2026-09-07",
    endDate: "2026-09-13",
    sessions: [],
    weeklyObjective: [],
  };
}

const plan: SeasonPlan = {
  id: "plan-1",
  teamId: "team-1",
  seasonId: "season-1",
  macrociclos: [
    {
      id: -1,
      order: 1,
      name: "Macro 1",
      startDate: "2026-09-01",
      endDate: "2026-12-31",
      mesociclos: [
        { id: -2, order: 1, name: "Meso 1", startDate: "", endDate: "", gameZoneId: 1, microciclos: [microciclo("m-1", "Semana 1")] },
      ],
    },
    {
      id: -3,
      order: 2,
      name: "Macro 2",
      startDate: "2027-01-01",
      endDate: "2027-06-30",
      mesociclos: [
        { id: -4, order: 1, name: "Meso 2", startDate: "", endDate: "", gameZoneId: 2, microciclos: [microciclo("m-2", "Semana 20")] },
      ],
    },
  ],
};

describe("findMicrocicloByApiId", () => {
  it("encuentra el microciclo por su id de backend en cualquier macrociclo", () => {
    expect(findMicrocicloByApiId(plan, "m-2")?.weekLabel).toBe("Semana 20");
  });

  it("devuelve null cuando el id no existe en el plan", () => {
    expect(findMicrocicloByApiId(plan, "no-existe")).toBeNull();
  });

  it("devuelve null cuando no hay plan", () => {
    expect(findMicrocicloByApiId(null, "m-1")).toBeNull();
  });
});
