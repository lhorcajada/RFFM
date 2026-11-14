import { describe, expect, it } from "vitest";
import { explainFit } from "../explainFit";
import type { TraitWeight } from "../../../squad/rating/ratingTraits";

const weights: Record<string, TraitWeight> = {
  traitOccupiesZone: "key",
  traitBuildsUnderPressure: "key",
  traitBreaksLines: "sum",
  traitBeatsOneOnOne: "indifferent",
};

describe("explainFit", () => {
  it("calcula la media ponderada: clave pesa 3 y suma pesa 1", () => {
    const result = explainFit(
      [
        { traitKey: "traitOccupiesZone", level: 5 },
        { traitKey: "traitBuildsUnderPressure", level: 3 },
        { traitKey: "traitBreaksLines", level: 2 },
      ],
      weights,
    );

    expect(result.weightedSum).toBe(26);
    expect(result.totalWeight).toBe(7);
    expect(result.fit).toBe(3.7);
  });

  it("redondea el encaje a un decimal igual que el servidor", () => {
    const result = explainFit(
      [
        { traitKey: "traitOccupiesZone", level: 4 },
        { traitKey: "traitBuildsUnderPressure", level: 4 },
        { traitKey: "traitBreaksLines", level: 3 },
      ],
      weights,
    );

    expect(result.fit).toBe(3.9);
  });

  it("solo lista los rasgos que cuentan, claves primero", () => {
    const result = explainFit([{ traitKey: "traitBreaksLines", level: 4 }], weights);

    expect(result.rows.map((r) => r.traitKey)).toEqual(["traitOccupiesZone", "traitBuildsUnderPressure", "traitBreaksLines"]);
    expect(result.rows.map((r) => r.multiplier)).toEqual([3, 3, 1]);
  });

  it("ignora los rasgos indiferentes aunque tengan nivel", () => {
    const result = explainFit([{ traitKey: "traitBeatsOneOnOne", level: 5 }], weights);

    expect(result.rows.some((r) => r.traitKey === "traitBeatsOneOnOne")).toBe(false);
    expect(result.fit).toBeNull();
  });

  it("los rasgos sin valorar se marcan y no cuentan en la media", () => {
    const result = explainFit([{ traitKey: "traitOccupiesZone", level: 4 }], weights);

    const missing = result.rows.find((r) => r.traitKey === "traitBuildsUnderPressure");
    expect(missing?.level).toBeNull();
    expect(missing?.points).toBeNull();
    expect(result.totalWeight).toBe(3);
    expect(result.fit).toBe(4);
  });

  it("devuelve null si no hay ningún rasgo valorado que cuente", () => {
    expect(explainFit([], weights).fit).toBeNull();
  });

  it("calcula los puntos de cada rasgo como nivel por peso", () => {
    const result = explainFit([{ traitKey: "traitOccupiesZone", level: 5 }], weights);

    expect(result.rows[0]).toMatchObject({ traitKey: "traitOccupiesZone", level: 5, multiplier: 3, points: 15 });
  });

  it("marca como punto débil un rasgo clave con nivel 1 o 2", () => {
    const result = explainFit(
      [
        { traitKey: "traitOccupiesZone", level: 2 },
        { traitKey: "traitBuildsUnderPressure", level: 4 },
        { traitKey: "traitBreaksLines", level: 1 },
      ],
      weights,
    );

    expect(result.weakKeyTraits).toEqual(["Ocupa su zona y da apoyo"]);
  });
});
