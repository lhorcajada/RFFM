import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAIT_WEIGHTS,
  FIT_POSITIONS,
  TRAIT_CATALOG,
  calculateFit,
  candidatePositions,
  isValidTraitLevel,
  positionForDemarcation,
  type TraitWeight,
} from "../ratingTraits";

function weights(entries: Record<string, TraitWeight>): Record<string, TraitWeight> {
  return entries;
}

describe("ratingTraits", () => {
  describe("catálogo", () => {
    it("tiene 12 rasgos con claves únicas", () => {
      expect(TRAIT_CATALOG).toHaveLength(12);
      expect(new Set(TRAIT_CATALOG.map((t) => t.key)).size).toBe(12);
    });

    it("agrupa los rasgos en las cuatro fases con 5, 3, 2 y 2", () => {
      const count = (phase: string) => TRAIT_CATALOG.filter((t) => t.phase === phase).length;
      expect([count("withBall"), count("withoutBall"), count("transitions"), count("transversal")]).toEqual([5, 3, 2, 2]);
    });

    it("define etiqueta y descriptores de los niveles 1, 3 y 5 en cada rasgo", () => {
      for (const trait of TRAIT_CATALOG) {
        expect(trait.label.length).toBeGreaterThan(0);
        expect(trait.anchors[1]).toBeTruthy();
        expect(trait.anchors[3]).toBeTruthy();
        expect(trait.anchors[5]).toBeTruthy();
      }
    });

    it("mantiene «cumple su rol» como rasgo propio transversal", () => {
      expect(TRAIT_CATALOG.find((t) => t.key === "traitRoleDiscipline")?.phase).toBe("transversal");
    });

    it.each([
      [0, false],
      [1, true],
      [5, true],
      [6, false],
    ])("el nivel %i es válido: %s", (level, expected) => {
      expect(isValidTraitLevel(level)).toBe(expected);
    });
  });

  describe("puestos", () => {
    it.each([
      [2, "fullBack"],
      [3, "fullBack"],
      [4, "centerBack"],
      [5, "centerBack"],
      [6, "midfielder"],
      [7, "defensiveMidfielder"],
      [8, "attackingMidfielder"],
      [9, "midfielder"],
      [10, "midfielder"],
      [11, "forward"],
      [12, "forward"],
      [13, "winger"],
      [14, "winger"],
    ])("la demarcación %i pertenece al puesto %s", (id, expected) => {
      expect(positionForDemarcation(id)).toBe(expected);
    });

    it("el portero y una demarcación desconocida no tienen puesto de encaje", () => {
      expect(positionForDemarcation(1)).toBeNull();
      expect(positionForDemarcation(999)).toBeNull();
    });

    it("un jugador que compite en dos puestos es candidato de ambos", () => {
      expect(candidatePositions(6, [6, 8]).sort()).toEqual(["attackingMidfielder", "midfielder"]);
    });

    it("cuenta el puesto activo aunque no esté entre los posibles", () => {
      expect(candidatePositions(7, [6]).sort()).toEqual(["defensiveMidfielder", "midfielder"]);
    });

    it("no repite puestos", () => {
      expect(candidatePositions(9, [9, 10, 6])).toEqual(["midfielder"]);
    });

    it("sin demarcaciones no es candidato de ningún puesto", () => {
      expect(candidatePositions(null, [])).toEqual([]);
      expect(candidatePositions(undefined, undefined)).toEqual([]);
    });

    it("excluye al portero", () => {
      expect(candidatePositions(1, [1])).toEqual([]);
    });

    it("define pesos por defecto de todos los rasgos para cada puesto", () => {
      for (const position of FIT_POSITIONS) {
        for (const trait of TRAIT_CATALOG) {
          expect(DEFAULT_TRAIT_WEIGHTS[position][trait.key]).toBeDefined();
        }
      }
    });

    it("«cumple su rol» nunca es indiferente", () => {
      for (const position of FIT_POSITIONS) {
        expect(DEFAULT_TRAIT_WEIGHTS[position].traitRoleDiscipline).not.toBe("indifferent");
      }
    });
  });

  describe("calculateFit", () => {
    it("es la media ponderada de los niveles", () => {
      const w = weights({ traitCoverage: "key", traitPressing: "sum" });
      expect(calculateFit({ traitCoverage: 5, traitPressing: 1 }, w)).toBe(4);
    });

    it("lo clave pesa más que lo que suma", () => {
      const w = weights({ traitCoverage: "key", traitPressing: "sum" });
      const betterInKey = calculateFit({ traitCoverage: 5, traitPressing: 3 }, w) ?? 0;
      const betterInSum = calculateFit({ traitCoverage: 3, traitPressing: 5 }, w) ?? 0;
      expect(betterInKey).toBeGreaterThan(betterInSum);
    });

    it("ignora los rasgos indiferentes", () => {
      const w = weights({ traitCoverage: "key", traitBeatsOneOnOne: "indifferent" });
      expect(calculateFit({ traitCoverage: 4, traitBeatsOneOnOne: 1 }, w)).toBe(
        calculateFit({ traitCoverage: 4, traitBeatsOneOnOne: 5 }, w),
      );
    });

    it("ignora los rasgos sin nivel", () => {
      const w = weights({ traitCoverage: "key", traitPressing: "key" });
      expect(calculateFit({ traitCoverage: 4 }, w)).toBe(4);
    });

    it("devuelve null cuando ningún rasgo que cuenta tiene nivel", () => {
      const w = weights({ traitCoverage: "key", traitBeatsOneOnOne: "indifferent" });
      expect(calculateFit({ traitBeatsOneOnOne: 5 }, w)).toBeNull();
      expect(calculateFit({}, w)).toBeNull();
    });

    it("redondea a un decimal", () => {
      const w = weights({ traitCoverage: "sum", traitPressing: "sum", traitDuels: "sum" });
      expect(calculateFit({ traitCoverage: 5, traitPressing: 4, traitDuels: 4 }, w)).toBe(4.3);
    });

    it("da un encaje distinto al mismo jugador en puestos distintos", () => {
      const levels = Object.fromEntries(TRAIT_CATALOG.map((t) => [t.key, 3]));
      levels.traitCoverage = 5;
      levels.traitArrivesAndFinishes = 1;
      const defensive = calculateFit(levels, DEFAULT_TRAIT_WEIGHTS.defensiveMidfielder) ?? 0;
      const attacking = calculateFit(levels, DEFAULT_TRAIT_WEIGHTS.attackingMidfielder) ?? 0;
      expect(defensive).toBeGreaterThan(attacking);
    });
  });
});
