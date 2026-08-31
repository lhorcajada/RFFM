import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Deliberately NOT mocking useEventAttendanceSummaries here — this test
// exercises the REAL hook wired to the REAL Attendance.tsx re-render cycle,
// to catch a runaway refetch loop that a fully-mocked hook would hide.

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

vi.mock("../../Dashboard/hooks/usePlayerAutoLoad", () => ({
  usePlayerAutoLoad: vi.fn(() => ({ isPlayer: false })),
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
  default: {
    getSportEventTypes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    hasRole: vi.fn().mockReturnValue(false),
    getRoles: vi.fn().mockReturnValue([]),
  },
}));

vi.mock("../components/SportEventDialog", () => ({
  default: () => null,
}));

const getActiveSeasonMock = vi.fn();
vi.mock("../../../services/seasonService", () => ({
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "rffm.coach_active_season_changed",
  default: {
    getActiveSeason: (...args: unknown[]) => getActiveSeasonMock(...args),
  },
}));

// Only the network layer is mocked — the hook itself runs for real.
const getEventAttendanceSummariesMock = vi.fn();
vi.mock("../../../services/eventAttendanceSummaryService", () => ({
  getEventAttendanceSummaries: (...args: unknown[]) => getEventAttendanceSummariesMock(...args),
}));

import Attendance from "../Attendance";

function renderPage() {
  return render(
    <MemoryRouter>
      <Attendance />
    </MemoryRouter>
  );
}

describe("Attendance — real useEventAttendanceSummaries integration (no runaway refetch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: "2099-06-30" });
    getSportEventsMock.mockResolvedValue({
      items: [
        { id: "e1", title: "Evento 1", teamId: "team-1", startTime: "2099-09-01T18:00:00" },
        { id: "e2", title: "Evento 2", teamId: "team-1", startTime: "2099-09-02T18:00:00" },
      ],
      totalPages: 1,
    });
    getEventAttendanceSummariesMock.mockResolvedValue([]);
  });

  it("does not crash and settles without an infinite render loop", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Evento 1")).toBeInTheDocument();
    });
    expect(screen.getByText("Evento 2")).toBeInTheDocument();
  });

  it("calls the attendance-summaries endpoint a bounded number of times, not repeatedly on every render", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Evento 1")).toBeInTheDocument();
    });

    // Let any pending microtasks/re-renders settle.
    await new Promise((resolve) => setTimeout(resolve, 50));

    // With stable event ids, the hook's `key` (sorted/joined ids) is stable
    // across re-renders even though `events.map(e => e.id)` creates a new
    // array reference each render — so this must stay at 1 call, not grow
    // unbounded.
    expect(getEventAttendanceSummariesMock.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
