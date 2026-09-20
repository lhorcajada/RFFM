import type {
  FatigueBreakdown,
  FormStatusBreakdown,
  ReadinessBreakdown,
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

export function buildReadinessBreakdown(overrides: Partial<ReadinessBreakdown> = {}): ReadinessBreakdown {
  return {
    trainingComponent: 30,
    matchComponent: 60,
    trainingSessionsConsidered: 10,
    trainingSessionsBaseline: 16,
    matchMinutesInWindow: 150,
    matchMinutesExpected: 560,
    trainingWeight: 0.7,
    matchWeight: 0.3,
    recentAbsences: [],
    consideredTrainings: [],
    consideredMatches: [],
    ...overrides,
  };
}

export function buildFormStatusBreakdown(overrides: Partial<FormStatusBreakdown> = {}): FormStatusBreakdown {
  return {
    windowDays: 42,
    recencyFullWeightDays: 7,
    recencyHalfLifeDays: 14,
    trainingComponent: 50,
    trainingSessionsOffered: 4,
    trainingSessionsAttended: 2,
    trainingLoadOffered: 4,
    trainingLoadReceived: 2,
    trainingTypeWeightFallbackUsed: false,
    excludedTrainings: 0,
    matchComponent: 100,
    referenceTrainingSessions: 12,
    trainingRatioComponent: 50,
    trainingVolumeFactor: 1,
    matchMinutesPlayedTotal: 70,
    matchMinutesPossibleTotal: 80,
    matchesConsidered: 1,
    categoryMatchMinutes: 80,
    fullStimulusFraction: 0.875,
    fullMatchMinutes: 70,
    matchRecencyWeightSum: 1,
    matchRatioWeightedSum: 1,
    excludedMatches: 0,
    trainingWeightNominal: 0.55,
    matchWeightNominal: 0.45,
    trainingWeightApplied: 0.55,
    matchWeightApplied: 0.45,
    baseScore: 72.5,
    fatigue: 20,
    fatigueFactor: 0.9,
    consideredTrainings: [],
    consideredMatches: [],
    ...overrides,
  };
}
