import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: vi.fn(() => ({
    team: { id: "team-1", name: "Equipo 1", club: { id: "club-1" } },
    teamTitleNode: <span>Equipo 1</span>,
    clubSubtitleNode: <span>Club 1</span>,
    loading: false,
  })),
}));

const mockGoToTeamDashboard = vi.fn();
vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => mockGoToTeamDashboard,
}));

const getSportEventByIdMock = vi.fn();
vi.mock("../../../services/sportEventService", () => ({
  getSportEventById: (...args: unknown[]) => getSportEventByIdMock(...args),
}));

vi.mock("../../../services/sportEventTypeService", () => ({
  default: {
    getSportEventTypes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../services/teamService", () => ({
  default: {
    getTeamById: vi.fn(),
    fetchTeamPhoto: vi.fn(),
  },
}));

vi.mock("../../../services/clubService", () => ({
  default: {
    getClubEmblem: vi.fn(),
  },
}));

vi.mock("../AttendanceTabs", () => ({
  default: () => null,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import AttendanceEvent from "../AttendanceEvent";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/attendance/event-1"]}>
      <Routes>
        <Route path="/coach/attendance/:id" element={<AttendanceEvent />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AttendanceEvent - navegación 'Volver'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navega a /coach/attendance?teamId=<teamId del evento> en vez de al dashboard del equipo", async () => {
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Entreno semanal",
      teamId: "team-1",
      eventType: "Entrenamiento",
    });

    renderPage();

    const backButton = await screen.findByRole("button", { name: /volver/i });
    await userEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/coach/attendance?teamId=team-1");
    expect(mockGoToTeamDashboard).not.toHaveBeenCalled();
  });
});
