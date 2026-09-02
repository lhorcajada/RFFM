import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../core/api/client", () => ({
  client: {
    get: vi.fn(),
  },
}));

import { client } from "../../../../../core/api/client";
import { clubService } from "../ClubService";

describe("ClubService.searchClubs — temporada param", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards temporada as a query param when provided", async () => {
    vi.mocked(client.get).mockResolvedValue({ data: [] });

    await clubService.searchClubs("Real Madrid", undefined, 21);

    expect(client.get).toHaveBeenCalledWith("clubs/search", {
      params: { search: "Real Madrid", temporada: "21" },
    });
  });

  it("omits temporada when not provided", async () => {
    vi.mocked(client.get).mockResolvedValue({ data: [] });

    await clubService.searchClubs("Real Madrid");

    expect(client.get).toHaveBeenCalledWith("clubs/search", {
      params: { search: "Real Madrid" },
    });
  });
});

describe("ClubService.getClubTeams — temporada param", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards temporada as a query param when provided", async () => {
    vi.mocked(client.get).mockResolvedValue({ data: [] });

    await clubService.getClubTeams("ABC123", 22);

    expect(client.get).toHaveBeenCalledWith("clubs/ABC123/teams", {
      params: { temporada: "22" },
    });
  });

  it("omits temporada when not provided", async () => {
    vi.mocked(client.get).mockResolvedValue({ data: [] });

    await clubService.getClubTeams("ABC123");

    expect(client.get).toHaveBeenCalledWith("clubs/ABC123/teams", {
      params: {},
    });
  });
});
