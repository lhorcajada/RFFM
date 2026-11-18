import { describe, expect, it } from "vitest";
import type { TraitRating, TraitTrend } from "../../../../types/traitRating";
import {
  EMPTY_CONDUCT_FILTERS,
  filterPlayersByConduct,
  hasActiveConductFilters,
} from "../conductFilter";

const players = [{ teamPlayerId: "a" }, { teamPlayerId: "b" }, { teamPlayerId: "c" }, { teamPlayerId: "d" }];

function rating(teamPlayerId: string, trend: TraitTrend, levels: Record<string, number>): TraitRating {
  return {
    id: `r-${teamPlayerId}`,
    teamPlayerId,
    ratedAt: "2026-11-02T00:00:00Z",
    trend,
    levels: Object.entries(levels).map(([traitKey, level]) => ({ traitKey, level })),
  };
}

const conduct: Record<string, TraitRating> = {
  a: rating("a", "down", { traitPressing: 2, traitDuels: 5 }),
  b: rating("b", "up", { traitPressing: 4 }),
  c: rating("c", "same", { traitDuels: 3 }),
};

const ids = (list: { teamPlayerId: string }[]) => list.map((p) => p.teamPlayerId);

describe("filterPlayersByConduct", () => {
  it("sin filtros devuelve a todos, también a los que no tienen valoración", () => {
    expect(ids(filterPlayersByConduct(players, conduct, EMPTY_CONDUCT_FILTERS))).toEqual(["a", "b", "c", "d"]);
  });

  it("filtra por rasgo y rango de nivel", () => {
    const filters = { ...EMPTY_CONDUCT_FILTERS, traitKey: "traitPressing", minLevel: 1, maxLevel: 2 };

    expect(ids(filterPlayersByConduct(players, conduct, filters))).toEqual(["a"]);
  });

  it("incluye los extremos del rango", () => {
    const filters = { ...EMPTY_CONDUCT_FILTERS, traitKey: "traitPressing", minLevel: 2, maxLevel: 4 };

    expect(ids(filterPlayersByConduct(players, conduct, filters))).toEqual(["a", "b"]);
  });

  it("excluye a quien no tiene valoración o nivel para ese rasgo", () => {
    const filters = { ...EMPTY_CONDUCT_FILTERS, traitKey: "traitDuels", minLevel: 1, maxLevel: 5 };

    expect(ids(filterPlayersByConduct(players, conduct, filters))).toEqual(["a", "c"]);
  });

  it("filtra por tendencia de la última valoración", () => {
    const filters = { ...EMPTY_CONDUCT_FILTERS, trend: "down" as TraitTrend };

    expect(ids(filterPlayersByConduct(players, conduct, filters))).toEqual(["a"]);
  });

  it("la tendencia excluye a los jugadores sin valoración", () => {
    const filters = { ...EMPTY_CONDUCT_FILTERS, trend: "same" as TraitTrend };

    expect(ids(filterPlayersByConduct(players, conduct, filters))).toEqual(["c"]);
  });

  it("combina rasgo y tendencia", () => {
    const filters = { traitKey: "traitPressing", minLevel: 1, maxLevel: 5, trend: "up" as TraitTrend };

    expect(ids(filterPlayersByConduct(players, conduct, filters))).toEqual(["b"]);
  });

  it("ignora el rango de nivel cuando no hay rasgo elegido", () => {
    const filters = { ...EMPTY_CONDUCT_FILTERS, minLevel: 5, maxLevel: 5 };

    expect(ids(filterPlayersByConduct(players, conduct, filters))).toHaveLength(4);
  });
});

describe("hasActiveConductFilters", () => {
  it("es falso sin rasgo ni tendencia", () => {
    expect(hasActiveConductFilters(EMPTY_CONDUCT_FILTERS)).toBe(false);
  });

  it("es verdadero con un rasgo o con una tendencia", () => {
    expect(hasActiveConductFilters({ ...EMPTY_CONDUCT_FILTERS, traitKey: "traitDuels" })).toBe(true);
    expect(hasActiveConductFilters({ ...EMPTY_CONDUCT_FILTERS, trend: "up" })).toBe(true);
  });
});
