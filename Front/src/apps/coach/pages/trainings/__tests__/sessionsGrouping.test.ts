import { describe, expect, it } from "vitest";
import { groupSessions } from "../sessionsGrouping";
import type { TrainingSession } from "../../../types/training";

function session(overrides: Partial<TrainingSession> & { id: string }): TrainingSession {
  return {
    name: overrides.id,
    description: "",
    date: null,
    startTime: null,
    isAssociatedToPlan: false,
    exerciseCount: 0,
    targets: [],
    ...overrides,
  };
}

function planned(
  id: string,
  date: string | null,
  micro: { id: string; order: number },
  meso: { id: string; order: number },
  macro: { id: string; order: number },
): TrainingSession {
  return session({
    id,
    date,
    isAssociatedToPlan: true,
    microcicloId: micro.id,
    microcicloWeekLabel: `Semana ${micro.order}`,
    microcicloOrder: micro.order,
    mesocicloId: meso.id,
    mesocicloName: `Mesociclo ${meso.order}`,
    mesocicloOrder: meso.order,
    macrocicloId: macro.id,
    macrocicloName: `Macrociclo ${macro.order}`,
    macrocicloOrder: macro.order,
  });
}

const macro1 = { id: "ma1", order: 1 };
const macro2 = { id: "ma2", order: 2 };
const meso1 = { id: "me1", order: 1 };
const meso2 = { id: "me2", order: 2 };
const meso3 = { id: "me3", order: 1 };
const micro1 = { id: "mi1", order: 1 };
const micro2 = { id: "mi2", order: 2 };
const micro3 = { id: "mi3", order: 1 };
const micro4 = { id: "mi4", order: 1 };

describe("groupSessions", () => {
  it("agrupa las sesiones del plan por macrociclo, mesociclo y microciclo", () => {
    const groups = groupSessions([
      planned("a", "2026-09-02", micro1, meso1, macro1),
      planned("b", "2026-09-04", micro1, meso1, macro1),
    ]);

    expect(groups.macrociclos).toHaveLength(1);
    expect(groups.macrociclos[0].name).toBe("Macrociclo 1");
    expect(groups.macrociclos[0].mesociclos[0].name).toBe("Mesociclo 1");
    expect(groups.macrociclos[0].mesociclos[0].microciclos[0].label).toBe("Semana 1");
    expect(groups.macrociclos[0].mesociclos[0].microciclos[0].sessions.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("ordena macrociclos, mesociclos y microciclos del más reciente al más antiguo", () => {
    const groups = groupSessions([
      planned("a", "2026-09-02", micro1, meso1, macro1),
      planned("b", "2026-09-09", micro2, meso1, macro1),
      planned("c", "2026-10-02", micro3, meso2, macro1),
      planned("d", "2027-01-02", micro4, meso3, macro2),
    ]);

    expect(groups.macrociclos.map((m) => m.id)).toEqual(["ma2", "ma1"]);
    expect(groups.macrociclos[1].mesociclos.map((m) => m.id)).toEqual(["me2", "me1"]);
    expect(groups.macrociclos[1].mesociclos[1].microciclos.map((m) => m.id)).toEqual(["mi2", "mi1"]);
  });

  it("deja las sesiones sin microciclo en libres, primero las sin fecha y luego de la más reciente a la más antigua", () => {
    const groups = groupSessions([
      session({ id: "old", date: "2026-09-01" }),
      session({ id: "unscheduled", date: null }),
      session({ id: "recent", date: "2026-10-01" }),
      planned("p", "2026-09-02", micro1, meso1, macro1),
    ]);

    expect(groups.free.map((s) => s.id)).toEqual(["unscheduled", "recent", "old"]);
  });

  it("no crea grupos de plan cuando no hay sesiones asignadas a microciclos", () => {
    const groups = groupSessions([session({ id: "x", date: "2026-09-01" })]);

    expect(groups.macrociclos).toEqual([]);
  });
});
