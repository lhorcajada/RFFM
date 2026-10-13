import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

const hasRoleMock = vi.fn((_role: string) => true);
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    hasRole: (role: string) => hasRoleMock(role),
  },
}));

vi.mock("../components/SportEventDialog", () => ({
  default: () => null,
}));

vi.mock("../../../services/kitService", () => ({
  getTeamKits: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../convocations/hooks/useConvocationManagement", () => ({
  useConvocationManagement: () => ({
    players: [],
    mgmtCalled: [],
    mgmtNotCalled: [],
    mgmtPending: [],
    mgmtPhotos: {},
    mgmtExcuseMap: {},
    excuseTypes: [],
  }),
}));

vi.mock("../../convocations/components/ConvocationDetailsDialog", () => ({
  default: () => null,
}));

const getSessionsMock = vi.fn();
vi.mock("../../../services/trainingService", () => ({
  default: {
    getSessions: (...args: unknown[]) => getSessionsMock(...args),
  },
}));

import AttendanceEvent from "../AttendanceEvent";

function SessionEditorProbe() {
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "";
  return (
    <div>
      <div data-testid="session-editor-search">{location.search}</div>
      <div data-testid="session-editor-return-to">{returnTo}</div>
    </div>
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/coach/attendance/event-1"]}>
      <Routes>
        <Route path="/coach/attendance/:id" element={<AttendanceEvent />} />
        <Route path="/coach/trainings/new-session" element={<SessionEditorProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

const trainingEvent = {
  id: "event-1",
  title: "Entreno semanal",
  teamId: "team-1",
  eventType: "Entrenamiento",
  eveDateTime: "2026-09-10T18:00:00",
};

describe("AttendanceEvent - botón Ir al entrenamiento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasRoleMock.mockImplementation(() => true);
    getSportEventByIdMock.mockResolvedValue(trainingEvent);
    getSessionsMock.mockResolvedValue([]);
  });

  it("lleva al entrenamiento asociado cuando el evento tiene una sesión vinculada", async () => {
    getSessionsMock.mockResolvedValue([
      { id: "sess-other", sportEventId: "event-99" },
      { id: "sess-1", sportEventId: "event-1" },
    ]);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /ir al entrenamiento/i }));

    const search = new URLSearchParams((await screen.findByTestId("session-editor-search")).textContent ?? "");
    expect(getSessionsMock).toHaveBeenCalledWith("team-1");
    expect(search.get("sessionId")).toBe("sess-1");
    expect(search.get("teamId")).toBe("team-1");
    expect(search.get("clubId")).toBe("club-1");
  });

  it("al volver desde el entrenamiento regresa a la convocatoria del evento", async () => {
    getSessionsMock.mockResolvedValue([{ id: "sess-1", sportEventId: "event-1" }]);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /ir al entrenamiento/i }));

    expect(await screen.findByTestId("session-editor-return-to")).toHaveTextContent("/coach/attendance/event-1");
  });

  it("avisa de que no hay entrenamiento asociado y pregunta si quiere crearlo", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /ir al entrenamiento/i }));

    expect(await screen.findByText(/no tiene un entrenamiento asociado/i)).toBeInTheDocument();
    expect(screen.getByText(/¿quieres crearlo\?/i)).toBeInTheDocument();
    expect(screen.queryByTestId("session-editor-search")).not.toBeInTheDocument();
  });

  it("al aceptar crearlo abre una sesión nueva ya vinculada al evento y a su fecha", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /ir al entrenamiento/i }));
    await userEvent.click(await screen.findByRole("button", { name: /crear entrenamiento/i }));

    const search = new URLSearchParams((await screen.findByTestId("session-editor-search")).textContent ?? "");
    expect(search.get("sessionId")).toBeNull();
    expect(search.get("sportEventId")).toBe("event-1");
    expect(search.get("date")).toBe("2026-09-10");
    expect(search.get("teamId")).toBe("team-1");
    expect(search.get("clubId")).toBe("club-1");
  });

  it("al cancelar la creación se queda en la convocatoria", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /ir al entrenamiento/i }));
    await userEvent.click(await screen.findByRole("button", { name: /cancelar/i }));

    expect(await screen.findByRole("button", { name: /ir al entrenamiento/i })).toBeInTheDocument();
    expect(screen.queryByTestId("session-editor-search")).not.toBeInTheDocument();
  });

  it("no muestra el botón a usuarios que no son entrenadores", async () => {
    hasRoleMock.mockImplementation((role: string) => role !== "Coach");
    renderPage();

    await screen.findByText("Entreno semanal");
    expect(screen.queryByRole("button", { name: /ir al entrenamiento/i })).not.toBeInTheDocument();
  });

  it("no muestra el botón en eventos que no son entrenamientos", async () => {
    getSportEventByIdMock.mockResolvedValue({ ...trainingEvent, title: "Partido vs Rival", eventType: "Partidos" });
    renderPage();

    await screen.findByText("Partido vs Rival");
    expect(screen.queryByRole("button", { name: /ir al entrenamiento/i })).not.toBeInTheDocument();
  });

  it("avisa con un mensaje de error si no se puede consultar el entrenamiento asociado", async () => {
    getSessionsMock.mockRejectedValue(new Error("network"));
    const snackbarListener = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbarListener);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /ir al entrenamiento/i }));

    await vi.waitFor(() => expect(snackbarListener).toHaveBeenCalled());
    const detail = (snackbarListener.mock.calls[0][0] as CustomEvent<{ severity: string }>).detail;
    expect(detail.severity).toBe("error");
    window.removeEventListener("rffm.show_snackbar", snackbarListener);
  });
});
