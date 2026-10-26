import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { getTeamLeagueStats } from "../leagueStatsService";

describe("leagueStatsService.getTeamLeagueStats", () => {
  beforeEach(() => vi.resetAllMocks());

  it("pide las estadísticas de liga del equipo y devuelve los datos", async () => {
    const sample = [
      { teamPlayerId: "tp-1", goals: 3, callUps: 10, starts: 8, yellowCards: 2, redCards: 0, minutesPlayed: 640 },
    ];
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: sample });

    const res = await getTeamLeagueStats("team-1");

    expect(client.get).toHaveBeenCalledWith("/api/catalog/team/team-1/league-stats");
    expect(res).toEqual(sample);
  });

  it("devuelve una lista vacía cuando la petición falla", async () => {
    (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network"));

    await expect(getTeamLeagueStats("team-1")).resolves.toEqual([]);
  });
});
