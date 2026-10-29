import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("../seasonService", () => ({
  default: { getActiveSeason: vi.fn() },
}));

import client from "../../../../core/api/client";
import seasonService from "../seasonService";
import { createTeamsBatch } from "../teamService";

describe("teamService.createTeamsBatch", () => {
  beforeEach(() => vi.resetAllMocks());

  it("envía el lote con la temporada activa a POST /api/catalog/teams/batch", async () => {
    (seasonService.getActiveSeason as any).mockResolvedValue({ id: "s1" });
    (client.post as any).mockResolvedValue({ data: { created: [{ id: "t1", name: "Cadete C" }], skipped: [] } });

    const result = await createTeamsBatch("club-1", { categoryId: 3, leagueId: null, letters: ["C"] });

    expect(client.post).toHaveBeenCalledWith("/api/catalog/teams/batch", {
      clubId: "club-1",
      seasonId: "s1",
      categoryId: 3,
      leagueId: null,
      letters: ["C"],
    });
    expect(result.created).toHaveLength(1);
  });

  it("usa el seasonId indicado sin consultar la temporada activa", async () => {
    (client.post as any).mockResolvedValue({ data: { created: [], skipped: ["Cadete A"] } });

    await createTeamsBatch("club-1", { categoryId: 3, letters: ["A"], seasonId: "s9" });

    expect(seasonService.getActiveSeason).not.toHaveBeenCalled();
    expect((client.post as any).mock.calls[0][1].seasonId).toBe("s9");
  });
});
