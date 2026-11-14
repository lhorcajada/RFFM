import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";

const useConvocationsMock = vi.fn();
const teamHolder: { team: Record<string, unknown> | null } = { team: null };

vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: () => ({ team: teamHolder.team }),
}));
vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({ seasonId: 22, currentSeasonId: 22 }),
}));
vi.mock("../hooks/useConvocations", () => ({
  default: (...args: unknown[]) => {
    useConvocationsMock(...args);
    return {
      matches: [],
      loading: false,
      error: null,
      canSyncCalendar: true,
      syncing: false,
      syncSnackbar: null,
      setSyncSnackbar: vi.fn(),
      handleSyncCalendar: vi.fn(),
    };
  },
}));
vi.mock("../../../hooks/useTeamDashboardBack", () => ({ default: () => vi.fn() }));
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
    hasRole: (role: string) => role === "Coach",
    getToken: () => null,
    isAuthenticated: () => true,
  },
}));

import Convocations from "../Convocations";

function renderPage() {
  render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/convocations?teamId=team-1"]}>
        <Convocations />
      </MemoryRouter>
    </UserProvider>,
  );
}

describe("Convocations — de dónde sale el calendario a generar", () => {
  beforeEach(() => {
    useConvocationsMock.mockClear();
  });

  it("usa la competición, el grupo y el código del equipo del coach junto con la temporada actual", () => {
    teamHolder.team = { id: "team-1", rffmCompetitionId: 26737768, rffmGroupId: 26737802, rffmTeamCode: "6818362" };
    renderPage();

    expect(useConvocationsMock).toHaveBeenLastCalledWith("team-1", {
      season: "22",
      competition: "26737768",
      group: "26737802",
      teamCode: "6818362",
    });
  });

  it("si el equipo no tiene competición y grupo configurados, no hay origen de calendario", () => {
    teamHolder.team = { id: "team-1", rffmCompetitionId: null, rffmGroupId: null, rffmTeamCode: null };
    renderPage();

    expect(useConvocationsMock).toHaveBeenLastCalledWith("team-1", null);
  });
});
