import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { getTeamPlayerStatistics, type PlayerStatistics } from "../teamPlayerStatisticsService";

describe("teamPlayerStatisticsService.getTeamPlayerStatistics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("hace una única llamada GET a /api/catalog/team/{teamId}/player-stats", async () => {
    const sample: PlayerStatistics[] = [
      {
        teamPlayerId: "tp-1",
        displayName: "Juan Pérez",
        position: "Delantero",
        dorsal: 9,
        goals: 3,
        yellowCards: 1,
        redCards: 0,
        minutesPlayed: 450,
        trainingsAttended: 14,
        matchesPlayed: 10,
        daysSinceLastInjury: 30,
        lastInjuryDurationDays: 12,
        formStatus: 82,
        formStatusBreakdown: {
          trainingComponent: 90,
          matchComponent: 60,
          trainingSessionsConsidered: 12,
          trainingSessionsBaseline: 16,
          matchMinutesInWindow: 210,
          matchMinutesExpected: 560,
          recentAbsences: [
            { eventId: "ev-1", date: "2026-08-01T00:00:00Z", reason: "Enfermedad", pointsImpact: -55 },
          ],
        },
      },
    ];
    (client.get as any).mockResolvedValue({ data: sample });

    const result = await getTeamPlayerStatistics("team-1");

    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith("/api/catalog/team/team-1/player-stats");
    expect(result).toEqual(sample);
  });

  it("propaga el rechazo cuando el cliente falla", async () => {
    const error = new Error("network error");
    (client.get as any).mockRejectedValue(error);

    await expect(getTeamPlayerStatistics("team-1")).rejects.toThrow("network error");
  });
});
