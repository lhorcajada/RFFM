import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultAttendanceDateRange } from "../attendanceUtils";

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

describe("Attendance - filtros de fecha por defecto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    getSportEventsMock.mockResolvedValue({ items: [], totalPages: 1 });
  });

  it("usa hoy como 'Desde' y el fin de temporada como 'Hasta' al cargar la página", async () => {
    const seasonEndDate = "2099-06-30";
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: seasonEndDate });

    renderPage();

    const expected = getDefaultAttendanceDateRange(seasonEndDate);

    await waitFor(() => {
      expect(screen.getByLabelText("Hasta")).toHaveValue(expected.end);
    });
    expect(screen.getByLabelText("Desde")).toHaveValue(expected.start);
  });

  it("recalcula el rango al pulsar 'Limpiar' tras haber editado las fechas manualmente", async () => {
    const seasonEndDate = "2099-06-30";
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: seasonEndDate });

    renderPage();

    const expected = getDefaultAttendanceDateRange(seasonEndDate);
    await waitFor(() => {
      expect(screen.getByLabelText("Desde")).toHaveValue(expected.start);
    });

    const desdeInput = screen.getByLabelText("Desde");
    await userEvent.clear(desdeInput);
    await userEvent.type(desdeInput, "2020-01-01");
    await waitFor(() => expect(desdeInput).toHaveValue("2020-01-01"));

    await userEvent.click(screen.getByRole("button", { name: "Limpiar" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Desde")).toHaveValue(expected.start);
    });
    expect(screen.getByLabelText("Hasta")).toHaveValue(expected.end);
  });

  it("recalcula el rango por defecto cuando cambia la temporada activa", async () => {
    const initialSeasonEndDate = "2099-06-30";
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: initialSeasonEndDate });

    renderPage();

    const initialExpected = getDefaultAttendanceDateRange(initialSeasonEndDate);
    await waitFor(() => {
      expect(screen.getByLabelText("Hasta")).toHaveValue(initialExpected.end);
    });

    const newSeasonEndDate = "2099-12-15";
    const newExpected = getDefaultAttendanceDateRange(newSeasonEndDate);

    window.dispatchEvent(
      new CustomEvent(COACH_ACTIVE_SEASON_CHANGED_EVENT, {
        detail: { season: { id: "season-2", endDate: newSeasonEndDate } },
      })
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Hasta")).toHaveValue(newExpected.end);
    });
    expect(screen.getByLabelText("Desde")).toHaveValue(newExpected.start);
  });

  it("no sobrescribe las fechas editadas manualmente por el usuario cuando cambia la temporada", async () => {
    const seasonEndDate = "2099-06-30";
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: seasonEndDate });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Hasta")).toHaveValue(getDefaultAttendanceDateRange(seasonEndDate).end);
    });

    const desdeInput = screen.getByLabelText("Desde");
    await userEvent.clear(desdeInput);
    await userEvent.type(desdeInput, "2030-05-05");
    await waitFor(() => expect(desdeInput).toHaveValue("2030-05-05"));

    window.dispatchEvent(
      new CustomEvent(COACH_ACTIVE_SEASON_CHANGED_EVENT, {
        detail: { season: { id: "season-2", endDate: "2099-12-15" } },
      })
    );

    // Give the effect a chance to run, then assert the manual edit is preserved.
    await waitFor(() => {
      expect(screen.getByLabelText("Desde")).toHaveValue("2030-05-05");
    });
  });

  it("cae al 31 de diciembre del año actual como 'Hasta' cuando el fin de temporada ya ha pasado", async () => {
    const pastSeasonEndDate = "2000-01-01";
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", endDate: pastSeasonEndDate });

    renderPage();

    const expected = getDefaultAttendanceDateRange(pastSeasonEndDate);

    await waitFor(() => {
      expect(screen.getByLabelText("Hasta")).toHaveValue(expected.end);
    });
    expect(expected.end.endsWith("-12-31")).toBe(true);
  });
});
