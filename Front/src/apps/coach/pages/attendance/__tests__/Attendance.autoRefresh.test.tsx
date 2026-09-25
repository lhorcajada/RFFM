import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

let capturedRefresh: (() => void) | null = null;
vi.mock("../../../hooks/useAutoRefresh", () => ({
  default: (cb: () => void) => {
    capturedRefresh = cb;
  },
}));

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  },
}));

vi.mock("../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([]) },
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

vi.mock("../../../services/seasonService", () => ({
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "rffm.coach_active_season_changed",
  default: { getActiveSeason: vi.fn().mockResolvedValue({ id: "season-1", endDate: "2099-06-30" }) },
}));

const getEventAttendanceSummariesMock = vi.fn();
vi.mock("../../../services/eventAttendanceSummaryService", () => ({
  getEventAttendanceSummaries: (...args: unknown[]) => getEventAttendanceSummariesMock(...args),
}));

import Attendance from "../Attendance";

describe("Attendance - autorefresco de los resúmenes de convocatoria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    capturedRefresh = null;
    getSportEventsMock.mockResolvedValue({
      items: [{ id: "e1", title: "Evento 1", teamId: "team-1", startTime: "2099-09-01T18:00:00" }],
      totalPages: 1,
    });
    getEventAttendanceSummariesMock.mockResolvedValue([]);
  });

  it("vuelve a pedir los resúmenes de convocatoria en cada refresco automático", async () => {
    render(
      <MemoryRouter>
        <Attendance />
      </MemoryRouter>
    );
    await screen.findByText("Evento 1");
    await waitFor(() => expect(getEventAttendanceSummariesMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      capturedRefresh?.();
    });

    expect(getEventAttendanceSummariesMock).toHaveBeenCalledTimes(2);
  });
});
