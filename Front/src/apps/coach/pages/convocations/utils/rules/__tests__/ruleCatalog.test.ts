import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "../defaultRules";
import { RULE_CATALOG, RULE_CONDITIONS, resolveRule, unusedConditions } from "../ruleCatalog";

describe("ruleCatalog", () => {
  it("define 12 condiciones únicas", () => {
    expect(RULE_CONDITIONS).toHaveLength(12);
    expect(new Set(RULE_CONDITIONS).size).toBe(12);
  });

  it("tiene una definición por condición", () => {
    expect(Object.keys(RULE_CATALOG).sort()).toEqual([...RULE_CONDITIONS].sort());
  });

  it("la configuración por defecto trae una regla por condición", () => {
    expect(DEFAULT_RULES.map((r) => r.condition).sort()).toEqual([...RULE_CONDITIONS].sort());
  });

  it("los valores por defecto equivalen a las constantes actuales", () => {
    const goals = resolveRule("goals", DEFAULT_RULES);
    expect(goals?.points.perGoal).toBe(2);
    const streak = resolveRule("streak", DEFAULT_RULES);
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => streak?.points[`j${n}`])).toEqual([50, 45, 20, 15, 10, 5, 3]);
    expect(resolveRule("injured", DEFAULT_RULES)?.points.value).toBe(-120);
    expect(resolveRule("technicalTotal", DEFAULT_RULES)?.points.multiplier).toBe(40);
  });

  it("resolveRule devuelve null si la regla no está en la lista", () => {
    expect(resolveRule("goals", DEFAULT_RULES.filter((r) => r.condition !== "goals"))).toBeNull();
  });

  it("resolveRule completa con valores por defecto las claves que faltan", () => {
    const resolved = resolveRule("goals", [{ condition: "goals", text: "Mis goles", points: {}, weights: {} }]);
    expect(resolved).toMatchObject({ text: "Mis goles", points: { perGoal: 2 } });
  });

  it("unusedConditions excluye las condiciones ya usadas", () => {
    const unused = unusedConditions(DEFAULT_RULES.filter((r) => r.condition !== "goals" && r.condition !== "streak"));
    expect(unused.sort()).toEqual(["goals", "streak"]);
  });
});
