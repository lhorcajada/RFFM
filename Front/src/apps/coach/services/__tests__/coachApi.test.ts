import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

import { getMyProfile } from "../coachApi";

describe("coachApi.getMyProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a teamPlayerId field from the API response", async () => {
    mockGet.mockResolvedValue({
      data: {
        roleName: "Player",
        playerId: "p1",
        teamId: "t1",
        teamPlayerId: "tp1",
      },
    });

    const profile = await getMyProfile();

    expect(profile?.teamPlayerId).toBe("tp1");
  });
});
