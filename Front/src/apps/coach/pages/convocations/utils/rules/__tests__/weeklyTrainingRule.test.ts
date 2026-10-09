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
      weightedAttendedTrainings: 0,
      attendedTrainingsSeason: 0,
      weightedAttendedTrainingsSeason: 0,
      totalTrainingsSeason: 0,
      knownUnavailableTrainings: 1,
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
    const result = weeklyTrainingRule(
      createRuleContext({ weightedAttendedTrainingsSeason: 7, totalTrainingsSeason: 10 }),
      {},
    );

    expect(result.forced).toBe(true);
  });

  it("no fuerza la desconvocatoria si no vino esta semana pero su asistencia en la temporada es de al menos el 80 %", () => {
    const result = weeklyTrainingRule(
      createRuleContext({ weightedAttendedTrainingsSeason: 8, totalTrainingsSeason: 10 }),
      {},
    );

    expect(result.forced).toBeFalsy();
    expect(result.factors[0]?.key).toBe("weeklyTraining");
  });

  it("fuerza la desconvocatoria si no hay historial de la temporada", () => {
    const result = weeklyTrainingRule(createRuleContext({ totalTrainingsSeason: 0 }), {});

    expect(result.forced).toBe(true);
  });

  it("no fuerza la desconvocatoria si todas las faltas de la semana tienen un motivo que no la fuerza", () => {
    const result = weeklyTrainingRule(
      createRuleContext({ totalTrainings: 3, weightedAttendedTrainings: 0.75, knownUnavailableTrainings: 0, totalTrainingsSeason: 10 }),
      {},
    );

    expect(result.forced).toBeFalsy();
  });

  it("cuenta todos los entrenos y amistosos de la semana y pondera la falta por estudios", () => {
    const result = weeklyTrainingRule(
      createRuleContext({ totalTrainings: 3, attendedTrainings: 2, weightedAttendedTrainings: 2.25, knownUnavailableTrainings: 0 }),
      {},
    );

    expect(result.delta).toBe(9);
  });

  it("penaliza también las faltas por imprevisto y problema familiar", () => {
    const result = weeklyTrainingRule(
      createRuleContext({ totalTrainings: 3, attendedTrainings: 1, weightedAttendedTrainings: 2, knownUnavailableTrainings: 0 }),
      {},
    );

    expect(result.delta).toBe(8);
  });

  it("no perdona la falta de la semana a quien viene de forma habitual", () => {
    const result = weeklyTrainingRule(
      createRuleContext({
        totalTrainings: 3,
        attendedTrainings: 2,
        weightedAttendedTrainings: 2,
        knownUnavailableTrainings: 1,
        weightedAttendedTrainingsSeason: 20,
        totalTrainingsSeason: 21,
      }),
      {},
    );

    expect(result.delta).toBe(8);
  });

  it("muestra el factor como puntos por asistencia a entrenamientos y amistosos", () => {
    const result = weeklyTrainingRule(
      createRuleContext({ totalTrainings: 3, attendedTrainings: 3, weightedAttendedTrainings: 3, knownUnavailableTrainings: 0 }),
      {},
    );

    expect(result.factors[0]).toMatchObject({
      label: "Puntos por asistencia a entrenamientos y amistosos",
      value: 100,
      impact: 12,
    });
  });

  it("no aplica si no hubo entrenos ni amistosos en la semana", () => {
    const result = weeklyTrainingRule(createRuleContext({ totalTrainings: 0, knownUnavailableTrainings: 0 }), {});

    expect(result).toEqual({ factors: [], delta: 0 });
  });
});
