import React from "react";
import { render, screen } from "@testing-library/react";
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

const hasRoleMock = vi.fn(() => true);
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    hasRole: (...args: unknown[]) => hasRoleMock(...args),
  },
}));

const sportEventDialogSpy = vi.fn();
vi.mock("../components/SportEventDialog", () => ({
  default: (props: any) => {
    sportEventDialogSpy(props);
    if (!props.open) return null;
    return <div data-testid="sport-event-dialog">Editar evento dialog</div>;
  },
}));

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

describe("AttendanceEvent - botón Editar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasRoleMock.mockReturnValue(true);
  });

  it("muestra el botón Editar cuando el coach tiene permisos y abre el diálogo de edición al pulsarlo", async () => {
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Entreno semanal",
      teamId: "team-1",
      eventType: "Entrenamiento",
    });

    renderPage();

    const editButton = await screen.findByRole("button", { name: /editar/i });
    await userEvent.click(editButton);

    expect(await screen.findByTestId("sport-event-dialog")).toBeInTheDocument();
  });

  it("no muestra el botón Editar cuando el usuario no tiene rol de edición", async () => {
    hasRoleMock.mockReturnValue(false);
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Entreno semanal",
      teamId: "team-1",
      eventType: "Entrenamiento",
    });

    renderPage();

    await screen.findByText("Entreno semanal");
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
  });
});
