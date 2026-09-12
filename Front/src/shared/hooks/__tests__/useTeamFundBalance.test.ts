import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const getMyProfileMock = vi.fn();
vi.mock("../../../apps/coach/services/coachApi", () => ({
  getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
}));

const getCurrentMock = vi.fn();
vi.mock("../../../apps/coach/services/configurationCoachService", () => ({
  default: { getCurrent: (...args: unknown[]) => getCurrentMock(...args) },
}));

const getTeamFundMock = vi.fn();
vi.mock("../../../apps/coach/services/teamFundService", () => ({
  getTeamFund: (...args: unknown[]) => getTeamFundMock(...args),
}));

import useTeamFundBalance from "../useTeamFundBalance";

describe("useTeamFundBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the team fund balance via the user's profile teamId", async () => {
    getMyProfileMock.mockResolvedValue({ roleName: "Player", teamId: "team-1" });
    getTeamFundMock.mockResolvedValue({ teamId: "team-1", balance: 42, movements: [] });

    const { result } = renderHook(() => useTeamFundBalance());

    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.balance).toBe(42);
    expect(result.current.teamId).toBe("team-1");
    expect(getTeamFundMock).toHaveBeenCalledWith("team-1");
    expect(getCurrentMock).not.toHaveBeenCalled();
  });

  it("falls back to the coach's preferred team when the profile has no team", async () => {
    getMyProfileMock.mockResolvedValue({ roleName: "Coach", teamId: null });
    getCurrentMock.mockResolvedValue({ id: 1, coachId: "c1", preferredTeamId: "team-2" });
    getTeamFundMock.mockResolvedValue({ teamId: "team-2", balance: 100, movements: [] });

    const { result } = renderHook(() => useTeamFundBalance());

    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.balance).toBe(100);
    expect(result.current.teamId).toBe("team-2");
    expect(getTeamFundMock).toHaveBeenCalledWith("team-2");
  });

  it("stays not-visible when neither the profile nor the coach configuration resolve a team", async () => {
    getMyProfileMock.mockResolvedValue(null);
    getCurrentMock.mockResolvedValue(null);

    const { result } = renderHook(() => useTeamFundBalance());

    await waitFor(() => expect(getCurrentMock).toHaveBeenCalled());
    expect(result.current.visible).toBe(false);
    expect(result.current.teamId).toBeNull();
    expect(getTeamFundMock).not.toHaveBeenCalled();
  });

  it("stays not-visible when getTeamFund fails", async () => {
    getMyProfileMock.mockResolvedValue({ roleName: "Player", teamId: "team-3" });
    getTeamFundMock.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useTeamFundBalance());

    await waitFor(() => expect(getTeamFundMock).toHaveBeenCalled());
    expect(result.current.visible).toBe(false);
  });

  it("fails silently and stays not-visible when getMyProfile throws", async () => {
    getMyProfileMock.mockRejectedValue(new Error("boom"));
    getCurrentMock.mockResolvedValue(null);

    const { result } = renderHook(() => useTeamFundBalance());

    await waitFor(() => expect(result.current.visible).toBe(false));
  });

  it("refetches the balance when a rffm.team_fund_updated event is dispatched", async () => {
    getMyProfileMock.mockResolvedValue({ roleName: "Player", teamId: "team-1" });
    getTeamFundMock.mockResolvedValue({ teamId: "team-1", balance: 42, movements: [] });

    const { result } = renderHook(() => useTeamFundBalance());

    await waitFor(() => expect(result.current.balance).toBe(42));

    getTeamFundMock.mockResolvedValue({ teamId: "team-1", balance: 99, movements: [] });
    window.dispatchEvent(new CustomEvent("rffm.team_fund_updated"));

    await waitFor(() => expect(result.current.balance).toBe(99));
    expect(getTeamFundMock).toHaveBeenCalledTimes(2);
  });
});
