import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { getTeamPlayerStatistics, type PlayerStatistics } from "../teamPlayerStatisticsService";
import { buildDailyLoadBreakdown, buildFatigueBreakdown } from "../../components/MetricBreakdown/__tests__/breakdownFixtures";

describe("teamPlayerStatisticsService.getTeamPlayerStatistics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("hace una única llamada GET a /api/catalog/team/{teamId}/player-stats y devuelve readiness tal cual", async () => {
    const apiResponse: PlayerStatistics[] = [
      {
        teamPlayerId: "tp-1",
        displayName: "Juan Pérez",
        position: "Delantero",
        dorsal: 9,
        goals: 3,
        yellowCards: 1,
        redCards: 0,
        minutesPlayed: 450,
        trainings: { attended: 14, possible: 16, calledButAbsent: 0 },
        friendlies: { attended: 3, possible: 4, calledButAbsent: 0 },
        league: { attended: 10, possible: 12, calledButAbsent: 0 },
        daysSinceLastInjury: 30,
        lastInjuryDurationDays: 12,
        fatigue: 37,
        fatigueBreakdown: buildFatigueBreakdown({ trainingComponent: 30, matchComponent: 45, decayedMatchMinutes: 70 }),
        readiness: 82,
        readinessBreakdown: buildDailyLoadBreakdown({
          value: 82.3,
          missedEvents: [{ eventId: "ev-1", date: "2026-08-01T00:00:00Z", eventTypeId: 2, reason: "Enfermedad" }],
        }),
        matchesAbsentAttributableToPlayer: 2,
        minutesPlayedPercentOfSeasonTotal: 42.6,
        attributableAbsentMinutesPercentOfSeasonTotal: 12.4,
        minutesPlayedPercentOfAvailable: null,
        minutesTargetStatus: null,
        attributableAbsences: [],
        formStatus: 75,
        formStatusBreakdown: buildDailyLoadBreakdown({ value: 75.2 }),
      },
    ];
    const expected: PlayerStatistics[] = [
      {
        teamPlayerId: "tp-1",
        displayName: "Juan Pérez",
        position: "Delantero",
        dorsal: 9,
        goals: 3,
        yellowCards: 1,
        redCards: 0,
        minutesPlayed: 450,
        trainings: { attended: 14, possible: 16, calledButAbsent: 0 },
        friendlies: { attended: 3, possible: 4, calledButAbsent: 0 },
        league: { attended: 10, possible: 12, calledButAbsent: 0 },
        daysSinceLastInjury: 30,
        lastInjuryDurationDays: 12,
        fatigue: 37,
        fatigueBreakdown: buildFatigueBreakdown({ trainingComponent: 30, matchComponent: 45, decayedMatchMinutes: 70 }),
        readiness: 82,
        readinessBreakdown: buildDailyLoadBreakdown({
          value: 82.3,
          missedEvents: [{ eventId: "ev-1", date: "2026-08-01T00:00:00Z", eventTypeId: 2, reason: "Enfermedad" }],
        }),
        matchesAbsentAttributableToPlayer: 2,
        minutesPlayedPercentOfSeasonTotal: 42.6,
        attributableAbsentMinutesPercentOfSeasonTotal: 12.4,
        minutesPlayedPercentOfAvailable: null,
        minutesTargetStatus: null,
        attributableAbsences: [],
        formStatus: 75,
        formStatusBreakdown: buildDailyLoadBreakdown({ value: 75.2 }),
      },
    ];
    (client.get as any).mockResolvedValue({ data: apiResponse });

    const result = await getTeamPlayerStatistics("team-1");

    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith("/api/catalog/team/team-1/player-stats");
    expect(result).toEqual(expected);
  });

  it("propaga el rechazo cuando el cliente falla", async () => {
    const error = new Error("network error");
    (client.get as any).mockRejectedValue(error);

    await expect(getTeamPlayerStatistics("team-1")).rejects.toThrow("network error");
  });
});
