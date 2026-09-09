import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const { getTeamPlayerStatisticsMock, getPlayersByTeamMock } = vi.hoisted(() => ({
  getTeamPlayerStatisticsMock: vi.fn(),
  getPlayersByTeamMock: vi.fn(),
}));

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  __esModule: true,
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
  __esModule: true,
  default: () => ({
    team: { id: "team-1", name: "Alevín A" },
    teamTitleNode: "Alevín A",
    clubSubtitleNode: null,
    loading: false,
  }),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  __esModule: true,
  default: () => vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["coach"],
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../services/teamplayerService", () => ({
  __esModule: true,
  default: {
    getPlayersByTeam: getPlayersByTeamMock,
  },
  dischargeActiveInjury: vi.fn(),
}));

vi.mock("../../../services/playerService", () => ({
  __esModule: true,
  default: {
    fetchPlayerPhoto: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../../services/playerRatingService", () => ({
  __esModule: true,
  default: {
    getTeamLatestRatings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../services/liveMatchService", () => ({
  getSeasonPlayerStats: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/teamPlayerStatisticsService", () => ({
  __esModule: true,
  getTeamPlayerStatistics: getTeamPlayerStatisticsMock,
  default: { getTeamPlayerStatistics: getTeamPlayerStatisticsMock },
}));

vi.mock("../components/SquadRatings", () => ({
  __esModule: true,
  default: () => <div>SquadRatings</div>,
}));
vi.mock("../components/SquadRanking", () => ({
  __esModule: true,
  default: () => <div>SquadRanking</div>,
}));
vi.mock("../components/IdealLineup", () => ({
  __esModule: true,
  default: () => <div>IdealLineup</div>,
}));
vi.mock("../components/SquadStatistics", () => ({
  __esModule: true,
  default: () => <div>SquadStatistics</div>,
}));

import Squad from "../Squad";

function renderSquad() {
  render(
    <MemoryRouter initialEntries={["/coach/squad?teamId=team-1"]}>
      <Squad />
    </MemoryRouter>,
  );
}

describe("Squad — pestaña Plantilla muestra Ef/R/C en las tarjetas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", name: "Juan", lastName: "Pérez", position: "Delantero", dorsal: 9 },
    ]);
    getTeamPlayerStatisticsMock.mockResolvedValue([
      {
        teamPlayerId: "tp-1",
        displayName: "Juan Pérez",
        position: "Delantero",
        dorsal: 9,
        goals: 0,
        yellowCards: 0,
        redCards: 0,
        minutesPlayed: 0,
        readiness: 70,
        fatigue: 20,
        readinessBreakdown: null,
      },
    ]);
  });

  it("pasa readiness/fatigue de cada jugador a su tarjeta y muestra las barras Ef/R/C", async () => {
    renderSquad();

    expect(await screen.findByTestId("player-form-bar-ef")).toHaveTextContent("63%");
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("70%");
    expect(screen.getByTestId("player-form-bar-c")).toHaveTextContent("20%");
  });

  it("muestra la leyenda consolidada una única vez en la pantalla, no por tarjeta", async () => {
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", name: "Juan", lastName: "Pérez", position: "Delantero", dorsal: 9 },
      { id: "tp-2", name: "Ana", lastName: "García", position: "Delantero", dorsal: 10 },
    ]);
    getTeamPlayerStatisticsMock.mockResolvedValue([
      { teamPlayerId: "tp-1", displayName: "Juan Pérez", readiness: 70, fatigue: 20, position: "Delantero", dorsal: 9, goals: 0, yellowCards: 0, redCards: 0, minutesPlayed: 0, readinessBreakdown: null },
      { teamPlayerId: "tp-2", displayName: "Ana García", readiness: 60, fatigue: 30, position: "Delantero", dorsal: 10, goals: 0, yellowCards: 0, redCards: 0, minutesPlayed: 0, readinessBreakdown: null },
    ]);

    renderSquad();

    await screen.findAllByTestId("player-form-bar-ef");
    expect(screen.getAllByLabelText(/Leyenda de Ef, Rodaje y Cansancio/i)).toHaveLength(1);
  });
});
