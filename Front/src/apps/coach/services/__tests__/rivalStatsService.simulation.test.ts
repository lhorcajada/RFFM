import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import client from "../../../../core/api/client";
import {
  getRivalSimulation,
  getRivalSimulationHistory,
  syncRivalSimulationRounds,
  type RivalSimulation,
  type RivalSimulationHistory,
} from "../rivalStatsService";

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

  it("sincroniza las simulaciones por jornada con un PUT", async () => {
    vi.mocked(client.put).mockResolvedValue({ data: undefined });

    await syncRivalSimulationRounds("team 1");

    expect(client.put).toHaveBeenCalledWith("/api/teams/team%201/rival-stats/simulation/rounds");
  });

  it("pide el historial de simulaciones por jornada", async () => {
    const history: RivalSimulationHistory = { ownTeamCode: "E1", totalHits: 3, totalEvaluated: 4, rounds: [] };
    vi.mocked(client.get).mockResolvedValue({ data: history });

    const result = await getRivalSimulationHistory("team-1");

    expect(client.get).toHaveBeenCalledWith("/api/teams/team-1/rival-stats/simulation/rounds");
    expect(result).toEqual(history);
  });
});
