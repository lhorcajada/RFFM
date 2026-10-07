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
    positionGroupCounts: new Map(),
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

describe("recentRecoveryRule", () => {
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
