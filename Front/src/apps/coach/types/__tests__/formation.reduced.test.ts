import { describe, it, expect } from "vitest";
import {
  FORMATION_POSITIONS,
  REDUCED_FORMATIONS,
  defaultReducedFormation,
  formationsForPlayerCount,
  type Formation,
} from "../formation";

const apiFormations: Formation[] = [
  { id: "f1", name: "4-4-2" },
  { id: "f2", name: "3-5-2" },
];

const reducedCounts = [10, 9, 8, 7] as const;

describe("REDUCED_FORMATIONS", () => {
  it.each(reducedCounts)("cada esquema de %i jugadores tiene ese número de casillas, numeradas desde 0 y con el portero en la 0", (count) => {
    for (const formation of REDUCED_FORMATIONS[count]) {
      const defs = FORMATION_POSITIONS[formation.name];

      expect(defs.map((d) => d.slotIndex)).toEqual(Array.from({ length: count }, (_, i) => i));
      expect(defs[0].label).toBe("PT");
      expect(defs.filter((d) => d.label === "PT")).toHaveLength(1);
    }
  });

  it.each(reducedCounts)("las casillas de los esquemas de %i jugadores están dentro del campo y no se pisan", (count) => {
    for (const formation of REDUCED_FORMATIONS[count]) {
      const defs = FORMATION_POSITIONS[formation.name];
      const positions = new Set(defs.map((d) => `${d.x}-${d.y}`));

      expect(positions.size).toBe(defs.length);
      for (const d of defs) {
        expect(d.x).toBeGreaterThanOrEqual(5);
        expect(d.x).toBeLessThanOrEqual(95);
        expect(d.y).toBeGreaterThanOrEqual(5);
        expect(d.y).toBeLessThanOrEqual(95);
      }
    }
  });

  it("no repite nombres entre los esquemas reducidos ni con los de 11", () => {
    const names = reducedCounts.flatMap((c) => REDUCED_FORMATIONS[c].map((f) => f.name));

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(FORMATION_POSITIONS[name]).toHaveLength(name.split("-").reduce((a, n) => a + Number(n), 1));
    }
  });
});

describe("formationsForPlayerCount", () => {
  it("devuelve los esquemas del backend para 11 jugadores", () => {
    expect(formationsForPlayerCount(11, apiFormations)).toEqual(apiFormations);
  });

  it("devuelve solo esquemas reducidos de ese tamaño para menos de 11", () => {
    const result = formationsForPlayerCount(9, apiFormations);

    expect(result).toEqual(REDUCED_FORMATIONS[9]);
  });

  it("devuelve los esquemas de 7 cuando quedan menos de 7 jugadores", () => {
    expect(formationsForPlayerCount(6, apiFormations)).toEqual(REDUCED_FORMATIONS[7]);
  });
});

describe("defaultReducedFormation", () => {
  it("mantiene el número de defensas del esquema actual cuando existe uno equivalente", () => {
    expect(defaultReducedFormation(10, "3-5-2").name).toBe("3-4-2");
  });

  it("de 4-4-2 pasa a 4-4-1", () => {
    expect(defaultReducedFormation(10, "4-4-2").name).toBe("4-4-1");
  });

  it("usa el esquema por defecto del tamaño si ninguno mantiene los defensas", () => {
    expect(defaultReducedFormation(7, "5-3-1").name).toBe("3-2-1");
  });

  it("usa el esquema por defecto si no se conoce el esquema actual", () => {
    expect(defaultReducedFormation(9, null).name).toBe("4-3-1");
  });
});
