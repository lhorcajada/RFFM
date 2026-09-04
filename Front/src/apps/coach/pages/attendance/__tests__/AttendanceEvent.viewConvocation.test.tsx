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

vi.mock("../components/SportEventDialog", () => ({
  default: () => null,
}));

const getTeamKitsMock = vi.fn().mockResolvedValue([]);
vi.mock("../../../services/kitService", () => ({
  getTeamKits: (...args: unknown[]) => getTeamKitsMock(...args),
}));

let convocationMock: {
  players: unknown[];
  mgmtCalled: string[];
  mgmtNotCalled: string[];
  mgmtPending: string[];
  mgmtPhotos: Record<string, string | null>;
  mgmtExcuseMap: Record<string, number | null>;
  excuseTypes: unknown[];
};
const useConvocationManagementSpy = vi.fn();
vi.mock("../../convocations/hooks/useConvocationManagement", () => ({
  useConvocationManagement: (...args: unknown[]) => {
    useConvocationManagementSpy(...args);
    return convocationMock;
  },
}));

const convocationDetailsDialogSpy = vi.fn();
vi.mock("../../convocations/components/ConvocationDetailsDialog", () => ({
  default: (props: any) => {
    convocationDetailsDialogSpy(props);
    return props.open ? <div data-testid="convocation-details-dialog">Convocatoria</div> : null;
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

describe("AttendanceEvent - botón Ver convocatoria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasRoleMock.mockReturnValue(true);
    getTeamKitsMock.mockResolvedValue([]);
    convocationMock = {
      players: [],
      mgmtCalled: [],
      mgmtNotCalled: [],
      mgmtPending: [],
      mgmtPhotos: {},
      mgmtExcuseMap: {},
      excuseTypes: [],
    };
  });

  it("muestra el botón cuando el evento es un partido y la convocatoria está confirmada por todos", async () => {
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Partido vs Rival",
      teamId: "team-1",
      eventType: "Partidos",
    });
    convocationMock.mgmtCalled = ["p1", "p2"];
    convocationMock.mgmtPending = [];

    renderPage();

    expect(await screen.findByRole("button", { name: /ver convocatoria/i })).toBeInTheDocument();
  });

  it("no muestra el botón cuando quedan jugadores pendientes de confirmar", async () => {
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Partido vs Rival",
      teamId: "team-1",
      eventType: "Partidos",
    });
    convocationMock.mgmtCalled = ["p1", "p2"];
    convocationMock.mgmtPending = ["p2"];

    renderPage();

    await screen.findByText("Partido vs Rival");
    expect(screen.queryByRole("button", { name: /ver convocatoria/i })).not.toBeInTheDocument();
  });

  it("no muestra el botón cuando no hay nadie convocado", async () => {
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Partido vs Rival",
      teamId: "team-1",
      eventType: "Partidos",
    });
    convocationMock.mgmtCalled = [];
    convocationMock.mgmtPending = [];

    renderPage();

    await screen.findByText("Partido vs Rival");
    expect(screen.queryByRole("button", { name: /ver convocatoria/i })).not.toBeInTheDocument();
  });

  it("no muestra el botón cuando el evento no es un partido o amistoso", async () => {
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Entreno semanal",
      teamId: "team-1",
      eventType: "Entrenamiento",
    });
    convocationMock.mgmtCalled = ["p1"];
    convocationMock.mgmtPending = [];

    renderPage();

    await screen.findByText("Entreno semanal");
    expect(screen.queryByRole("button", { name: /ver convocatoria/i })).not.toBeInTheDocument();
  });

  it("abre el diálogo de convocatoria al pulsar el botón", async () => {
    const user = userEvent.setup();
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      title: "Partido vs Rival",
      teamId: "team-1",
      eventType: "Partidos",
    });
    convocationMock.mgmtCalled = ["p1"];
    convocationMock.mgmtPending = [];

    renderPage();

    const btn = await screen.findByRole("button", { name: /ver convocatoria/i });
    await user.click(btn);

    expect(await screen.findByTestId("convocation-details-dialog")).toBeInTheDocument();
  });
});
