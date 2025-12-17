import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { getClubById } from "../clubService";
import type { ClubResponse } from "../../types/club";

describe("clubService.getClubById", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns club data when client responds", async () => {
    const sample: ClubResponse = {
      id: "1",
      name: "Club 1",
      country: { id: "es", name: "Spain", code: "ES" },
      emblemUrl: "http://example.com/e.png",
      invitationCode: "ABC123",
    };
    (client.get as any).mockResolvedValue({ data: sample });
    const res = await getClubById("1");
    expect(client.get).toHaveBeenCalledWith("/api/catalog/club/1");
    expect(res).toEqual(sample);
  });

  it("returns null when response has no data", async () => {
    (client.get as any).mockResolvedValue({ data: null });
    const res = await getClubById("2");
    expect(res).toBeNull();
  });

  it("throws when id is empty", async () => {
    await expect(async () => {
      // @ts-ignore
      await getClubById("");
    }).rejects.toThrow();
  });
});
