import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression test: usePlayerAutoLoad() carries a navigation side-effect
// (redirects any player-role user away from any route that isn't
// /coach/team-dashboard). Attendance.tsx only needs the `isPlayer` boolean
// for read-only badge rendering — it must NOT bounce a player back to the
// dashboard when they navigate here (e.g. from the "Eventos" quick-access
// card or an event link in the upcoming-events widget).

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ actionBar, children }: { actionBar?: React.ReactNode; children: React.ReactNode }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));

const mockTeam = { id: "team-1", name: "Equipo 1", club: { id: "club-1" } };
vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: vi.fn(() => ({
    team: mockTeam,
    teamTitleNode: <span>Equipo 1</span>,
    clubSubtitleNode: <span>Club 1</span>,
    loading: false,
  })),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

const getSportEventsMock = vi.fn();
vi.mock("../../../services/sportEventService", () => ({
  default: {
    getSportEvents: (...args: unknown[]) => getSportEventsMock(...args),
    getSportEventById: vi.fn(),
    deleteSportEvent: vi.fn(),
    createSportEvent: vi.fn(),
    updateSportEvent: vi.fn(),
    syncCalendarFromFederation: vi.fn(),
  },
}));

vi.mock("../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/eventAttendanceSummaryService", () => ({
  getEventAttendanceSummaries: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    // A Player role, with no cached teamId set — the exact scenario where
    // usePlayerAutoLoad would otherwise call getMyProfile() and redirect.
    hasRole: vi.fn().mockReturnValue(false),
    getRoles: vi.fn().mockReturnValue(["Player"]),
  },
}));

vi.mock("../components/SportEventDialog", () => ({
  default: () => null,
}));

// Mirrors the real scenario: the player's account has a linked team, so
// `getMyProfile()` resolves successfully and usePlayerAutoLoad's redirect
// branch actually runs (unlike letting the real, unmocked network call fail
// silently in a test environment, which would hide the bug).
vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue({ roleName: "Player", playerId: "tp1", teamId: "team-1" }),
  default: {
    getMyProfile: vi.fn().mockResolvedValue({ roleName: "Player", playerId: "tp1", teamId: "team-1" }),
  },
}));

const getActiveSeasonMock = vi.fn();
vi.mock("../../../services/seasonService", () => ({
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "rffm.coach_active_season_changed",
  default: { getActiveSeason: (...args: unknown[]) => getActiveSeasonMock(...args) },
}));

import Attendance from "../Attendance";

function renderAtAttendance() {
  return render(
    <MemoryRouter initialEntries={["/coach/attendance?teamId=team-1"]}>
      <Attendance />
    </MemoryRouter>
  );
}

describe("Attendance — a Player-role user is not redirected away", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: "2099-06-30" });
    getSportEventsMock.mockResolvedValue({
      items: [{ id: "e1", title: "Evento 1", teamId: "team-1", startTime: "2099-09-01T18:00:00" }],
      totalPages: 1,
    });
  });

  it("stays on the events list instead of bouncing back to /coach/team-dashboard", async () => {
    renderAtAttendance();

    await waitFor(() => {
      expect(screen.getByText("Evento 1")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
