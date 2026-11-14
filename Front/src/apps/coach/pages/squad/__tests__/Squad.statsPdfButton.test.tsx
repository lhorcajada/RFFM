import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const { getRolesMock, stableTeam, exportMock, statsMock, leagueMock } = vi.hoisted(() => ({
  stableTeam: { id: "team-1", name: "Cadete B" },
  getRolesMock: vi.fn(),
  exportMock: vi.fn(),
  statsMock: vi.fn(),
  leagueMock: vi.fn(),
}));

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  __esModule: true,
  default: ({ children, actionBar }: { children?: React.ReactNode; actionBar?: React.ReactNode }) => (
    <div>
      <div>{actionBar}</div>
      {children}
    </div>
  ),
}));
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  __esModule: true,
  default: () => ({ team: stableTeam, teamTitleNode: "Cadete B", clubSubtitleNode: null, loading: false }),
}));
vi.mock("../../../hooks/useTeamDashboardBack", () => ({ __esModule: true, default: () => vi.fn() }));
vi.mock("../../../services/authService", () => ({ coachAuthService: { getRoles: getRolesMock } }));
vi.mock("../../../services/coachApi", () => ({ getMyProfile: vi.fn().mockResolvedValue(null) }));
vi.mock("../../../services/teamplayerService", () => ({
  __esModule: true,
  default: { getPlayersByTeam: vi.fn().mockResolvedValue([]) },
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
  getTeamPlayerStatistics: statsMock,
  default: { getTeamPlayerStatistics: statsMock },
}));
vi.mock("../../../services/leagueStatsService", () => ({
  __esModule: true,
  getTeamLeagueStats: leagueMock,
}));
vi.mock("../squadMatchStatsPdfExport", () => ({ exportSquadMatchStatsPdf: exportMock }));
vi.mock("../components/SquadRatings", () => ({ __esModule: true, default: () => <div>SquadRatings</div> }));
vi.mock("../components/SquadRanking", () => ({ __esModule: true, default: () => <div>SquadRanking</div> }));
vi.mock("../components/IdealLineup", () => ({ __esModule: true, default: () => <div>IdealLineup</div> }));
vi.mock("../components/SquadStatistics", () => ({ __esModule: true, default: () => <div>SquadStatistics</div> }));

import Squad from "../Squad";

function renderSquad() {
  return render(
    <MemoryRouter initialEntries={["/coach/squad?teamId=team-1"]}>
      <Squad />
    </MemoryRouter>,
  );
}

describe("Squad — botón de imprimir estadísticas en la barra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRolesMock.mockReturnValue(["coach"]);
    statsMock.mockResolvedValue([
      { teamPlayerId: "p1", displayName: "Ana", position: null, dorsal: 9, goals: 5, yellowCards: 3, redCards: 1, minutesPlayed: 400 },
    ]);
    leagueMock.mockResolvedValue([
      { teamPlayerId: "p1", goals: 3, callUps: 6, starts: 4, yellowCards: 2, redCards: 1, minutesPlayed: 300 },
    ]);
  });

  it("al pulsarlo genera el PDF con la liga separada de amistosos y torneos", async () => {
    renderSquad();

    const button = await screen.findByRole("button", { name: /imprimir estadísticas/i });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    expect(exportMock).toHaveBeenCalledTimes(1);
    const [rows, teamName] = exportMock.mock.calls[0];
    expect(teamName).toBe("Cadete B");
    expect(rows[0].league.goals).toBe(3);
    expect(rows[0].other.goals).toBe(2);
  });

  it("está deshabilitado mientras no hay estadísticas", async () => {
    statsMock.mockResolvedValue([]);

    renderSquad();

    expect(await screen.findByRole("button", { name: /imprimir estadísticas/i })).toBeDisabled();
  });

  it("un aficionado no ve el botón", async () => {
    getRolesMock.mockReturnValue(["fan"]);

    renderSquad();

    await screen.findByRole("tab", { name: "Plantilla" });
    expect(screen.queryByRole("button", { name: /imprimir estadísticas/i })).not.toBeInTheDocument();
  });
});
