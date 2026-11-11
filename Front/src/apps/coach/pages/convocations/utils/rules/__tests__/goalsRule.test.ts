import { describe, expect, it } from "vitest";
import goalsRule from "../goalsRule";
import type { RuleContext } from "../types";
import type { SeasonPlayerStats } from "../../../components/simulation/liveMatch.types";

function createRuleContext(seasonPlayerStats?: Partial<SeasonPlayerStats> | null): RuleContext {
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
    previousRivalResult: null as any,
    seasonColumns: [],
    enrichedGrid: new Map(),
    lastInjuryEndMap: new Map(),
    currentIso: null,
    weekTrainingCount: 0,
    maxTechnicalTotal: 0,
    seasonPlayerStats: seasonPlayerStats as SeasonPlayerStats | null | undefined,
  };
}

describe("goalsRule", () => {
  it("puntúa con los goles de liga a 2 puntos por gol", () => {
    const result = goalsRule(createRuleContext({ leagueGoals: 2, totalGoals: 2 }), {});

    expect(result.factors[0]).toMatchObject({ key: "goals", value: 2, impact: 4 });
    expect(result.delta).toBe(4);
  });

  it("ignora los goles de amistosos y torneos que solo están en totalGoals", () => {
    const result = goalsRule(createRuleContext({ leagueGoals: 0, totalGoals: 3 }), {});

    expect(result.factors[0]).toMatchObject({ value: 0, impact: 0 });
    expect(result.delta).toBe(0);
  });

  it("trata los goles de liga ausentes como 0", () => {
    const result = goalsRule(createRuleContext({ totalGoals: 3 }), {});

    expect(result.factors[0]).toMatchObject({ value: 0, impact: 0 });
  });

  it("etiqueta el factor como Goles (liga)", () => {
    const result = goalsRule(createRuleContext({ leagueGoals: 1 }), {});

    expect(result.factors[0].label).toBe("Goles (liga)");
  });
});
