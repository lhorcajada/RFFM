import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../../../services/teamFundService", () => ({
  default: { getTeamFund: vi.fn().mockResolvedValue({ teamId: "team-1", balance: 0, movements: [] }) },
  getTeamFund: vi.fn().mockResolvedValue({ teamId: "team-1", balance: 0, movements: [] }),
}));

const fetchPlayerPhotoMock = vi.fn();
vi.mock("../../../services/playerService", () => ({
  default: { fetchPlayerPhoto: (...args: unknown[]) => fetchPlayerPhotoMock(...args) },
  fetchPlayerPhoto: (...args: unknown[]) => fetchPlayerPhotoMock(...args),
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

function buildPlayers() {
  return [
    { id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7, urlPhoto: "photos/juan.jpg" },
    { id: "player-2", name: "Ana", lastName: "García", alias: "Anita", dorsal: 9, urlPhoto: null },
  ];
}

function buildTeamSanctions() {
  return [
    {
      teamPlayerId: "player-1",
      sanctions: [
        {
          id: "s1",
          startDate: "2026-01-01",
          sanctionType: "Sanción de Juan",
          description: null,
          estimatedEnd: null,
          endDate: null,
          isAutomatic: false,
          fine: null,
        },
      ],
    },
    {
      teamPlayerId: "player-2",
      sanctions: [
        {
          id: "s2",
          startDate: "2026-01-02",
          sanctionType: "Sanción de Ana",
          description: null,
          estimatedEnd: null,
          endDate: null,
          isAutomatic: false,
          fine: null,
        },
      ],
    },
  ];
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

describe("Sanctions — foto del jugador en la fila", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getTeamSanctionsMock.mockResolvedValue(buildTeamSanctions());
    fetchPlayerPhotoMock.mockImplementation((url: string) =>
      Promise.resolve(url ? `blob:resolved-${url}` : null)
    );
  });

  it("resuelve y muestra la foto del jugador para cada sanción con urlPhoto", async () => {
    renderSanctions();

    await waitFor(() =>
      expect(fetchPlayerPhotoMock).toHaveBeenCalledWith("photos/juan.jpg")
    );

    const juanPhoto = await screen.findByAltText("Juan Pérez");
    expect((juanPhoto as HTMLImageElement).src).toContain("blob:resolved-photos/juan.jpg");
  });

  it("muestra el avatar por defecto cuando el jugador no tiene urlPhoto", async () => {
    renderSanctions();

    const anaPhoto = await screen.findByAltText("Ana García");
    expect((anaPhoto as HTMLImageElement).src).not.toContain("blob:resolved");
  });
});
