import { describe, expect, it } from "vitest";
import { groupEventsByWeek } from "../groupEventsByWeek";

// Wednesday 28 Oct 2026
const NOW = new Date(2026, 9, 28, 12, 0, 0);

const ev = (id: string, startTime: string) => ({ id, startTime });

describe("groupEventsByWeek", () => {
  it("devuelve una lista vacía cuando no hay eventos", () => {
    expect(groupEventsByWeek([], NOW)).toEqual([]);
  });

  it("agrupa los eventos de la semana actual bajo «Esta semana»", () => {
    const groups = groupEventsByWeek(
      [ev("a", "2026-10-27T18:30:00"), ev("b", "2026-11-01T10:00:00")],
      NOW
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Esta semana");
    expect(groups[0].events.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("etiqueta la semana siguiente como «Próxima semana»", () => {
    const groups = groupEventsByWeek([ev("a", "2026-11-02T18:30:00")], NOW);
    expect(groups[0].label).toBe("Próxima semana");
  });

  it("etiqueta la semana anterior como «Semana pasada»", () => {
    const groups = groupEventsByWeek([ev("a", "2026-10-24T10:00:00")], NOW);
    expect(groups[0].label).toBe("Semana pasada");
  });

  it("etiqueta el resto de semanas con el lunes de esa semana", () => {
    const groups = groupEventsByWeek([ev("a", "2026-11-12T18:30:00")], NOW);
    expect(groups[0].label).toBe("Semana del 9 nov");
  });

  it("indica el rango lunes–domingo de cada grupo", () => {
    const groups = groupEventsByWeek([ev("a", "2026-10-27T18:30:00")], NOW);
    expect(groups[0].range).toBe("26 oct – 1 nov");
  });

  it("conserva el orden de llegada y crea un grupo nuevo al cambiar de semana", () => {
    const groups = groupEventsByWeek(
      [
        ev("a", "2026-11-09T10:00:00"),
        ev("b", "2026-10-28T10:00:00"),
        ev("c", "2026-10-29T10:00:00"),
      ],
      NOW
    );
    expect(groups.map((g) => g.events.map((e) => e.id))).toEqual([["a"], ["b", "c"]]);
  });

  it("coloca en un grupo «Fecha por confirmar» los eventos sin fecha válida", () => {
    const groups = groupEventsByWeek([{ id: "x", startTime: null }], NOW);
    expect(groups[0].label).toBe("Fecha por confirmar");
  });
});
