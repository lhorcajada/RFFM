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
import type {
  MatchPrediction,
  ProjectedStanding,
  RivalSimulation as RivalSimulationType,
  RivalSimulationHistory,
  RoundMatch,
  RoundSimulation,
} from "../../../../services/rivalStatsService";

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

function roundMatch(local: string, visitor: string, actual: [number, number] | null, hit: boolean | null): RoundMatch {
  return {
    ...match(1, local, visitor),
    predictedOutcome: "Home",
    actualLocalGoals: actual?.[0] ?? null,
    actualVisitorGoals: actual?.[1] ?? null,
    actualOutcome: actual ? (actual[0] > actual[1] ? "Home" : actual[0] < actual[1] ? "Away" : "Draw") : null,
    hit,
  };
}

function savedRound(round: number, overrides: Partial<RoundSimulation> = {}): RoundSimulation {
  return {
    round,
    date: null,
    status: "Played",
    isFrozen: true,
    isBackfilled: false,
    computedAt: "2026-10-01T08:00:00Z",
    playedMatchesUsed: (round - 1) * 2,
    usesSquadStrength: true,
    hits: 1,
    evaluated: 2,
    matches: [roundMatch("E1", "E2", [2, 1], true), roundMatch("E3", "E4", [1, 1], false)],
    standings: [
      { ...standing("E3", 28), actualPosition: 2, actualPoints: 4 },
      { ...standing("E1", 26), actualPosition: 1, actualPoints: 6 },
    ],
    ...overrides,
  };
}

function history(overrides: Partial<RivalSimulationHistory> = {}): RivalSimulationHistory {
  return {
    ownTeamCode: "E1",
    totalHits: 5,
    totalEvaluated: 8,
    rounds: [savedRound(1), savedRound(2, { hits: 3, evaluated: 4 }), savedRound(3, { status: "Upcoming", isFrozen: false, hits: 0, evaluated: 0 })],
    ...overrides,
  };
}

async function selectOption(label: RegExp, option: RegExp) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(screen.getByRole("option", { name: option }));
}

describe("RivalSimulation — historial de jornadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamAndClub.mockReturnValue({ team, teamTitleNode: null, loading: false });
    mockUseRivalSimulation.mockReturnValue({ simulation: simulation(), history: history(), loading: false, error: false });
  });

  it("muestra los aciertos totales", () => {
    renderPage();

    expect(screen.getByText(/aciertos totales: 5 de 8 \(63\s?%\)/i)).toBeInTheDocument();
  });

  it("ofrece ver los próximos partidos y cada jornada guardada", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("combobox", { name: /ver/i }));

    expect(screen.getByRole("option", { name: "Próximos partidos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Jornada 1 · jugada" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Jornada 3" })).toBeInTheDocument();
  });

  it("en una jornada guardada marca cada partido como acertado o fallado y resume los aciertos", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("checkbox", { name: /solo mi equipo/i }));

    await selectOption(/ver/i, /jornada 2/i);

    expect(screen.getByText("Aciertos en la jornada: 3 de 4")).toBeInTheDocument();
    expect(screen.getByText("Acertado")).toBeInTheDocument();
    expect(screen.getByText("Fallado")).toBeInTheDocument();
    expect(screen.getByText(/resultado: 2 - 1/i)).toBeInTheDocument();
  });

  it("en una jornada guardada también aplica el filtro «Solo mi equipo»", async () => {
    renderPage();

    await selectOption(/ver/i, /jornada 1/i);

    expect(screen.getByText("Acertado")).toBeInTheDocument();
    expect(screen.queryByText("Fallado")).not.toBeInTheDocument();
  });

  it("la proyección guardada de una jornada muestra el puesto real de cada equipo", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("tab", { name: /clasificación/i }));

    await selectOption(/proyección/i, /antes de la jornada 2/i);

    const names = screen.getAllByText(/^Equipo E\d$/).map((el) => el.textContent);
    expect(names).toEqual(["Equipo E3", "Equipo E1"]);
    expect(screen.getByText("Puesto real: 1º")).toBeInTheDocument();
  });

  it("indica cuándo la predicción de una jornada se calculó a posteriori", async () => {
    mockUseRivalSimulation.mockReturnValue({
      simulation: simulation(),
      history: history({ rounds: [savedRound(1, { isBackfilled: true }), savedRound(2)] }),
      loading: false,
      error: false,
    });
    renderPage();

    await selectOption(/ver/i, /jornada 1/i);
    expect(screen.getByText(/predicción calculada a posteriori con 0 partidos/i)).toBeInTheDocument();

    await selectOption(/ver/i, /jornada 2/i);
    expect(screen.queryByText(/a posteriori/i)).not.toBeInTheDocument();
  });

  it("sin historial solo muestra la simulación actual", async () => {
    mockUseRivalSimulation.mockReturnValue({ simulation: simulation(), history: null, loading: false, error: false });

    renderPage();
    await userEvent.click(screen.getByRole("combobox", { name: /ver/i }));

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.queryByText(/aciertos totales/i)).not.toBeInTheDocument();
  });
});
