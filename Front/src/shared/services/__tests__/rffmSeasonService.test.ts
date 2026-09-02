import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../core/api/client", () => ({
  client: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import { client } from "../../../core/api/client";
import { getRffmSeasons, saveRffmSeasonPreference } from "../rffmSeasonService";

describe("rffmSeasonService.getRffmSeasons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls GET rffm/seasons and returns the parsed response", async () => {
    const payload = {
      currentSeasonId: 22,
      preferredSeasonId: 21,
      seasons: [
        { id: 22, label: "2026-2027" },
        { id: 21, label: "2025-2026" },
      ],
    };
    vi.mocked(client.get).mockResolvedValue({ data: payload });

    const result = await getRffmSeasons();

    expect(client.get).toHaveBeenCalledWith("rffm/seasons");
    expect(result).toEqual(payload);
  });
});

describe("rffmSeasonService.saveRffmSeasonPreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls PUT rffm/season-preference with the seasonId body", async () => {
    vi.mocked(client.put).mockResolvedValue({ status: 204 });

    await saveRffmSeasonPreference(21);

    expect(client.put).toHaveBeenCalledWith("rffm/season-preference", {
      seasonId: 21,
    });
  });
});
