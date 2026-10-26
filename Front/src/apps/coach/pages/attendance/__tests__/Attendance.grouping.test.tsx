import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

vi.mock("../../../hooks/useEventAttendanceSummaries", () => ({
  default: vi.fn(() => ({ summaries: {}, loading: false, error: null, refetch: vi.fn() })),
}));

const getSportEventsMock = vi.fn();
vi.mock("../../../services/sportEventService", () => ({
  default: {
    getSportEvents: (...args: unknown[]) => getSportEventsMock(...args),
  },
}));

vi.mock("../../../services/sportEventTypeService", () => ({
  default: {
    getSportEventTypes: vi.fn().mockResolvedValue([
      { id: 1, name: "Entrenamiento" },
      { id: 2, name: "Partido" },
    ]),
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

vi.mock("../EventCard", () => ({
  default: ({ event, eventTypeName }: { event: { title: string }; eventTypeName?: string }) => (
    <div>{`${event.title}|${eventTypeName ?? ""}`}</div>
  ),
}));

const getActiveSeasonMock = vi.fn();
vi.mock("../../../services/seasonService", () => ({
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "rffm.coach_active_season_changed",
  default: {
    getActiveSeason: (...args: unknown[]) => getActiveSeasonMock(...args),
  },
}));

import Attendance from "../Attendance";

function renderPage() {
  return render(
    <MemoryRouter>
      <Attendance />
    </MemoryRouter>
  );
}

function inDays(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

describe("Attendance - lista agrupada por semana y filtros de tipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: "2099-06-30" });
  });

  it("agrupa los eventos por semana con su encabezado", async () => {
    getSportEventsMock.mockResolvedValue({
      items: [
        { id: "a", title: "Hoy", eventTypeId: 1, teamId: "team-1", startTime: inDays(0) },
        { id: "b", title: "Más adelante", eventTypeId: 1, teamId: "team-1", startTime: inDays(21) },
      ],
      totalPages: 1,
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Esta semana" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Semana del/ })).toBeInTheDocument();
  });

  it("muestra el estado vacío sin encabezados cuando no hay eventos", async () => {
    getSportEventsMock.mockResolvedValue({ items: [], totalPages: 1 });

    renderPage();

    expect(await screen.findByText("No hay eventos")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Esta semana" })).not.toBeInTheDocument();
  });

  it("el chip «Partidos» deja solo los eventos de tipo partido", async () => {
    getSportEventsMock.mockResolvedValue({
      items: [
        { id: "a", title: "Entreno", eventTypeId: 1, teamId: "team-1", startTime: inDays(0) },
        { id: "b", title: "Jornada 5", eventTypeId: 2, teamId: "team-1", startTime: inDays(1) },
      ],
      totalPages: 1,
    });

    renderPage();
    await screen.findByText(/Entreno\|/);
    await userEvent.click(screen.getByRole("button", { name: "Partidos" }));

    expect(screen.queryByText(/Entreno\|/)).not.toBeInTheDocument();
    expect(screen.getByText(/Jornada 5\|/)).toBeInTheDocument();
  });

  it("ofrece «Quitar filtros» cuando el chip activo no coincide con ningún evento", async () => {
    getSportEventsMock.mockResolvedValue({
      items: [{ id: "a", title: "Entreno", eventTypeId: 1, teamId: "team-1", startTime: inDays(0) }],
      totalPages: 1,
    });

    renderPage();
    await screen.findByText(/Entreno\|/);
    await userEvent.click(screen.getByRole("button", { name: "Torneos" }));

    expect(screen.getByText("No hay eventos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    expect(await screen.findByText(/Entreno\|/)).toBeInTheDocument();
  });
});
