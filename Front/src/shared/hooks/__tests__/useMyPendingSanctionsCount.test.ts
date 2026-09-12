import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

let rolesMock: string[] = [];
vi.mock("../../../apps/coach/services/authService", () => ({
  coachAuthService: {
    getRoles: () => rolesMock,
  },
}));

const getMyProfileMock = vi.fn();
vi.mock("../../../apps/coach/services/coachApi", () => ({
  getMyProfile: () => getMyProfileMock(),
}));

const getPlayerSanctionsMock = vi.fn();
vi.mock("../../../apps/coach/services/teamplayerSanctionService", async () => {
  const actual = await vi.importActual<
    typeof import("../../../apps/coach/services/teamplayerSanctionService")
  >("../../../apps/coach/services/teamplayerSanctionService");
  return {
    ...actual,
    getPlayerSanctions: (...args: unknown[]) => getPlayerSanctionsMock(...args),
  };
});

import useMyPendingSanctionsCount from "../useMyPendingSanctionsCount";

describe("useMyPendingSanctionsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rolesMock = [];
  });

  it("is not visible and fetches nothing for a Coach/Administrator user", async () => {
    rolesMock = ["Coach"];

    const { result } = renderHook(() => useMyPendingSanctionsCount());

    expect(result.current.visible).toBe(false);
    expect(result.current.count).toBe(0);
    expect(getMyProfileMock).not.toHaveBeenCalled();
  });

  it("is visible with count 0 when the Player/FamilyMember has no linked player", async () => {
    rolesMock = ["FamilyMember"];
    getMyProfileMock.mockResolvedValue({ roleName: "FamilyMember", playerId: null, teamId: "team-1" });

    const { result } = renderHook(() => useMyPendingSanctionsCount());

    expect(result.current.visible).toBe(true);
    await waitFor(() => expect(result.current.teamId).toBe("team-1"));
    expect(result.current.count).toBe(0);
    expect(getPlayerSanctionsMock).not.toHaveBeenCalled();
  });

  it("counts pending sanctions and exposes the team id for a Player role user", async () => {
    rolesMock = ["Player"];
    getMyProfileMock.mockResolvedValue({ roleName: "Player", playerId: "player-1", teamId: "team-1" });
    getPlayerSanctionsMock.mockResolvedValue([
      { id: "s1", startDate: "2026-01-01", sanctionType: "x", isAutomatic: false, fine: null, status: "Pending" },
      { id: "s2", startDate: "2026-01-01", sanctionType: "x", isAutomatic: false, fine: null, status: "Fulfilled", endDate: "2026-02-01" },
    ]);

    const { result } = renderHook(() => useMyPendingSanctionsCount());

    await waitFor(() => expect(result.current.count).toBe(1));
    expect(result.current.teamId).toBe("team-1");
    expect(getPlayerSanctionsMock).toHaveBeenCalledWith("player-1");
  });

  it("counts pending sanctions for a FamilyMember role user", async () => {
    rolesMock = ["FamilyMember"];
    getMyProfileMock.mockResolvedValue({ roleName: "FamilyMember", playerId: "player-2", teamId: "team-1" });
    getPlayerSanctionsMock.mockResolvedValue([
      { id: "s1", startDate: "2026-01-01", sanctionType: "x", isAutomatic: false, fine: 20, amountPaid: 0, status: "Fulfilled", endDate: "2026-02-01" },
    ]);

    const { result } = renderHook(() => useMyPendingSanctionsCount());

    await waitFor(() => expect(result.current.count).toBe(1));
  });
});
