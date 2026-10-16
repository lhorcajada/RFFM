import { describe, expect, it } from "vitest";
import { buildMatchUnavailability } from "../matchUnavailability";

const EXCUSE_TYPES = [
  { id: 1, name: "Lesión", justified: true },
  { id: 3, name: "Enfermedad", justified: true },
  { id: 7, name: "Decisión técnica", justified: false },
  { id: 8, name: "Sanción deportiva", justified: true },
];

describe("buildMatchUnavailability", () => {
  it("marca como no disponible al desconvocado por un motivo que no es decisión técnica", () => {
    const result = buildMatchUnavailability(["p1"], { p1: 3 }, EXCUSE_TYPES);

    expect(result.get("p1")).toEqual({ excuseTypeId: 3, reason: "Enfermedad" });
  });

  it("no marca como no disponible al desconvocado por decisión técnica", () => {
    const result = buildMatchUnavailability(["p1"], { p1: 7 }, EXCUSE_TYPES);

    expect(result.has("p1")).toBe(false);
  });

  it("no marca como no disponible al desconvocado sin motivo", () => {
    const result = buildMatchUnavailability(["p1"], {}, EXCUSE_TYPES);

    expect(result.has("p1")).toBe(false);
  });

  it("ignora el motivo de jugadores que no están desconvocados", () => {
    const result = buildMatchUnavailability([], { p1: 8 }, EXCUSE_TYPES);

    expect(result.size).toBe(0);
  });
});
