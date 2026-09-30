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
  default: () => ({ team: { id: "team-1" }, teamTitleNode: "Equipo", clubSubtitleNode: null, loading: false }),
}));

vi.mock("../components/PlayerPhysicalEvolution", () => ({
  default: ({ teamId, teamPlayerId }: { teamId?: string; teamPlayerId?: string }) => (
    <div>{`evolucion:${teamId}:${teamPlayerId}`}</div>
  ),
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
    yellowCards: 2,
    redCards: 1,
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

vi.mock("../hooks/usePlayerMatchHistory", () => ({
  usePlayerMatchHistory: () => ({
    matchHistory: [buildRecord()],
    loadingHistory: false,
    loadHistory: vi.fn(),
  }),
}));

vi.mock("../hooks/usePlayerConvocationSummary", () => ({
  usePlayerConvocationSummary: () => ({
    summary: {
      totalStarts: 5,
      trainings: { attended: 4, possible: 5, calledButAbsent: 0 },
      friendlies: { attended: 1, possible: 2, calledButAbsent: 0 },
      league: { attended: 2, possible: 3, calledButAbsent: 0 },
      lastDeconvokedMatch: null,
      lastAbsenceMatch: null,
    },
    loadingSummary: false,
    loadSummary: vi.fn(),
  }),
}));

vi.mock("../hooks/usePlayerFormStats", () => ({
  usePlayerFormStats: () => ({
    stats: null,
    loadingStats: false,
    loadStats: vi.fn(),
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

vi.mock("../components/tracking/PlayerTrackingPanel", () => ({
  default: ({ teamId, teamPlayerId }: { teamId: string; teamPlayerId: string }) => (
    <div>{`seguimiento:${teamId}:${teamPlayerId}`}</div>
  ),
}));

import PlayerDetail from "../PlayerDetail";
import { COACH_FEATURE_ROUTES } from "../../../constants/featureRoutes";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/coach/player/tp-1", state: null }]}>
      <Routes>
        <Route path="/coach/player/:id" element={<PlayerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

function permissionsWith(featureRoutes: string[]) {
  return {
    roles: ["Coach"],
    loading: false,
    hasFeatureAccess: (route: string) => featureRoutes.includes(route),
  };
}

describe("PlayerDetail — pestaña Seguimiento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con acceso al modelo de juego añade Seguimiento como última pestaña y muestra su panel", async () => {
    mockUsePermissions.mockReturnValue(permissionsWith([COACH_FEATURE_ROUTES.GameModel]));
    renderPage();

    const tabs = screen.getAllByRole("tab");
    expect(tabs[tabs.length - 1]).toHaveTextContent("Seguimiento");
    expect(tabs[tabs.length - 2]).toHaveTextContent("Lesiones");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: "Seguimiento" }));

    expect(await screen.findByText("seguimiento:team-1:tp-1")).toBeInTheDocument();
  });

  it("sin acceso al modelo de juego no muestra la pestaña Seguimiento", () => {
    mockUsePermissions.mockReturnValue(permissionsWith([COACH_FEATURE_ROUTES.Squad]));
    renderPage();

    expect(screen.queryByRole("tab", { name: "Seguimiento" })).not.toBeInTheDocument();
  });
});
