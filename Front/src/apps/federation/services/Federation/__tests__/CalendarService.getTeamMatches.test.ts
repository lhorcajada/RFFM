import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../core/api/client", () => ({
  client: { get: vi.fn() },
}));
vi.mock("../../../../apps/coach/services/authService", () => ({
  coachAuthService: { getUserId: vi.fn().mockReturnValue(null) },
}));
vi.mock("../SettingsService", () => ({
  settingsService: { getSettingsForUser: vi.fn() },
}));

import { client } from "../../../../../core/api/client";
import { CalendarService } from "../CalendarService";

describe("CalendarService.getTeamMatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] without calling GET /calendar when competition/group can't be resolved", async () => {
    const service = new CalendarService();

    const result = await service.getTeamMatches("team-1", { season: "22" });

    expect(result).toEqual([]);
    expect(client.get).not.toHaveBeenCalledWith(
      expect.stringContaining("calendar"),
    );
  });

  it("calls GET /calendar when competition and group are resolved", async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { rounds: [] } });
    const service = new CalendarService();

    await service.getTeamMatches("team-1", {
      season: "22",
      competition: "111",
      group: "222",
    });

    expect(client.get).toHaveBeenCalledWith(
      expect.stringContaining("calendar"),
    );
  });
});
