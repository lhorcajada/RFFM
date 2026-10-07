import { describe, expect, it } from "vitest";
import weeklyTrainingRule from "../weeklyTrainingRule";
import type { RuleContext } from "../types";
import type { WeeklyTrainingStats } from "../../deconvokeProposal";

function createRuleContext(weekStats: Partial<WeeklyTrainingStats>): RuleContext {
  return {
    input: {} as RuleContext["input"],
    playerId: "player-1",
    player: { id: "player-1" } as RuleContext["player"],
    displayName: "Player 1",
    weightedRating: 0,
    competitiveness: 0,
    physical: 0,
    tactical: 0,
    technical: 0,
    necessity: 0,
    weekStats: {
      totalTrainings: 1,
      attendedTrainings: 0,
      attendedTrainingsSeason: 0,
      totalTrainingsSeason: 0,
      knownUnavailableTrainings: 1,
      unresolvedTrainings: 0,
      ...weekStats,
    },
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
    lastInjuryEndMap: new Map(),
    currentIso: null,
    weekTrainingCount: 3,
    maxTechnicalTotal: 0,
  };
}

describe("weeklyTrainingRule", () => {
  it("fuerza la desconvocatoria si no vino a ningún entreno y su asistencia en la temporada es baja", () => {
    const result = weeklyTrainingRule(createRuleContext({ attendedTrainingsSeason: 7, totalTrainingsSeason: 10 }), {});

    expect(result.forced).toBe(true);
  });

  it("no fuerza la desconvocatoria si no vino esta semana pero su asistencia en la temporada es de al menos el 80 %", () => {
    const result = weeklyTrainingRule(createRuleContext({ attendedTrainingsSeason: 8, totalTrainingsSeason: 10 }), {});

    expect(result.forced).toBeFalsy();
    expect(result.factors[0]?.key).toBe("weeklyTraining");
  });

  it("fuerza la desconvocatoria si no hay historial de la temporada", () => {
    const result = weeklyTrainingRule(createRuleContext({ attendedTrainingsSeason: 0, totalTrainingsSeason: 0 }), {});

    expect(result.forced).toBe(true);
  });

  it("no penaliza una falta puntual en la semana a quien viene de forma habitual", () => {
    const result = weeklyTrainingRule(
      createRuleContext({ totalTrainings: 3, attendedTrainings: 2, knownUnavailableTrainings: 1, attendedTrainingsSeason: 20, totalTrainingsSeason: 21 }),
      {},
    );

    expect(result.delta).toBe(12);
  });

  it("a quien viene de forma habitual solo le perdona una falta de la semana", () => {
    const result = weeklyTrainingRule(
      createRuleContext({ totalTrainings: 3, attendedTrainings: 1, knownUnavailableTrainings: 2, attendedTrainingsSeason: 20, totalTrainingsSeason: 22 }),
      {},
    );

    expect(result.delta).toBe(8);
  });

  it("penaliza la falta de la semana a quien no viene de forma habitual", () => {
    const result = weeklyTrainingRule(
      createRuleContext({ totalTrainings: 3, attendedTrainings: 2, knownUnavailableTrainings: 1, attendedTrainingsSeason: 14, totalTrainingsSeason: 21 }),
      {},
    );

    expect(result.delta).toBe(8);
  });

  it("no aplica si todos los entrenos de la ventana se perdieron por motivos que no penalizan", () => {
    const result = weeklyTrainingRule(
      createRuleContext({ totalTrainings: 0, knownUnavailableTrainings: 0, attendedTrainingsSeason: 2, totalTrainingsSeason: 10 }),
      {},
    );

    expect(result).toEqual({ factors: [], delta: 0 });
  });
});
