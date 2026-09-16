import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PlayerMatchRecord } from "../../convocations/components/simulation/liveMatch.types";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    actionBar,
    children,
  }: {
    actionBar?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div>
      <div>{actionBar}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => ({
    team: { id: "team-1" },
    teamTitleNode: "Equipo",
    clubSubtitleNode: null,
    loading: false,
  }),
}));

const mockTeamPlayer = {
  id: "tp-1",
  dorsal: 9,
  player: { name: "Juan", lastName: "Pérez", alias: "Juanito" },
  demarcation: { activePositionName: "Delantero" },
  familyMembers: [],
};

vi.mock("../hooks/usePlayerDetailData", () => ({
  usePlayerDetailData: () => ({
    teamPlayer: mockTeamPlayer,
    setTeamPlayer: vi.fn(),
    form: {},
    setForm: vi.fn(),
    photo: null,
    setPhoto: vi.fn(),
    demarcationOptions: [],
  }),
}));

vi.mock("../hooks/usePlayerSave", () => ({
  usePlayerSave: () => ({ saving: false, handleSave: vi.fn() }),
}));

function buildRecord(overrides: Partial<PlayerMatchRecord> = {}): PlayerMatchRecord {
  return {
    eventId: "ev-1",
    minutesPlayed: 60,
    isStarter: true,
    enteredAtMinute: null,
    exitedAtMinute: null,
    goalsScored: 1,
    yellowCards: 0,
    redCards: 0,
    rivalName: "CD Rival",
    eventTypeId: 1,
    eventTypeName: "Partido",
    substitutionWindows: [],
    scoreLocal: 2,
    scoreVisitor: 1,
    matchDate: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

const loadHistoryMock = vi.fn();
vi.mock("../hooks/usePlayerMatchHistory", () => ({
  usePlayerMatchHistory: () => ({
    matchHistory: [buildRecord()],
    loadingHistory: false,
    loadHistory: loadHistoryMock,
  }),
}));

const loadSummaryMock = vi.fn();
vi.mock("../hooks/usePlayerConvocationSummary", () => ({
  usePlayerConvocationSummary: () => ({
    summary: {
      totalStarts: 12,
      trainings: { attended: 9, possible: 10, calledButAbsent: 0 },
      friendlies: { attended: 2, possible: 3, calledButAbsent: 0 },
      league: { attended: 4, possible: 4, calledButAbsent: 0 },
      lastDeconvokedMatch: null,
      lastAbsenceMatch: null,
    },
    loadingSummary: false,
    loadSummary: loadSummaryMock,
  }),
}));

const loadStatsMock = vi.fn();
vi.mock("../hooks/usePlayerFormStats", () => ({
  usePlayerFormStats: () => ({
    stats: {
      teamPlayerId: "tp-1",
      displayName: "Juan Pérez",
      position: "Delantero",
      dorsal: 9,
      goals: 1,
      yellowCards: 0,
      redCards: 0,
      minutesPlayed: 60,
      trainings: { attended: 10, possible: 12, calledButAbsent: 0 },
      friendlies: { attended: 2, possible: 3, calledButAbsent: 0 },
      league: { attended: 3, possible: 4, calledButAbsent: 0 },
      daysSinceLastInjury: null,
      lastInjuryDurationDays: null,
      fatigue: 20,
      readiness: 75,
      readinessBreakdown: null,
    },
    loadingStats: false,
    loadStats: loadStatsMock,
  }),
}));

vi.mock("../../../services/teamplayerService", () => ({
  createPlayerInjury: vi.fn(),
  getPlayerInjuries: vi.fn().mockResolvedValue([]),
}));

const mockUsePermissions = vi.fn();
vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import PlayerDetail from "../PlayerDetail";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/coach/player/tp-1", state: null }]}>
      <Routes>
        <Route path="/coach/player/:id" element={<PlayerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PlayerDetail — Estadísticas como pestaña por defecto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ roles: ["Coach"], loading: false });
  });

  it("abre la pestaña Estadísticas por defecto al entrar en la ficha", () => {
    renderPage();

    const statsTab = screen.getByRole("tab", { name: /estadísticas/i });
    expect(statsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("CD Rival")).toBeInTheDocument();
  });

  it("carga el historial de partidos y el resumen de convocatorias sin necesidad de hacer click en la pestaña", () => {
    renderPage();

    expect(loadHistoryMock).toHaveBeenCalledWith("tp-1");
    expect(loadSummaryMock).toHaveBeenCalledWith("tp-1");
  });

  it("carga las estadísticas de forma del jugador usando el teamId resuelto por useTeamAndClub", () => {
    renderPage();

    expect(loadStatsMock).toHaveBeenCalledWith("team-1", "tp-1");
  });

  it("muestra el resumen de titularidades y convocatorias por tipo en la pestaña por defecto", () => {
    renderPage();

    expect(screen.getByText("Titularidades")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Entrenamientos")).toBeInTheDocument();
    expect(screen.getByText("Amistosos")).toBeInTheDocument();
    expect(screen.getByText("Liga")).toBeInTheDocument();
  });

  it("muestra las barras de forma (Ef/Rodaje/Cansancio) del jugador en la pestaña Estadísticas", () => {
    renderPage();

    expect(screen.getByTestId("player-form-bar-ef")).toBeInTheDocument();
    expect(screen.getByTestId("player-form-bar-r")).toBeInTheDocument();
    expect(screen.getByTestId("player-form-bar-c")).toBeInTheDocument();
  });

  it("mantiene Demarcación como pestaña navegable tras el reordenamiento", async () => {
    renderPage();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: /demarcación/i }));

    expect(screen.getByText("Delantero")).toBeInTheDocument();
  });
});
