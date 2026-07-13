import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UserProvider } from "../../../../../shared/context/UserContext";

const mockUseLocation = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useLocation: () => mockUseLocation(),
  };
});

const mockGetCurrent = vi.fn();
vi.mock("../../../services/configurationCoachService", () => ({
  default: {
    getCurrent: (...args: unknown[]) => mockGetCurrent(...args),
  },
}));

vi.mock("../../../services/seasonService", () => ({
  default: {
    getSeasons: vi.fn().mockResolvedValue([]),
    getActiveSeason: vi.fn().mockResolvedValue(null),
  },
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "coach.active_season_changed",
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getUserId: vi.fn().mockReturnValue("coach-1"),
    getToken: vi.fn().mockReturnValue(null),
    isAuthenticated: vi.fn().mockReturnValue(false),
  },
}));

vi.mock("../components/Seasons/SeasonOption/SeasonOption", () => ({
  default: () => <div>Panel Temporadas</div>,
}));

vi.mock("../components/ClubSelector/ClubSelector", () => ({
  default: () => <div>Panel Clubes</div>,
}));

vi.mock("../components/MyTeams/MyTeams", () => ({
  default: () => <div>Panel Equipos</div>,
}));

import Settings from "../Settings";

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrent.mockResolvedValue(null);
  });

  it("muestra la sección Temporadas por defecto", async () => {
    mockUseLocation.mockReturnValue({ pathname: "/coach/settings", search: "", state: null });

    render(
      <UserProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </UserProvider>
    );

    expect(await screen.findByText("Panel Temporadas")).toBeInTheDocument();
  });

  it("muestra la sección Mis equipos cuando llega con state.section = 'teams'", async () => {
    mockUseLocation.mockReturnValue({
      pathname: "/coach/settings",
      search: "",
      state: { section: "teams" },
    });

    render(
      <UserProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(mockGetCurrent).toHaveBeenCalled());
    expect(await screen.findByText("Panel Equipos")).toBeInTheDocument();
  });
});
