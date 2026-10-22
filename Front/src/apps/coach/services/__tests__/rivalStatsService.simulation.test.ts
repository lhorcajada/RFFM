import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn() },
}));

import client from "../../../../core/api/client";
import { getRivalSimulation, type RivalSimulation } from "../rivalStatsService";

const simulation: RivalSimulation = {
  playedMatches: 10,
  pendingMatches: 20,
  usesSquadStrength: true,
  ownTeamCode: "E1",
  iterations: 10000,
  matches: [],
  standings: [],
};

describe("rivalStatsService — simulación", () => {
  beforeEach(() => vi.resetAllMocks());

  it("pide la simulación de la liga del equipo", async () => {
    vi.mocked(client.get).mockResolvedValue({ data: simulation });

    const result = await getRivalSimulation("team 1");

    expect(client.get).toHaveBeenCalledWith("/api/teams/team%201/rival-stats/simulation");
    expect(result).toEqual(simulation);
  });

  it("propaga el error si la petición falla", async () => {
    vi.mocked(client.get).mockRejectedValue(new Error("boom"));

    await expect(getRivalSimulation("team-1")).rejects.toThrow("boom");
  });
});
