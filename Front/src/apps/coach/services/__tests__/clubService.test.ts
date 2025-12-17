import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { getUserClubs } from "../clubService";
import type { UserClubsApiResponse } from "../../types/userClubs";

describe("clubService.getUserClubs", () => {
  const sample: UserClubsApiResponse = [
    {
      clubId: "c1",
      clubName: "Club Uno",
      shieldUrl: "http://example.com/shield.png",
      role: "admin",
      roleId: 1,
      isCreator: true,
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns clubs when client responds", async () => {
    (client.get as any).mockResolvedValue({ data: sample });
    const res = await getUserClubs();
    expect(client.get).toHaveBeenCalledWith(
      "/api/catalog/user-clubs",
      undefined
    );
    expect(res).toEqual(sample);
  });

  it("sends Authorization header when token provided", async () => {
    (client.get as any).mockResolvedValue({ data: sample });
    const token = "tok_xyz";
    const res = await getUserClubs(token);
    expect(client.get).toHaveBeenCalledWith("/api/catalog/user-clubs", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res).toEqual(sample);
  });
});
