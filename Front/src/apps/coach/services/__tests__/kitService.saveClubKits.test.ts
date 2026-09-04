import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { saveClubKits } from "../kitService";
import type { ClubKit, ClubKitInput } from "../kitService";

describe("kitService.saveClubKits", () => {
  beforeEach(() => vi.resetAllMocks());

  it("calls PUT /api/teams/{teamId}/kits with the given kits payload and returns the response", async () => {
    const kits: ClubKitInput[] = [
      { kitNumber: 1, shirtColor: "#0000FF", shortsColor: "#0000FF", socksColor: "#0000FF" },
      { kitNumber: 2, shirtColor: "#FF0000", shortsColor: "#FFFFFF", socksColor: "#111111" },
    ];
    const responseData: ClubKit[] = [
      { kitNumber: 1, shirtColor: "#0000FF", shortsColor: "#0000FF", socksColor: "#0000FF" },
      { kitNumber: 2, shirtColor: "#FF0000", shortsColor: "#FFFFFF", socksColor: "#FFFFFF" },
    ];
    (client.put as any).mockResolvedValue({ data: responseData });

    const res = await saveClubKits("team-1", kits);

    expect(client.put).toHaveBeenCalledWith("/api/teams/team-1/kits", { kits });
    expect(res).toEqual(responseData);
  });

  it("encodes the teamId in the URL", async () => {
    (client.put as any).mockResolvedValue({ data: [] });

    await saveClubKits("team/with space", []);

    expect(client.put).toHaveBeenCalledWith(
      `/api/teams/${encodeURIComponent("team/with space")}/kits`,
      { kits: [] },
    );
  });
});
