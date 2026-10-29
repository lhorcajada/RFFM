import { describe, expect, it } from "vitest";
import recentRecoveryRule from "../recentRecoveryRule";
import type { RuleContext } from "../types";

function createRuleContext(missedEvents: number | undefined): RuleContext {
  const lastInjuryMissedEventsMap = new Map<string, number>();
  if (missedEvents !== undefined) lastInjuryMissedEventsMap.set("player-1", missedEvents);
  return {
    input: {} as RuleContext["input"],
    playerId: "player-1",
    player: { id: "player-1", isInjured: false } as RuleContext["player"],
    displayName: "Player 1",
    weightedRating: 0,
    competitiveness: 0,
    physical: 0,
    tactical: 0,
    technical: 0,
    necessity: 0,
    weekStats: {} as RuleContext["weekStats"],
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
    lastInjuryEndMap: new Map([["player-1", "2026-10-03"]]),
    lastInjuryMissedEventsMap,
    currentIso: "2026-10-07",
    weekTrainingCount: 0,
    maxTechnicalTotal: 0,
  };
}

type ShortInjuryOptions = {
  start: string | null;
  previousMatchStatus?: { statusName: string; excuseTypeId?: number | null };
  attendedTrainings?: number;
};

function createContextWithInjury({ start, previousMatchStatus, attendedTrainings = 0 }: ShortInjuryOptions): RuleContext {
  const base = createRuleContext(2);
  const enrichedGrid: RuleContext["enrichedGrid"] = new Map();
  if (previousMatchStatus) {
    enrichedGrid.set("prev-match", new Map([["player-1", previousMatchStatus as never]]));
  }
  return {
    ...base,
    lastInjuryStartMap: new Map([["player-1", start]]),
    seasonColumns: previousMatchStatus ? [{ eventId: "prev-match" } as never] : [],
    enrichedGrid,
    weekStats: { attendedTrainings } as RuleContext["weekStats"],
  };
}

describe("recentRecoveryRule", () => {
  describe("baja corta (menos de dos semanas)", () => {
    it("no vuelve a desconvocar y suma puntos de protección si ya fue desconvocado por lesión el partido anterior y entrena esta semana", () => {
      const ctx = createContextWithInjury({
        start: "2026-09-28",
        previousMatchStatus: { statusName: "Deconvoke", excuseTypeId: 1 },
        attendedTrainings: 1,
      });

      const result = recentRecoveryRule(ctx, {});

      expect(result.forced).toBeUndefined();
      expect(result.delta).toBe(30);
      expect(result.factors[0]).toMatchObject({ key: "recoveryProtection", impact: 30 });
    });

    it("sigue desconvocando si todavía no ha entrenado esta semana", () => {
      const ctx = createContextWithInjury({
        start: "2026-09-28",
        previousMatchStatus: { statusName: "Deconvoke", excuseTypeId: 1 },
        attendedTrainings: 0,
      });

      expect(recentRecoveryRule(ctx, {}).forced).toBe(true);
    });

    it("sigue desconvocando si el partido anterior no fue una desconvocatoria por lesión", () => {
      const ctx = createContextWithInjury({
        start: "2026-09-28",
        previousMatchStatus: { statusName: "Called" },
        attendedTrainings: 1,
      });

      expect(recentRecoveryRule(ctx, {}).forced).toBe(true);
    });
  });

  describe("baja larga (dos semanas o más)", () => {
    it("fuerza la desconvocatoria en recuperación aunque entrene y ya faltara al partido anterior", () => {
      const ctx = createContextWithInjury({
        start: "2026-09-19",
        previousMatchStatus: { statusName: "Deconvoke", excuseTypeId: 1 },
        attendedTrainings: 2,
      });

      const result = recentRecoveryRule(ctx, {});

      expect(result.forced).toBe(true);
      expect(result.factors[0]?.label).toBe("En recuperación de lesión");
    });

    it("no fuerza pasada la semana de recuperación", () => {
      const ctx = { ...createContextWithInjury({ start: "2026-09-10" }), currentIso: "2026-10-12" };

      expect(recentRecoveryRule(ctx, {})).toEqual({ factors: [], delta: 0 });
    });
  });


  it("fuerza la desconvocatoria si en la última semana tras el alta se perdió entrenamientos o partidos", () => {
    const result = recentRecoveryRule(createRuleContext(2), {});

    expect(result.forced).toBe(true);
    expect(result.factors[0]?.key).toBe("recentRecovery");
  });

  it("no computa la lesión si no se perdió ningún entrenamiento ni partido", () => {
    const result = recentRecoveryRule(createRuleContext(0), {});

    expect(result).toEqual({ factors: [], delta: 0 });
  });

  it("mantiene la regla si no se sabe qué eventos se perdió", () => {
    const result = recentRecoveryRule(createRuleContext(undefined), {});

    expect(result.forced).toBe(true);
  });
});
