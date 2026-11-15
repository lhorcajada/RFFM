import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "../defaultRules";
import { RULE_CATALOG, buildDefaultRule, RULE_CONDITIONS, resolveRule, unusedConditions } from "../ruleCatalog";
import { migrateRules } from "../rulesMigration";

describe("ruleCatalog", () => {
  it("define las condiciones del embudo: tres obligatorias, ventanas, minutos bajos, dificultad y nivel", () => {
    expect([...RULE_CONDITIONS].sort()).toEqual(
      ["injured", "injuryRest", "lowMinutes", "minCalls", "otherDeconvocation", "positionMinimums", "rating", "recentDeconvocation", "recentRecovery", "rivalDifficulty", "weeklyTraining"].sort(),
    );
  });

  it("la regla de pocos minutos protege por defecto por debajo de 20 minutos", () => {
    expect(buildDefaultRule("lowMinutes").points).toEqual({ minutes: 20 });
  });

  it("el mínimo de convocatorias parte del 100 % del reparto justo", () => {
    expect(buildDefaultRule("minCalls").points).toEqual({ percent: 100 });
  });

  it("los mínimos por posición parten de los valores de siempre", () => {
    expect(buildDefaultRule("positionMinimums").points).toEqual({
      goalkeeper: 2,
      fullBack: 3,
      centreBack: 3,
      centralMid: 4,
      wide: 2,
      forward: 1,
    });
  });

  it("tiene una definición por condición", () => {
    expect(Object.keys(RULE_CATALOG).sort()).toEqual([...RULE_CONDITIONS].sort());
  });

  it("la configuración por defecto trae una regla por condición", () => {
    expect(DEFAULT_RULES.map((r) => r.condition).sort()).toEqual([...RULE_CONDITIONS].sort());
  });

  it("las ventanas de protección por defecto son 8 jornadas (técnica), 4 (otro motivo) y 1 (lesión)", () => {
    expect(resolveRule("recentDeconvocation", DEFAULT_RULES)?.points.window).toBe(8);
    expect(resolveRule("otherDeconvocation", DEFAULT_RULES)?.points.window).toBe(4);
    expect(resolveRule("injuryRest", DEFAULT_RULES)?.points.window).toBe(1);
  });

  it("los umbrales de dificultad por defecto son 40% y 65%", () => {
    const rule = resolveRule("rivalDifficulty", DEFAULT_RULES);
    expect(rule?.points.hardBelow).toBe(40);
    expect(rule?.points.easyAbove).toBe(65);
  });

  it("resolveRule devuelve null si la regla no está en la lista", () => {
    expect(resolveRule("injuryRest", DEFAULT_RULES.filter((r) => r.condition !== "injuryRest"))).toBeNull();
  });

  it("resolveRule completa con valores por defecto las claves que faltan", () => {
    const resolved = resolveRule("injuryRest", [{ condition: "injuryRest", text: "Descanso", points: {}, weights: {} }]);
    expect(resolved).toMatchObject({ text: "Descanso", points: { window: 1 } });
  });

  it("unusedConditions excluye las condiciones ya usadas", () => {
    const unused = unusedConditions(DEFAULT_RULES.filter((r) => r.condition !== "injuryRest" && r.condition !== "rating"));
    expect(unused.sort()).toEqual(["injuryRest", "rating"]);
  });
});

describe("migrateRules", () => {
  const legacy = [
    { condition: "goals", text: "Goles", points: { perGoal: 3 }, weights: {} },
    { condition: "streak", text: "Racha", points: {}, weights: {} },
    { condition: "injured", text: "Lesionado propio", points: { value: -120 }, weights: {} },
    { condition: "recentDeconvocation", text: "Mi texto", points: { j1: 15, j2: 10, j3: 5 }, weights: {} },
  ] as never;

  it("descarta las condiciones que ya no existen", () => {
    const migrated = migrateRules(legacy);

    expect(migrated.map((r) => r.condition)).not.toContain("goals");
    expect(migrated.map((r) => r.condition)).not.toContain("streak");
  });

  it("conserva el texto de las reglas que siguen y pone la ventana técnica por defecto", () => {
    const migrated = migrateRules(legacy);

    expect(migrated.find((r) => r.condition === "injured")?.text).toBe("Lesionado propio");
    expect(resolveRule("recentDeconvocation", migrated)).toMatchObject({ text: "Mi texto", points: { window: 8 } });
  });

  it("añade el descanso por lesión y la dificultad del rival a una configuración antigua", () => {
    const migrated = migrateRules(legacy);

    expect(resolveRule("injuryRest", migrated)?.points.window).toBe(1);
    expect(resolveRule("otherDeconvocation", migrated)?.points.window).toBe(4);
    expect(resolveRule("rivalDifficulty", migrated)?.points.hardBelow).toBe(40);
  });

  it("no toca una configuración nueva en la que se quitó una regla", () => {
    const current = DEFAULT_RULES.filter((r) => r.condition !== "injuryRest");

    expect(migrateRules(current).map((r) => r.condition)).not.toContain("injuryRest");
  });
});
