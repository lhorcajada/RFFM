import { describe, expect, it } from "vitest";
import { getDefaultStandingSpots, resolveStandingSpots } from "../standingRules";

describe("getDefaultStandingSpots (Bases RFFM 2026/2027)", () => {
  it("en Segunda Cadete ascienden dos y no desciende nadie", () => {
    expect(getDefaultStandingSpots("SEGUNDA CADETE")).toEqual({
      promotionSpots: 2,
      playoffSpots: 0,
      relegationSpots: 0,
    });
  });

  it("reconoce la división aunque cambien mayúsculas y tildes", () => {
    expect(getDefaultStandingSpots("Primera División Autonómica Infantil")).toEqual({
      promotionSpots: 2,
      playoffSpots: 0,
      relegationSpots: 4,
    });
  });

  it("en Superliga no hay ascensos y descienden cuatro", () => {
    expect(getDefaultStandingSpots("SUPERLIGA CADETE")).toEqual({
      promotionSpots: 0,
      playoffSpots: 0,
      relegationSpots: 4,
    });
  });

  it("no marca descensos cuando las Bases los dejan por determinar", () => {
    expect(getDefaultStandingSpots("PRIMERA CADETE")).toEqual({
      promotionSpots: 2,
      playoffSpots: 0,
      relegationSpots: null,
    });
  });

  it("en Primera Alevín, última división alevín, no desciende nadie", () => {
    expect(getDefaultStandingSpots("PRIMERA ALEVIN")?.relegationSpots).toBe(0);
  });

  it("no aplica las reglas masculinas a competiciones femeninas", () => {
    expect(getDefaultStandingSpots("PREFERENTE DE CADETE FEMENINO")).toBeNull();
  });

  it("no inventa plazas para categorías sin regla registrada", () => {
    expect(getDefaultStandingSpots("PREFERENTE JUVENIL")).toBeNull();
  });
});

describe("resolveStandingSpots", () => {
  it("prioriza las plazas configuradas en el equipo", () => {
    expect(
      resolveStandingSpots({ promotionSpots: 1, playoffSpots: null, relegationSpots: null }, "SEGUNDA CADETE"),
    ).toEqual({ promotionSpots: 1, playoffSpots: null, relegationSpots: null });
  });

  it("usa las Bases cuando el equipo no tiene plazas configuradas", () => {
    expect(resolveStandingSpots({}, "SEGUNDA CADETE")).toEqual({
      promotionSpots: 2,
      playoffSpots: 0,
      relegationSpots: 0,
    });
  });

  it("no marca zonas sin configuración ni regla conocida", () => {
    expect(resolveStandingSpots({}, null)).toEqual({});
  });
});
