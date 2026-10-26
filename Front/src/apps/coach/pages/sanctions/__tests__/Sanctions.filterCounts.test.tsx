import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";

const mockTeam = { id: "team-1", name: "Team 1" };
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => ({
    team: mockTeam,
    teamTitleNode: null,
    clubSubtitleNode: null,
    loading: false,
  }),
}));

const getPlayersByTeamMock = vi.fn();
vi.mock("../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args),
  },
}));

const getTeamSanctionsMock = vi.fn();
vi.mock("../../../services/teamplayerSanctionService", () => ({
  default: {
    getPlayerSanctions: vi.fn(),
    createPlayerSanction: vi.fn(),
    updatePlayerSanction: vi.fn(),
    deletePlayerSanction: vi.fn(),
    getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  },
  getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  createPlayerSanction: vi.fn(),
  updatePlayerSanction: vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
    hasRole: (role: string) => role === "Coach",
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

import Sanctions from "../Sanctions";

function sanction(id: string, sanctionType: string, startDate: string, endDate: string | null) {
  return {
    id,
    startDate,
    sanctionType,
    description: null,
    estimatedEnd: null,
    endDate,
    isAutomatic: false,
    fine: null,
  };
}

function renderSanctions() {
  return render(
    <UserProvider>
      <MemoryRouter>
        <Sanctions />
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Sanctions — contadores en el filtro de estado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue([
      { id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7 },
    ]);
    getTeamSanctionsMock.mockResolvedValue([
      {
        teamPlayerId: "player-1",
        sanctions: [
          sanction("s1", "Pendiente antigua", "2026-01-01", null),
          sanction("s2", "Pagada reciente", "2026-03-01", "2026-03-05"),
          sanction("s3", "Pendiente reciente", "2026-02-01", null),
        ],
      },
    ]);
  });

  it("cada opción muestra cuántas sanciones contiene", async () => {
    renderSanctions();
    await screen.findByText("Pagada reciente");

    expect(screen.getByRole("button", { name: /^todas$/i })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: /^pendientes$/i })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /^pagadas$/i })).toHaveTextContent("1");
  });
});
