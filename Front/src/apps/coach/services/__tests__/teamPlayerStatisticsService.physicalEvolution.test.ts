import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import {
  getPlayerPhysicalEvolution,
  type PlayerPhysicalEvolution,
} from "../teamPlayerStatisticsService";

describe("teamPlayerStatisticsService.getPlayerPhysicalEvolution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("pide la evolución del jugador con el número de días y devuelve la respuesta tal cual", async () => {
    const apiResponse: PlayerPhysicalEvolution = {
      teamPlayerId: "tp-1",
      days: 56,
      formStatusAvailable: true,
      points: [{ date: "2026-09-30T00:00:00Z", formStatus: 62, readiness: 70, fatigue: 35 }],
      events: [],
      injuries: [],
    };
    vi.mocked(client.get).mockResolvedValue({ data: apiResponse });

    const result = await getPlayerPhysicalEvolution("team-1", "tp-1", 56);

    expect(client.get).toHaveBeenCalledWith(
      "/api/catalog/team/team-1/players/tp-1/physical-evolution",
      { params: { days: 56 } }
    );
    expect(result).toEqual(apiResponse);
  });
});
