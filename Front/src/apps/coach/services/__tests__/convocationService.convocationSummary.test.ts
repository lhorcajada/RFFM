import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { getPlayerConvocationSummary } from "../convocationService";

describe("convocationService.getPlayerConvocationSummary", () => {
  beforeEach(() => vi.resetAllMocks());

  it("hace GET a /api/catalog/team-player/{teamPlayerId}/convocation-summary y devuelve el resultado tal cual", async () => {
    const apiResponse = {
      totalStarts: 12,
      trainings: { attended: 9, possible: 10, calledButAbsent: 0 },
      friendlies: { attended: 2, possible: 3, calledButAbsent: 1 },
      league: { attended: 4, possible: 4, calledButAbsent: 0 },
      lastDeconvokedMatch: {
        eventId: "ev-1",
        matchDate: "2026-02-10T10:00:00Z",
        rivalName: "CD Rival",
        eventTypeId: 1,
        eventTypeName: "Partido",
        reason: "Decisión técnica",
      },
      lastAbsenceMatch: null,
    };
    (client.get as any).mockResolvedValue({ data: apiResponse });

    const result = await getPlayerConvocationSummary("tp-1");

    expect(client.get).toHaveBeenCalledWith(
      "/api/catalog/team-player/tp-1/convocation-summary",
    );
    expect(result).toEqual(apiResponse);
  });

  it("propaga el rechazo cuando el cliente falla", async () => {
    (client.get as any).mockRejectedValue(new Error("network error"));

    await expect(getPlayerConvocationSummary("tp-1")).rejects.toThrow("network error");
  });
});
