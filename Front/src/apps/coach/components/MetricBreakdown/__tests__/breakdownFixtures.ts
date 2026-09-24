import type {
  DailyLoadBreakdown,
  DailyLoadStep,
  FatigueBreakdown,
} from "../../../services/teamPlayerStatisticsService";

export function buildFatigueBreakdown(overrides: Partial<FatigueBreakdown> = {}): FatigueBreakdown {
  return {
    trainingComponent: 15,
    matchComponent: 25,
    decayedTrainingCount: 2,
    decayedMatchMinutes: 40,
    trainingWeight: 0.4,
    matchWeight: 0.6,
    consideredTrainings: [],
    consideredMatches: [],
    ...overrides,
  };
}

export function buildActivityStep(overrides: Partial<DailyLoadStep> = {}): DailyLoadStep {
  return {
    date: "2026-09-20T00:00:00Z",
    endDate: null,
    kind: "Activity",
    load: 1,
    valueBefore: 60,
    valueAfter: 66,
    events: [{ eventId: "t1", eventTypeId: 2, trainingTypes: ["Fisico"], minutesPlayed: 0, typeWeight: 1, load: 1 }],
    ...overrides,
  };
}

export function buildDailyLoadBreakdown(overrides: Partial<DailyLoadBreakdown> = {}): DailyLoadBreakdown {
  return {
    value: 66,
    replayStartDate: "2026-07-03T00:00:00Z",
    replayDays: 84,
    gainRate: 0.16,
    graceRestDays: 4,
    decayStepPerDay: 0.5,
    decayMaxPerDay: 3,
    matchLoadPerReferenceMatch: 1.5,
    referenceMatchMinutes: 70,
    currentRestStreakDays: 1,
    trainingsAttended: 9,
    matchesPlayed: 2,
    matchMinutesPlayed: 125,
    steps: [buildActivityStep()],
    missedEvents: [],
    ...overrides,
  };
}
