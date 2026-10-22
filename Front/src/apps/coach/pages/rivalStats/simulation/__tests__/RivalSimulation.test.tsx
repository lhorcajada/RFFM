import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
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

vi.mock("../../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: vi.fn(),
}));

const mockUseTeamAndClub = vi.fn();
vi.mock("../../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => mockUseTeamAndClub(),
}));

const mockUseRivalSimulation = vi.fn();
vi.mock("../../../../hooks/useRivalSimulation", () => ({
  default: (teamId?: string) => mockUseRivalSimulation(teamId),
}));

import RivalSimulation from "../RivalSimulation";
import type { MatchPrediction, ProjectedStanding, RivalSimulation as RivalSimulationType } from "../../../../services/rivalStatsService";

const team = {
  id: "team-1",
  name: "Infantil A",
  canEdit: true,
  club: { id: "club-1" },
  rffmCompetitionId: 555,
  rffmGroupId: 777,
  rffmTeamCode: "E1",
};

function match(round: number, local: string, visitor: string): MatchPrediction {
  return {
    round,
    date: null,
    localTeamCode: local,
    localTeamName: `Equipo ${local}`,
    localShieldUrl: null,
    visitorTeamCode: visitor,
    visitorTeamName: `Equipo ${visitor}`,
    visitorShieldUrl: null,
    localWinProbability: 0.5,
    drawProbability: 0.3,
    visitorWinProbability: 0.2,
    localExpectedGoals: 1.6,
    visitorExpectedGoals: 1.1,
    mostLikelyLocalGoals: 1,
    mostLikelyVisitorGoals: 1,
  };
}

function standing(code: string, expectedPoints: number): ProjectedStanding {
  return {
    teamCode: code,
    teamName: `Equipo ${code}`,
    shieldUrl: null,
    currentPosition: 1,
    currentPoints: 10,
    expectedPoints,
    mostLikelyPosition: 1,
    championProbability: 0.3,
    positionProbabilities: [0.3, 0.3, 0.2, 0.2],
    attack: 1,
    defense: 1,
    squadStrength: 1,
  };
}

function simulation(overrides: Partial<RivalSimulationType> = {}): RivalSimulationType {
  return {
    playedMatches: 8,
    pendingMatches: 4,
    usesSquadStrength: true,
    ownTeamCode: "E1",
    iterations: 10000,
    matches: [match(5, "E1", "E2"), match(5, "E3", "E4"), match(6, "E4", "E1"), match(6, "E2", "E3")],
    standings: [standing("E2", 30), standing("E1", 25), standing("E3", 20), standing("E4", 15)],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RivalSimulation />
    </MemoryRouter>,
  );
}

describe("RivalSimulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamAndClub.mockReturnValue({ team, teamTitleNode: null, loading: false });
    mockUseRivalSimulation.mockReturnValue({ simulation: simulation(), loading: false, error: false });
  });

  it("indica que las probabilidades son orientativas y cuántos partidos se han usado", () => {
    renderPage();

    expect(screen.getByText(/probabilidades orientativas calculadas con 8 partidos disputados/i)).toBeInTheDocument();
  });

  it("por defecto solo muestra los partidos del propio equipo, agrupados por jornada", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /jornada 5/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /jornada 6/i })).toBeInTheDocument();
    expect(screen.getAllByText("Equipo E1")).toHaveLength(2);
    expect(screen.queryByText("Equipo E3")).not.toBeInTheDocument();
  });

  it("al desactivar «Solo mi equipo» muestra todos los partidos pendientes", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("checkbox", { name: /solo mi equipo/i }));

    expect(screen.getAllByText("Equipo E3")).toHaveLength(2);
  });

  it("sin código RFFM propio muestra todos los partidos y no ofrece el filtro", () => {
    mockUseRivalSimulation.mockReturnValue({ simulation: simulation({ ownTeamCode: null }), loading: false, error: false });

    renderPage();

    expect(screen.queryByRole("checkbox", { name: /solo mi equipo/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("Equipo E3")).toHaveLength(2);
  });

  it("la pestaña Clasificación muestra una tarjeta por equipo en orden de puntos esperados", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("tab", { name: /clasificación/i }));

    const names = screen.getAllByText(/^Equipo E\d$/).map((el) => el.textContent);
    expect(names).toEqual(["Equipo E2", "Equipo E1", "Equipo E3", "Equipo E4"]);
    expect(within(screen.getByRole("tabpanel")).getByText("Tu equipo")).toBeInTheDocument();
  });

  it("avisa cuando no se ha usado la fuerza de las plantillas", () => {
    mockUseRivalSimulation.mockReturnValue({
      simulation: simulation({ usesSquadStrength: false }),
      loading: false,
      error: false,
    });

    renderPage();

    expect(screen.getByText(/genera las estadísticas de rivales/i)).toBeInTheDocument();
  });

  it("sin partidos pendientes lo indica", () => {
    mockUseRivalSimulation.mockReturnValue({
      simulation: simulation({ pendingMatches: 0, matches: [] }),
      loading: false,
      error: false,
    });

    renderPage();

    expect(screen.getByText("No quedan partidos por disputar.")).toBeInTheDocument();
  });

  it("si falla la carga muestra un error en lugar de las pestañas", () => {
    mockUseRivalSimulation.mockReturnValue({ simulation: null, loading: false, error: true });

    renderPage();

    expect(screen.getByText(/no se ha podido calcular la simulación/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
