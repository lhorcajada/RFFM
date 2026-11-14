import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn() },
}));

import client from "../../../../core/api/client";
import { createTeamTraitRatings, getTeamLatestTraitRatings } from "../traitRatingService";
import type { TraitRating } from "../../types/traitRating";

const rating: TraitRating = {
  id: "r1",
  teamPlayerId: "tp1",
  ratedAt: "2026-11-09T00:00:00Z",
  trend: "up",
  levels: [{ traitKey: "traitCoverage", level: 4 }],
};

describe("traitRatingService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lee las últimas valoraciones por rasgos del equipo", async () => {
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [rating] });

    const result = await getTeamLatestTraitRatings("team-1");

    expect(client.get).toHaveBeenCalledWith("/api/catalog/team/team-1/trait-ratings/latest");
    expect(result).toEqual([rating]);
  });

  it("crea un lote de valoraciones por rasgos", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [rating] });
    const payload = {
      ratedAt: "2026-11-09T00:00:00.000Z",
      ratings: [{ teamPlayerId: "tp1", trend: "up" as const, levels: [{ traitKey: "traitCoverage", level: 4 }] }],
    };

    const result = await createTeamTraitRatings("team-1", payload);

    expect(client.post).toHaveBeenCalledWith("/api/catalog/team/team-1/trait-ratings", payload);
    expect(result).toEqual([rating]);
  });
});
