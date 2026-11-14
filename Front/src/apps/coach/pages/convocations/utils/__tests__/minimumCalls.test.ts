import { describe, expect, it } from "vitest";
import { minimumCalls } from "../minimumCalls";

const base = { maxCalledPlayers: 18, squadSize: 24 };

describe("minimumCalls", () => {
  it("con el 100 % es el reparto justo de siempre", () => {
    expect(minimumCalls({ ...base, playedAvailable: 12, percent: 100 })).toBe(9);
  });

  it("con un porcentaje menor se exige menos", () => {
    expect(minimumCalls({ ...base, playedAvailable: 12, percent: 50 })).toBe(4);
  });

  it("con un porcentaje mayor se exige más", () => {
    expect(minimumCalls({ ...base, playedAvailable: 12, percent: 120 })).toBe(10);
  });

  it("nunca exige más convocatorias que partidos disponibles", () => {
    expect(minimumCalls({ ...base, playedAvailable: 12, percent: 200 })).toBe(12);
  });

  it("con el 0 % no se exige ninguna", () => {
    expect(minimumCalls({ ...base, playedAvailable: 12, percent: 0 })).toBe(0);
  });

  it("sin partidos disponibles no se exige ninguna", () => {
    expect(minimumCalls({ ...base, playedAvailable: 0, percent: 100 })).toBe(0);
  });

  it("una plantilla vacía no rompe el cálculo", () => {
    expect(minimumCalls({ maxCalledPlayers: 18, squadSize: 0, playedAvailable: 5, percent: 100 })).toBe(5);
  });
});
