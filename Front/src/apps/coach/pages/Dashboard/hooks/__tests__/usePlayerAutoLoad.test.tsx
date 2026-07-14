import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
const mockGetRoles = vi.fn();
const mockGetMyProfile = vi.fn();
const mockUseLocation = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
  };
});

vi.mock("../../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => mockGetRoles(),
  },
}));

vi.mock("../../../../services/coachApi", () => ({
  getMyProfile: () => mockGetMyProfile(),
}));

import { usePlayerAutoLoad } from "../usePlayerAutoLoad";

function HookProbe() {
  usePlayerAutoLoad();
  return null;
}

describe("usePlayerAutoLoad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: "/coach/dashboard", search: "" });
    mockGetMyProfile.mockResolvedValue(null);
    localStorage.clear();
  });

  it("redirects family users with a cached team to the team dashboard", async () => {
    mockGetRoles.mockReturnValue(["FamilyPlayer"]);
    localStorage.setItem("coach_player_teamId", "team-42");

    render(<HookProbe />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/coach/team-dashboard?teamId=team-42",
        { replace: true }
      );
    });
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });

  it("redirects players already on coach dashboard with teamId to the team dashboard", async () => {
    mockGetRoles.mockReturnValue(["Player"]);
    mockUseLocation.mockReturnValue({
      pathname: "/coach/dashboard",
      search: "?teamId=team-55&seasonId=2026",
    });

    render(<HookProbe />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/coach/team-dashboard?teamId=team-55&seasonId=2026",
        { replace: true }
      );
    });
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });

  it("loads the profile team for family members when there is no cached team", async () => {
    mockGetRoles.mockReturnValue(["FamilyMember"]);
    mockGetMyProfile.mockResolvedValue({ teamId: "team-77" });

    render(<HookProbe />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/coach/team-dashboard?teamId=team-77",
        { replace: true }
      );
    });
    expect(localStorage.getItem("coach_player_teamId")).toBe("team-77");
  });

  it("redirects players without a linked team to AppSelector to trigger re-linking", async () => {
    mockGetRoles.mockReturnValue(["Player"]);
    mockGetMyProfile.mockResolvedValue({ teamId: null });

    render(<HookProbe />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/appSelector", {
        replace: true,
        state: { needsTeamRelink: true },
      });
    });
  });
});