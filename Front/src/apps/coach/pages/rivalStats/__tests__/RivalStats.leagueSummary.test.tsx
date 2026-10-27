import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

const mockUseRivalStats = vi.fn();
vi.mock("../../../hooks/useRivalStats", () => ({
  default: (teamId?: string) => mockUseRivalStats(teamId),
}));

vi.mock("../../../services/rivalStatsService", () => ({
  getRivalTeamStats: vi.fn(),
}));

import RivalStats from "../RivalStats";
import type { RivalStats as RivalStatsType } from "../../../services/rivalStatsService";

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
    totalPlayers: 38,
    processedPlayers: 38,
    failedPlayers: 0,
    completedAt: "2026-10-12T08:00:00Z",
    nextRefreshAllowedAt: null,
    errorMessage: null,
    ownTeamCode: "E2",
    teams: [
      { teamCode: "E2", teamName: "CD Propio", shieldUrl: null, playerCount: 18, isOwnTeam: true },
      { teamCode: "E1", teamName: "UD Rival", shieldUrl: null, playerCount: 20, isOwnTeam: false },
    ],
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

function hookState(current: RivalStatsType) {
  return {
    stats: current,
    loading: false,
    error: false,
    requesting: false,
    generate: vi.fn(),
    refresh: vi.fn(),
  };
}

describe("RivalStats resumen de la liga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamAndClub.mockReturnValue({ team, loading: false });
  });

  it("con las estadísticas listas muestra cuántos equipos tiene la liga", () => {
    mockUseRivalStats.mockReturnValue(hookState(stats()));

    renderPage();

    const summary = screen.getByRole("group", { name: "Resumen de la liga" });
    expect(within(summary).getByText("Equipos").previousSibling).toHaveTextContent("2");
  });

  it("con las estadísticas listas muestra cuántos jugadores suman las plantillas", () => {
    mockUseRivalStats.mockReturnValue(hookState(stats()));

    renderPage();

    const summary = screen.getByRole("group", { name: "Resumen de la liga" });
    expect(within(summary).getByText("Jugadores").previousSibling).toHaveTextContent("38");
  });

  it("mientras se generan las estadísticas no muestra el resumen", () => {
    mockUseRivalStats.mockReturnValue(hookState(stats({ status: "Running", processedPlayers: 12 })));

    renderPage();

    expect(screen.queryByRole("group", { name: "Resumen de la liga" })).not.toBeInTheDocument();
  });
});
