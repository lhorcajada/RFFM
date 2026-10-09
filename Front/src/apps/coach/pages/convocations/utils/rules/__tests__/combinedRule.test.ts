import { describe, expect, it } from "vitest";
import combinedRule from "../combinedRule";
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
      totalTrainings: 0,
      attendedTrainings: 0,
      weightedAttendedTrainings: 0,
      attendedTrainingsSeason: 0,
      weightedAttendedTrainingsSeason: 0,
      totalTrainingsSeason: 0,
      knownUnavailableTrainings: 0,
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
    weekTrainingCount: 0,
    maxTechnicalTotal: 0,
  };
}

function seasonAttendanceFactor(weekStats: Partial<WeeklyTrainingStats>) {
  return combinedRule(createRuleContext(weekStats), {}).factors.find((f) => f.key === "weeklyTrainingAccum");
}

describe("combinedRule - asistencia de la temporada", () => {
  it("puntúa el porcentaje ponderado de asistencia sobre todos los eventos posibles", () => {
    const factor = seasonAttendanceFactor({ attendedTrainingsSeason: 16, weightedAttendedTrainingsSeason: 16.5, totalTrainingsSeason: 18 });

    expect(factor).toMatchObject({
      label: "Asistencia a entrenamientos y amistosos (temporada)",
      value: 91.67,
      impact: 22.92,
    });
  });

  it("puntúa menos a quien falta más aunque haya asistido a un número parecido de eventos", () => {
    const regular = seasonAttendanceFactor({ attendedTrainingsSeason: 11, weightedAttendedTrainingsSeason: 11, totalTrainingsSeason: 11 });
    const irregular = seasonAttendanceFactor({ attendedTrainingsSeason: 11, weightedAttendedTrainingsSeason: 12.5, totalTrainingsSeason: 16 });

    expect(irregular!.impact).toBeLessThan(regular!.impact);
  });

  it("no puntúa la asistencia si no hay eventos posibles en la temporada", () => {
    const factor = seasonAttendanceFactor({ totalTrainingsSeason: 0 });

    expect(factor).toMatchObject({ value: 0, impact: 0 });
  });
});
