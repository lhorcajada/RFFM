import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const { getTeamPlayerStatisticsMock } = vi.hoisted(() => ({
  getTeamPlayerStatisticsMock: vi.fn(),
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

let roles: string[] = ["coach"];
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => roles,
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../services/teamplayerService", () => ({
  __esModule: true,
  default: {
    getPlayersByTeam: vi.fn().mockResolvedValue([]),
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
  default: ({ players }: { players: unknown[] }) => (
    <div>
      <table>
        <thead>
          <tr>
            <th>Estado de forma</th>
          </tr>
        </thead>
      </table>
      <div data-testid="squad-statistics-players-count">{players.length}</div>
    </div>
  ),
}));

import Squad from "../Squad";

function renderSquad() {
  render(
    <MemoryRouter initialEntries={["/coach/squad?teamId=team-1"]}>
      <Squad />
    </MemoryRouter>,
  );
}

describe("Squad — pestaña Estadísticas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roles = ["coach"];
    getTeamPlayerStatisticsMock.mockResolvedValue([
      {
        teamPlayerId: "tp-1",
        displayName: "Juan Pérez",
        position: "Delantero",
        dorsal: 9,
        goals: 3,
        yellowCards: 1,
        redCards: 0,
        minutesPlayed: 450,
        formStatus: 82,
        formStatusBreakdown: null,
      },
    ]);
  });

  it("muestra la pestaña 'Estadísticas' para un rol coach/admin", () => {
    renderSquad();
    expect(screen.getByRole("tab", { name: "Estadísticas" })).toBeInTheDocument();
  });

  it("no muestra la pestaña 'Estadísticas' para el rol Fan", () => {
    roles = ["fan"];
    renderSquad();
    expect(screen.queryByRole("tab", { name: "Estadísticas" })).not.toBeInTheDocument();
  });

  it("al seleccionar la pestaña, llama a getTeamPlayerStatistics y renderiza SquadStatistics", async () => {
    const user = userEvent.setup();
    renderSquad();

    await user.click(screen.getByRole("tab", { name: "Estadísticas" }));

    expect(await screen.findByText("Estado de forma")).toBeInTheDocument();
    expect(getTeamPlayerStatisticsMock).toHaveBeenCalledWith("team-1");
  });
});
