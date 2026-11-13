import { describe, expect, it } from "vitest";
import injuredRule from "../injuredRule";
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
  it("lesionado: fuerza la desconvocatoria sin puntuar", () => {
    const result = injuredRule(ctx({ player: { isInjured: true } as any }), {}, rule("injured", {}));
    expect(result).toMatchObject({ delta: 0, forced: true });
  });

  it("lesionado: usa el texto configurado", () => {
    const result = injuredRule(ctx({ player: { isInjured: true } as any }), {}, rule("injured", { text: "Fuera por lesión" }));
    expect(result.factors[0].label).toBe("Fuera por lesión");
  });

  it("lesionado: un jugador sano no activa la regla", () => {
    expect(injuredRule(ctx({ player: { isInjured: false } as any }), {}, rule("injured", {}))).toEqual({ factors: [], delta: 0 });
  });
});

describe("runRules con lista de reglas", () => {
  it("sin lista usa la configuración por defecto", () => {
    const c = ctx({ player: { isInjured: true } as any });
    expect(runRules(c)).toEqual(runRules(c, DEFAULT_RULES));
  });

  it("una regla obligatoria ausente no fuerza", () => {
    const c = ctx({ player: { isInjured: true } as any });
    const results = runRules(c, DEFAULT_RULES.filter((r) => r.condition !== "injured"));
    expect(results.some((r) => r.forced)).toBe(false);
  });

  it("una lista vacía no puntúa", () => {
    expect(runRules(ctx({ player: { isInjured: true } as any }), []).every((r) => r.delta === 0 && !r.forced)).toBe(true);
  });

  it("una regla obligatoria presente sigue forzando", () => {
    const results = runRules(ctx({ player: { isInjured: true } as any }), [rule("injured", { text: "x" })]);
    expect(results.some((r) => r.forced)).toBe(true);
  });
});
