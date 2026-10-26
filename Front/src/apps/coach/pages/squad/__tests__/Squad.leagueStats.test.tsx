import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const { getTeamLeagueStatsMock, getPlayersByTeamMock, getRolesMock, getMyProfileMock } = vi.hoisted(() => ({
  getTeamLeagueStatsMock: vi.fn(),
  getPlayersByTeamMock: vi.fn(),
  getRolesMock: vi.fn(),
  getMyProfileMock: vi.fn(),
}));

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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
  coachAuthService: { getRoles: getRolesMock },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: getMyProfileMock,
}));

vi.mock("../../../services/teamplayerService", () => ({
  __esModule: true,
  default: { getPlayersByTeam: getPlayersByTeamMock },
  dischargeActiveInjury: vi.fn(),
}));

vi.mock("../../../services/playerService", () => ({
  __esModule: true,
  default: { fetchPlayerPhoto: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../services/playerRatingService", () => ({
  __esModule: true,
  default: { getTeamLatestRatings: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/teamPlayerStatisticsService", () => ({
  __esModule: true,
  getTeamPlayerStatistics: vi.fn().mockResolvedValue([]),
  default: { getTeamPlayerStatistics: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/leagueStatsService", () => ({
  __esModule: true,
  getTeamLeagueStats: getTeamLeagueStatsMock,
}));

vi.mock("../components/SquadRatings", () => ({ __esModule: true, default: () => <div>SquadRatings</div> }));
vi.mock("../components/SquadRanking", () => ({ __esModule: true, default: () => <div>SquadRanking</div> }));
vi.mock("../components/IdealLineup", () => ({ __esModule: true, default: () => <div>IdealLineup</div> }));
vi.mock("../components/SquadStatistics", () => ({ __esModule: true, default: () => <div>SquadStatistics</div> }));

import Squad from "../Squad";

const leagueFor = (id: string, goals: number) => ({
  teamPlayerId: id,
  goals,
  callUps: 5,
  starts: 4,
  yellowCards: 1,
  redCards: 0,
  minutesPlayed: 300,
});

function renderSquad() {
  render(
    <MemoryRouter initialEntries={["/coach/squad?teamId=team-1"]}>
      <Squad />
    </MemoryRouter>,
  );
}

describe("Squad — datos de liga en la pestaña Plantilla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRolesMock.mockReturnValue(["coach"]);
    getMyProfileMock.mockResolvedValue(null);
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", name: "Juan", lastName: "Pérez", position: "Delantero", dorsal: 9 },
      { id: "tp-2", name: "Luis", lastName: "Gómez", position: "Defensa", dorsal: 4 },
    ]);
    getTeamLeagueStatsMock.mockResolvedValue([leagueFor("tp-1", 7), leagueFor("tp-2", 2)]);
  });

  it("el entrenador ve el bloque «Solo liga» en cada jugador y ningún aviso aparte", async () => {
    renderSquad();

    await waitFor(() => expect(screen.getAllByText("Solo liga")).toHaveLength(2));
  });

  it("el jugador ve las cifras de liga de todos los jugadores, sin minutos", async () => {
    getRolesMock.mockReturnValue(["player"]);
    getMyProfileMock.mockResolvedValue({ playerId: "tp-1" });

    renderSquad();

    await waitFor(() => expect(screen.getAllByText("Solo liga")).toHaveLength(2));
    expect(screen.queryByText("Minutos")).not.toBeInTheDocument();
    expect(screen.getAllByText("Goles")).toHaveLength(2);
  });

  it("el familiar también ve las cifras de todos los jugadores, sin minutos", async () => {
    getRolesMock.mockReturnValue(["familymember"]);
    getMyProfileMock.mockResolvedValue({ playerId: "tp-1" });

    renderSquad();

    await waitFor(() => expect(screen.getAllByText("Solo liga")).toHaveLength(2));
    expect(screen.queryByText("Minutos")).not.toBeInTheDocument();
  });

  it("el entrenador sí ve los minutos", async () => {
    renderSquad();

    await waitFor(() => expect(screen.getAllByText("Minutos")).toHaveLength(2));
  });

  it("el aficionado no ve cifras ni aviso", async () => {
    getRolesMock.mockReturnValue(["fan"]);

    renderSquad();

    await screen.findByText("Juan Pérez");
    expect(screen.queryByText("Solo liga")).not.toBeInTheDocument();
  });

  it("si fallan los datos de liga las tarjetas se muestran sin el bloque", async () => {
    getTeamLeagueStatsMock.mockResolvedValue([]);

    renderSquad();

    expect(await screen.findByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.queryByText("Solo liga")).not.toBeInTheDocument();
  });
});
