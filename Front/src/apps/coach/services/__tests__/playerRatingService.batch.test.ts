import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { createTeamRatings, type CreateTeamRatingsPayload } from "../playerRatingService";

const payload: CreateTeamRatingsPayload = {
  ratedAt: "2026-10-13T00:00:00.000Z",
  ratings: [
    {
      teamPlayerId: "tp-1",
      isGoalkeeper: false,
      answers: [{ characteristicKey: "physicalSpeed", level: 7, concept: "Veloz", categoryKey: "physical" }],
      notes: null,
    },
  ],
};

describe("playerRatingService — createTeamRatings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envía el lote al endpoint de valoraciones del equipo", async () => {
    vi.mocked(client.post).mockResolvedValue({ data: [] });

    await createTeamRatings("team-1", payload);

    expect(client.post).toHaveBeenCalledWith("/api/catalog/team/team-1/ratings", payload);
  });

  it("devuelve las valoraciones creadas", async () => {
    const created = [{ id: "rating-1", teamPlayerId: "tp-1" }];
    vi.mocked(client.post).mockResolvedValue({ data: created });

    await expect(createTeamRatings("team-1", payload)).resolves.toEqual(created);
  });
});
