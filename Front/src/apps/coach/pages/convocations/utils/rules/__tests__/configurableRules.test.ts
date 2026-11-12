import { describe, expect, it } from "vitest";
import goalsRule from "../goalsRule";
import injuredRule from "../injuredRule";
import streakRule from "../streakRule";
import technicalTotalRule from "../technicalTotalRule";
import recentDeconvocationRule from "../recentDeconvocationRule";
import minimumRule from "../minimumRule";
import rivalResultRule from "../rivalResultRule";
import combinedRule from "../combinedRule";
import { runRules } from "../index";
import { DEFAULT_RULES } from "../defaultRules";
import { buildDefaultRule, type DeconvocationRuleConfig } from "../ruleCatalog";
import type { RuleContext } from "../types";

function ctx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    input: {} as any,
    playerId: "p1",
    player: {} as any,
    displayName: "P1",
    weightedRating: 0,
    competitiveness: 0,
    physical: 0,
    tactical: 0,
    technical: 0,
    necessity: 0,
    weekStats: {
      totalTrainings: 0,
      attendedTrainings: 0,
      weightedAttendedTrainings: 0,
      attendedTrainingsSeason: 0,
      weightedAttendedTrainingsSeason: 0,
      totalTrainingsSeason: 0,
      knownUnavailableTrainings: 0,
    },
    effectiveStreak: 0,
    technicalTotal: 0,
    injuryAbsencesInStreak: 0,
    calledCount: 0,
    startsCount: 0,
    startsDataAvailable: false,
    minRequiredCalls: 0,
    calledIds: [],
    playerById: new Map(),
    ratings: {},
    previousRivalResult: null,
    seasonColumns: [],
    enrichedGrid: new Map(),
    lastInjuryEndMap: new Map(),
    currentIso: null,
    weekTrainingCount: 0,
    maxTechnicalTotal: 0,
    ...overrides,
  };
}

const rule = (
  condition: DeconvocationRuleConfig["condition"],
  patch: Partial<Omit<DeconvocationRuleConfig, "condition">>,
): DeconvocationRuleConfig => {
  const base = buildDefaultRule(condition);
  return { ...base, ...patch, points: { ...base.points, ...patch.points }, weights: { ...base.weights, ...patch.weights } };
};

describe("reglas con configuración", () => {
  it("goles: usa los puntos por gol configurados", () => {
    const result = goalsRule(ctx({ seasonPlayerStats: { leagueGoals: 4 } as any }), {}, rule("goals", { points: { perGoal: 3 } }));
    expect(result.delta).toBe(12);
  });

  it("goles: usa el texto configurado", () => {
    const result = goalsRule(ctx(), {}, rule("goals", { text: "Mis goles" }));
    expect(result.factors[0].label).toBe("Mis goles");
  });

  it("racha: usa la tabla de puntos configurada", () => {
    const result = streakRule(ctx({ effectiveStreak: 1 }), {}, rule("streak", { points: { j1: 99 } }));
    expect(result.delta).toBe(99);
  });

  it("racha: el peso de escala modifica el cálculo de la rama sin racha", () => {
    const base = streakRule(ctx({ effectiveStreak: 0 }), {}, rule("streak", { weights: { lowBonus: 0 } }));
    const boosted = streakRule(ctx({ effectiveStreak: 0 }), {}, rule("streak", { weights: { lowBonus: 10 } }));
    expect(boosted.delta - base.delta).toBe(10);
  });

  it("lesionado: usa los puntos configurados y sigue forzando", () => {
    const result = injuredRule(ctx({ player: { isInjured: true } as any }), {}, rule("injured", { points: { value: -50 } }));
    expect(result).toMatchObject({ delta: -50, forced: true });
  });

  it("lesionado: usa el texto configurado", () => {
    const result = injuredRule(ctx({ player: { isInjured: true } as any }), {}, rule("injured", { text: "Fuera por lesión" }));
    expect(result.factors[0].label).toBe("Fuera por lesión");
  });

  it("desconvocatorias técnicas: usa el multiplicador configurado", () => {
    const result = technicalTotalRule(ctx({ technicalTotal: 2, maxTechnicalTotal: 2 }), {}, rule("technicalTotal", { points: { multiplier: 10 } }));
    expect(result.delta).toBe(10);
  });

  it("desconvocatoria reciente: usa la tabla configurada", () => {
    const grid = new Map([["e1", new Map([["p1", { statusName: "Deconvoke" } as any]])]]);
    const result = recentDeconvocationRule(
      ctx({ seasonColumns: [{ eventId: "e1" } as any], enrichedGrid: grid }),
      {},
      rule("recentDeconvocation", { points: { j1: 40 } }),
    );
    expect(result.delta).toBe(40);
  });

  it("mínimo: usa puntos por convocatoria y tope configurados", () => {
    const result = minimumRule(ctx({ calledCount: 0, minRequiredCalls: 10 }), {}, rule("minimum", { points: { perMissingCall: 1 }, weights: { cap: 5 } }));
    expect(result.delta).toBe(5);
  });

  it("mínimo: sustituye los marcadores del texto", () => {
    const result = minimumRule(ctx({ calledCount: 1, minRequiredCalls: 3 }), {}, rule("minimum", { text: "Faltan {deficit} de {min}" }));
    expect(result.factors[0].label).toBe("Faltan 2 de 3");
  });

  it("resultado del rival: usa la base y el umbral configurados", () => {
    const previous = { rival: "R", result: "loss", scoreText: "0-1", eventDate: "", goalDiff: 1 } as any;
    const result = rivalResultRule(ctx({ previousRivalResult: previous, necessity: 1 }), {}, rule("rivalResult", { points: { loss: 30 } }));
    expect(result.delta).toBe(30);
  });

  it("combinada: la regla de nivel ponderado usa sus puntos máximos", () => {
    const result = combinedRule(ctx({ weightedRating: 10 }), {}, [rule("rating", { points: { max: 50 } })]);
    expect(result.factors.find((x) => x.key === "rating")?.impact).toBe(22.5);
  });
});

describe("runRules con lista de reglas", () => {
  it("sin lista usa la configuración por defecto", () => {
    const c = ctx({ seasonPlayerStats: { leagueGoals: 1 } as any });
    expect(runRules(c)).toEqual(runRules(c, DEFAULT_RULES));
  });

  it("una regla ausente no aporta factor ni puntos", () => {
    const c = ctx({ effectiveStreak: 1 });
    const without = runRules(c, DEFAULT_RULES.filter((r) => r.condition !== "streak")).flatMap((r) => r.factors);
    expect(without.some((f) => f.key === "streak")).toBe(false);
  });

  it("una lista vacía no puntúa", () => {
    expect(runRules(ctx({ player: { isInjured: true } as any }), []).every((r) => r.delta === 0 && !r.forced)).toBe(true);
  });

  it("una regla obligatoria presente sigue forzando", () => {
    const results = runRules(ctx({ player: { isInjured: true } as any }), [rule("injured", { text: "x" })]);
    expect(results.some((r) => r.forced)).toBe(true);
  });
});
