import { describe, expect, it } from "vitest";
import streakRule from "../streakRule";
import type { RuleContext } from "../types";

function createRuleContext(effectiveStreak: number): RuleContext {
  return {
    input: {} as any,
    playerId: "player-1",
    player: {} as any,
    displayName: "Player 1",
    weightedRating: 0,
    competitiveness: 0,
    physical: 0,
    tactical: 0,
    technical: 0,
    necessity: 0,
    weekStats: {} as any,
    effectiveStreak,
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
    previousRivalResult: null as any,
    seasonColumns: [],
    enrichedGrid: new Map(),
    lastInjuryEndMap: new Map(),
    currentIso: null,
    weekTrainingCount: 0,
    maxTechnicalTotal: 0,
  };
}

describe("streakRule", () => {
  it.each([
    [1, 50],
    [2, 45],
    [3, 20],
    [4, 15],
    [5, 10],
    [6, 5],
    [7, 3],
    [8, 3],
    [12, 3],
  ])("maps %i jornadas to %i points", (effectiveStreak, expectedPoints) => {
    const result = streakRule(createRuleContext(effectiveStreak as number), {});

    expect(result.delta).toBe(expectedPoints);
    expect(result.factors[0]?.impact).toBe(expectedPoints);
  });
});