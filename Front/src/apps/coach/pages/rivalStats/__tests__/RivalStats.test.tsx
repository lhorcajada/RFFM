import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    title,
    actionBar,
    children,
  }: {
    title?: React.ReactNode;
    actionBar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      <h1>{title}</h1>
      {actionBar}
      {children}
    </>
  ),
}));

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: vi.fn(),
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

const mockUseRivalStats = vi.fn();
vi.mock("../../../hooks/useRivalStats", () => ({
  default: (teamId?: string) => mockUseRivalStats(teamId),
}));

vi.mock("../../../services/rivalStatsService", () => ({
  getRivalTeamStats: vi.fn(),
}));

import RivalStats from "../RivalStats";
import { getRivalTeamStats, type RivalStats as RivalStatsType } from "../../../services/rivalStatsService";

const team = {
  id: "team-1",
  name: "Infantil A",
  canEdit: true,
  club: { id: "club-1" },
  rffmCompetitionId: 555,
  rffmGroupId: 777,
  rffmTeamCode: "E2",
};

function stats(overrides: Partial<RivalStatsType> = {}): RivalStatsType {
  return {
    status: "Completed",
    totalPlayers: 40,
    processedPlayers: 40,
    failedPlayers: 0,
    completedAt: "2026-10-12T08:00:00Z",
    nextRefreshAllowedAt: null,
    errorMessage: null,
    ownTeamCode: "E2",
    teams: [
      { teamCode: "E2", teamName: "CD Propio", shieldUrl: null, playerCount: 20, isOwnTeam: true },
      { teamCode: "E1", teamName: "UD Rival", shieldUrl: null, playerCount: 18, isOwnTeam: false },
    ],
    ...overrides,
  };
}

function hookState(overrides: Record<string, unknown> = {}) {
  return {
    stats: stats(),
    loading: false,
    error: false,
    requesting: false,
    generate: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RivalStats />
    </MemoryRouter>,
  );
}

describe("RivalStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamAndClub.mockReturnValue({ team, loading: false });
    mockHasFeatureAccess.mockReturnValue(true);
    mockUseRivalStats.mockReturnValue(hookState());
    vi.mocked(getRivalTeamStats).mockResolvedValue({
      teamCode: "E1",
      teamName: "UD Rival",
      shieldUrl: null,
      players: [
        {
          playerCode: "P1",
          playerName: "LEO AJENO",
          birthYear: 2012,
          position: "Delantero",
          seasons: [
            {
              seasonId: 22,
              seasonName: "2026-2027",
              stats: { called: 4, starter: 4, substitute: 0, played: 4, goals: 5, yellow: 1, red: 0, doubleYellow: 0 },
              teams: [],
            },
            {
              seasonId: 21,
              seasonName: "2025-2026",
              stats: { called: 22, starter: 20, substitute: 2, played: 21, goals: 17, yellow: 3, red: 0, doubleYellow: 0 },
              teams: [],
            },
          ],
        },
      ],
    });
  });

  it("muestra el título de la página", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Estadísticas de rivales" })).toBeInTheDocument();
  });

  it("ofrece abrir la simulación de la liga", () => {
    renderPage();

    expect(screen.getByRole("link", { name: /simulación/i })).toHaveAttribute("href", "/coach/rival-stats/simulation");
  });

  it("no ofrece la simulación si el equipo no tiene competición", () => {
    mockUseTeamAndClub.mockReturnValue({ team: { ...team, rffmCompetitionId: null, rffmGroupId: null }, loading: false });

    renderPage();

    expect(screen.queryByRole("link", { name: /simulación/i })).not.toBeInTheDocument();
  });

  it("carga las estadísticas del equipo seleccionado", () => {
    renderPage();

    expect(mockUseRivalStats).toHaveBeenLastCalledWith("team-1");
  });

  it("sin estadísticas generadas ofrece generarlas", async () => {
    const state = hookState({ stats: null });
    mockUseRivalStats.mockReturnValue(state);

    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Generar estadísticas" }));

    expect(screen.getByText(/todavía no se han generado/i)).toBeInTheDocument();
    expect(state.generate).toHaveBeenCalled();
  });

  it("mientras se generan muestra el progreso", () => {
    mockUseRivalStats.mockReturnValue(
      hookState({ stats: stats({ status: "Running", totalPlayers: 40, processedPlayers: 12, completedAt: null, teams: [] }) }),
    );

    renderPage();

    expect(screen.getByText("Generando estadísticas: 12 de 40 jugadores")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actualizar" })).not.toBeInTheDocument();
  });

  it("mientras se actualizan sigue mostrando los equipos anteriores", () => {
    mockUseRivalStats.mockReturnValue(hookState({ stats: stats({ status: "Running", processedPlayers: 3 }) }));

    renderPage();

    expect(screen.getByText("UD Rival")).toBeInTheDocument();
  });

  it("con las estadísticas listas muestra la última actualización y los equipos de la liga", () => {
    renderPage();

    expect(screen.getByText(/última actualización:/i)).toBeInTheDocument();
    expect(screen.getByText("CD Propio")).toBeInTheDocument();
    expect(screen.getByText("UD Rival")).toBeInTheDocument();
    expect(screen.getByText("18 jugadores")).toBeInTheDocument();
  });

  it("marca el equipo propio", () => {
    renderPage();

    const ownTeam = screen.getByRole("button", { name: /CD Propio/ });
    expect(within(ownTeam).getByText("Tu equipo")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /UD Rival/ })).queryByText("Tu equipo")).not.toBeInTheDocument();
  });

  it("permite actualizar las estadísticas", async () => {
    const state = hookState();
    mockUseRivalStats.mockReturnValue(state);

    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    expect(state.refresh).toHaveBeenCalled();
  });

  it("deshabilita actualizar si la última actualización es demasiado reciente", () => {
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockUseRivalStats.mockReturnValue(hookState({ stats: stats({ nextRefreshAllowedAt: inOneHour }) }));

    renderPage();

    expect(screen.getByRole("button", { name: "Actualizar" })).toBeDisabled();
    expect(screen.getByText(/podrás actualizar a partir de las/i)).toBeInTheDocument();
  });

  it("si la última generación falló avisa y permite reintentar", async () => {
    const state = hookState({ stats: stats({ status: "Failed", errorMessage: "No se pudieron obtener los equipos del grupo." }) });
    mockUseRivalStats.mockReturnValue(state);

    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.getByText("No se pudieron obtener los equipos del grupo.")).toBeInTheDocument();
    expect(state.refresh).toHaveBeenCalled();
    expect(screen.getByText("UD Rival")).toBeInTheDocument();
  });

  it("avisa de los jugadores cuya ficha no se pudo obtener", () => {
    mockUseRivalStats.mockReturnValue(hookState({ stats: stats({ failedPlayers: 3 }) }));

    renderPage();

    expect(screen.getByText(/no se pudo obtener la ficha de 3 jugadores/i)).toBeInTheDocument();
  });

  it("al abrir un equipo carga y muestra sus jugadores con las dos temporadas", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /UD Rival/ }));

    expect(await screen.findByText("LEO AJENO")).toBeInTheDocument();
    expect(getRivalTeamStats).toHaveBeenCalledWith("team-1", "E1");
    expect(screen.getByText("2012 · Delantero")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Temporada 2026-2027" })).getByLabelText("Goles")).toHaveTextContent("5");
    expect(within(screen.getByRole("region", { name: "Temporada 2025-2026" })).getByLabelText("Goles")).toHaveTextContent("17");
  });

  it("los jugadores de un equipo se cargan una sola vez aunque se cierre y se vuelva a abrir", async () => {
    renderPage();
    const teamButton = screen.getByRole("button", { name: /UD Rival/ });

    await userEvent.click(teamButton);
    await screen.findByText("LEO AJENO");
    await userEvent.click(teamButton);
    await userEvent.click(teamButton);

    await waitFor(() => expect(screen.getByText("LEO AJENO")).toBeInTheDocument());
    expect(getRivalTeamStats).toHaveBeenCalledTimes(1);
  });

  it("si los jugadores de un equipo no cargan lo indica", async () => {
    vi.mocked(getRivalTeamStats).mockRejectedValue(new Error("boom"));
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /UD Rival/ }));

    expect(await screen.findByText("No se han podido cargar los jugadores del equipo.")).toBeInTheDocument();
  });

  it("un jugador sin estadísticas guardadas lo indica", async () => {
    vi.mocked(getRivalTeamStats).mockResolvedValue({
      teamCode: "E1",
      teamName: "UD Rival",
      shieldUrl: null,
      players: [{ playerCode: "P2", playerName: "SIN DATOS", birthYear: null, position: null, seasons: [] }],
    });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /UD Rival/ }));

    expect(await screen.findByText("Sin estadísticas en las dos últimas temporadas.")).toBeInTheDocument();
  });

  it("si el equipo no tiene código RFFM avisa para elegirlo en la edición del equipo", () => {
    mockUseTeamAndClub.mockReturnValue({ team: { ...team, rffmTeamCode: null }, loading: false });
    mockUseRivalStats.mockReturnValue(
      hookState({ stats: stats({ ownTeamCode: null, teams: stats().teams.map((t) => ({ ...t, isOwnTeam: false })) }) }),
    );

    renderPage();

    expect(screen.getByRole("link", { name: "Elegir mi equipo" })).toHaveAttribute(
      "href",
      "/coach/clubs/club-1/teams/team-1/edit",
    );
    expect(screen.queryByText("Tu equipo")).not.toBeInTheDocument();
  });

  it("avisa cuando el equipo no tiene competición RFFM configurada", () => {
    mockUseTeamAndClub.mockReturnValue({
      team: { ...team, rffmCompetitionId: null, rffmGroupId: null },
      loading: false,
    });

    renderPage();

    expect(screen.getByText(/el equipo no tiene una competición configurada/i)).toBeInTheDocument();
    expect(mockUseRivalStats).toHaveBeenLastCalledWith(undefined);
  });

  it("pide seleccionar un equipo cuando no hay ninguno", () => {
    mockUseTeamAndClub.mockReturnValue({ team: null, loading: false });

    renderPage();

    expect(screen.getByText("Selecciona un equipo para ver las estadísticas de sus rivales.")).toBeInTheDocument();
  });

  it("si las estadísticas no se pueden cargar muestra un error", () => {
    mockUseRivalStats.mockReturnValue(hookState({ stats: null, error: true }));

    renderPage();

    expect(screen.getByText("No se han podido cargar las estadísticas de la liga.")).toBeInTheDocument();
  });
});
