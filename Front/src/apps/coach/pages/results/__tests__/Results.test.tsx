import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    title,
    subtitle,
    actionBar,
    children,
  }: {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    actionBar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      <h1>{title}</h1>
      <div data-testid="subtitle">{subtitle}</div>
      {actionBar}
      {children}
    </>
  ),
}));

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: vi.fn(),
}));

vi.mock("../../../../../shared/context/UserContext", () => ({
  useUser: () => ({ user: null }),
}));

vi.mock("../../../../../shared/hooks/usePrimaryTeam", () => ({
  default: () => ({ isPrimary: () => false }),
}));

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({ seasonId: 21, currentSeasonId: 21 }),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

const mockUseTeamAndClub = vi.fn();
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => mockUseTeamAndClub(),
}));

const mockHasFeatureAccess = vi.fn();
vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, hasFeatureAccess: mockHasFeatureAccess }),
}));

const mockUseCalendar = vi.fn();
vi.mock("../../../../../shared/hooks/useCalendar", () => ({
  default: (params: unknown) => mockUseCalendar(params),
}));

vi.mock("../components/MatchResultNotificationsToggle", () => ({
  default: () => <div>Interruptor de avisos de resultados</div>,
}));

import Results from "../Results";

const teamWithCompetition = {
  id: "team-1",
  name: "Infantil A",
  canEdit: true,
  club: { id: "club-1" },
  rffmCompetitionId: 555,
  rffmGroupId: 777,
};

const match = {
  matchRecordCode: "123",
  date: "04-10-2026",
  time: "10:00",
  localTeamName: "Equipo Local",
  visitorTeamName: "Equipo Visitante",
  localGoals: "2",
  visitorGoals: "1",
};

function calendarState(overrides: Record<string, unknown> = {}) {
  return {
    calendar: {
      round: 3,
      competitionName: "Liga Infantil Preferente",
      groupName: "Grupo 2",
      groupId: 777,
      rounds: [],
      matchDay: { date: "", matchDayNumber: 3, matches: [match] },
    },
    loading: false,
    selectedTab: 0,
    setSelectedTab: vi.fn(),
    rounds: [{ matchDayNumber: 3, date: "2026-10-04", name: "Jornada 3" }],
    matchesByRound: {},
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Results />
    </MemoryRouter>,
  );
}

describe("Results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamAndClub.mockReturnValue({ team: teamWithCompetition, loading: false });
    mockUseCalendar.mockReturnValue(calendarState());
    mockHasFeatureAccess.mockReturnValue(true);
  });

  function withoutCompetition(overrides: Record<string, unknown> = {}) {
    mockUseTeamAndClub.mockReturnValue({
      team: { ...teamWithCompetition, rffmCompetitionId: null, rffmGroupId: null, ...overrides },
      loading: false,
    });
    mockUseCalendar.mockReturnValue(calendarState({ calendar: null, rounds: [] }));
  }

  it("ofrece configurar la competición en la edición del equipo a quien puede editarlo", () => {
    withoutCompetition();

    renderPage();

    expect(screen.getByRole("link", { name: "Configurar competición" })).toHaveAttribute(
      "href",
      "/coach/clubs/club-1/teams/team-1/edit",
    );
  });

  it("no ofrece configurar la competición si el usuario no puede editar el equipo", () => {
    withoutCompetition({ canEdit: false });

    renderPage();

    expect(screen.queryByRole("link", { name: "Configurar competición" })).not.toBeInTheDocument();
  });

  it("no ofrece configurar la competición sin permiso de gestión de equipos", () => {
    withoutCompetition();
    mockHasFeatureAccess.mockReturnValue(false);

    renderPage();

    expect(screen.queryByRole("link", { name: "Configurar competición" })).not.toBeInTheDocument();
  });

  it("no ofrece configurar la competición cuando ya está configurada", () => {
    renderPage();

    expect(screen.queryByRole("link", { name: "Configurar competición" })).not.toBeInTheDocument();
  });

  it("muestra el título Resultados", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Resultados" })).toBeInTheDocument();
  });

  it("carga el calendario con la competición y el grupo RFFM del equipo", () => {
    renderPage();

    expect(mockUseCalendar).toHaveBeenLastCalledWith(
      expect.objectContaining({ season: "21", competition: "555", group: "777" }),
    );
  });

  it("muestra la competición y el grupo en la cabecera", () => {
    renderPage();

    expect(screen.getByTestId("subtitle")).toHaveTextContent("Liga Infantil Preferente");
    expect(screen.getByTestId("subtitle")).toHaveTextContent("Grupo 2");
  });

  it("no muestra filtros de temporada, competición ni grupo", () => {
    renderPage();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("muestra los partidos de la jornada seleccionada sin el botón de ver acta", () => {
    renderPage();

    expect(screen.getByRole("tab", { name: "Jornada 3" })).toBeInTheDocument();
    expect(screen.getByText("Equipo Local")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ver acta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver acta/i })).not.toBeInTheDocument();
  });

  it("avisa cuando el equipo no tiene competición RFFM configurada", () => {
    mockUseTeamAndClub.mockReturnValue({
      team: { ...teamWithCompetition, rffmCompetitionId: null, rffmGroupId: null },
      loading: false,
    });
    mockUseCalendar.mockReturnValue(calendarState({ calendar: null, rounds: [] }));

    renderPage();

    expect(
      screen.getByText(/el equipo no tiene una competición configurada/i),
    ).toBeInTheDocument();
  });

  it("muestra el interruptor de avisos de resultados", () => {
    renderPage();

    expect(screen.getByText("Interruptor de avisos de resultados")).toBeInTheDocument();
  });

  it("muestra un estado vacío cuando no hay jornadas", () => {
    mockUseCalendar.mockReturnValue(calendarState({ rounds: [] }));

    renderPage();

    expect(screen.getByText(/no hay jornadas disponibles/i)).toBeInTheDocument();
  });
});
