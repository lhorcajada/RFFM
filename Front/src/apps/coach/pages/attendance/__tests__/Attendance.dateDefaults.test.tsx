import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultAttendanceDateRange, getSegmentFilter } from "../attendanceUtils";

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

const mockGoToTeamDashboard = vi.fn();
vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => mockGoToTeamDashboard,
}));

vi.mock("../../Dashboard/hooks/usePlayerAutoLoad", () => ({
  usePlayerAutoLoad: vi.fn(() => ({ isPlayer: false })),
}));

vi.mock("../../../hooks/useEventAttendanceSummaries", () => ({
  default: vi.fn(() => ({ summaries: {}, loading: false, error: null, refetch: vi.fn() })),
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

vi.mock("../EventCard", () => ({
  default: () => null,
}));

const getActiveSeasonMock = vi.fn();
vi.mock("../../../services/seasonService", () => ({
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "rffm.coach_active_season_changed",
  default: {
    getActiveSeason: (...args: unknown[]) => getActiveSeasonMock(...args),
  },
}));

import Attendance from "../Attendance";
import { COACH_ACTIVE_SEASON_CHANGED_EVENT } from "../../../services/seasonService";

function renderPage() {
  return render(
    <MemoryRouter>
      <Attendance />
    </MemoryRouter>
  );
}

async function openRange() {
  await userEvent.click(screen.getByRole("button", { name: /fechas/i }));
}

async function applyStart(value: string) {
  await openRange();
  const desde = screen.getByLabelText("Desde");
  await userEvent.clear(desde);
  await userEvent.type(desde, value);
  await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
}

describe("Attendance - filtros de fecha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    getSportEventsMock.mockResolvedValue({ items: [], totalPages: 1 });
  });

  it("empieza en «Próximos»: hoy como 'Desde' y el fin de temporada como 'Hasta'", async () => {
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: "2099-06-30" });

    renderPage();

    const expected = getDefaultAttendanceDateRange("2099-06-30");
    expect(screen.getByRole("button", { name: "Próximos" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => {
      expect(getSportEventsMock).toHaveBeenLastCalledWith(
        "team-1", 1, 10, expected.start, expected.end, false
      );
    });
    await openRange();
    expect(screen.getByLabelText("Desde")).toHaveValue(expected.start);
    expect(screen.getByLabelText("Hasta")).toHaveValue(expected.end);
  });

  it("«Pasados» pide los eventos anteriores a hoy en orden descendente", async () => {
    const season = { id: "season-1", startDate: "2098-08-01", endDate: "2099-06-30" };
    getActiveSeasonMock.mockResolvedValue(season);

    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Pasados" }));

    const expected = getSegmentFilter("past", season);
    await waitFor(() => {
      expect(getSportEventsMock).toHaveBeenLastCalledWith(
        "team-1", 1, 10, expected.start, expected.end, true
      );
    });
    expect(screen.getByRole("button", { name: "Pasados" })).toHaveAttribute("aria-pressed", "true");
  });

  it("un rango aplicado a mano deja los segmentos sin marcar y se consulta con él", async () => {
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: "2099-06-30" });

    renderPage();
    const seasonEnd = getDefaultAttendanceDateRange("2099-06-30").end;
    await waitFor(() => expect(getSportEventsMock.mock.calls.at(-1)?.[4]).toBe(seasonEnd));
    await applyStart("2020-01-01");

    await waitFor(() => {
      expect(getSportEventsMock).toHaveBeenLastCalledWith(
        "team-1", 1, 10, "2020-01-01", seasonEnd, false
      );
    });
    expect(screen.getByRole("button", { name: "Próximos" })).toHaveAttribute("aria-pressed", "false");
  });

  it("vuelve al rango por defecto al pulsar «Próximos» tras haber aplicado un rango propio", async () => {
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: "2099-06-30" });

    renderPage();
    await applyStart("2020-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Próximos" }));

    const expected = getDefaultAttendanceDateRange("2099-06-30");
    await waitFor(() => {
      expect(getSportEventsMock).toHaveBeenLastCalledWith(
        "team-1", 1, 10, expected.start, expected.end, false
      );
    });
  });

  it("recalcula el rango por defecto cuando cambia la temporada activa", async () => {
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: "2099-06-30" });

    renderPage();
    await waitFor(() => expect(getSportEventsMock).toHaveBeenCalled());

    const newExpected = getDefaultAttendanceDateRange("2099-12-15");
    window.dispatchEvent(
      new CustomEvent(COACH_ACTIVE_SEASON_CHANGED_EVENT, {
        detail: { season: { id: "season-2", endDate: "2099-12-15" } },
      })
    );

    await waitFor(() => {
      expect(getSportEventsMock).toHaveBeenLastCalledWith(
        "team-1", 1, 10, newExpected.start, newExpected.end, false
      );
    });
  });

  it("no sobrescribe el rango aplicado por el usuario cuando cambia la temporada", async () => {
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: "2099-06-30" });

    renderPage();
    await applyStart("2030-05-05");
    await waitFor(() => expect(getSportEventsMock.mock.calls.at(-1)?.[3]).toBe("2030-05-05"));

    window.dispatchEvent(
      new CustomEvent(COACH_ACTIVE_SEASON_CHANGED_EVENT, {
        detail: { season: { id: "season-2", endDate: "2099-12-15" } },
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getSportEventsMock.mock.calls.at(-1)?.[3]).toBe("2030-05-05");
  });

  it("cae al 31 de diciembre del año actual como 'Hasta' cuando el fin de temporada ya ha pasado", async () => {
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: "2000-01-01" });

    renderPage();

    const expected = getDefaultAttendanceDateRange("2000-01-01");
    await waitFor(() => {
      expect(getSportEventsMock).toHaveBeenLastCalledWith(
        "team-1", 1, 10, expected.start, expected.end, false
      );
    });
    expect(expected.end.endsWith("-12-31")).toBe(true);
  });
});
