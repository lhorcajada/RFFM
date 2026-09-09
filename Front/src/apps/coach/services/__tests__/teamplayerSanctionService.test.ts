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
import { createPlayerSanction, updatePlayerSanction } from "../teamplayerSanctionService";
import type { SanctionRecord } from "../teamplayerSanctionService";

describe("teamplayerSanctionService — fine / isAutomatic", () => {
  beforeEach(() => vi.resetAllMocks());

  it("createPlayerSanction sends fine in the POST payload and returns isAutomatic/fine from the response", async () => {
    const created: SanctionRecord = {
      id: "s1",
      startDate: "2026-01-01",
      sanctionType: "Amonestación",
      description: null,
      estimatedEnd: null,
      endDate: null,
      isAutomatic: false,
      fine: 50,
    };
    (client.post as any).mockResolvedValue({ data: created });

    const res = await createPlayerSanction("player-1", {
      startDate: "2026-01-01",
      sanctionType: "Amonestación",
      fine: 50,
    });

    expect(client.post).toHaveBeenCalledWith(
      "/api/catalog/teamplayer/player-1/sanctions",
      expect.objectContaining({ fine: 50 })
    );
    expect(res).toEqual(created);
  });

  it("updatePlayerSanction sends fine in the PUT payload", async () => {
    const updated: SanctionRecord = {
      id: "s1",
      startDate: "2026-01-01",
      sanctionType: "Amarillas acumuladas (5)",
      description: null,
      estimatedEnd: null,
      endDate: null,
      isAutomatic: true,
      fine: 25,
    };
    (client.put as any).mockResolvedValue({ data: updated });

    const res = await updatePlayerSanction("player-1", "s1", {
      startDate: "2026-01-01",
      sanctionType: "Amarillas acumuladas (5)",
      fine: 25,
    });

    expect(client.put).toHaveBeenCalledWith(
      "/api/catalog/teamplayer/player-1/sanctions/s1",
      expect.objectContaining({ fine: 25 })
    );
    expect(res).toEqual(updated);
  });
});
