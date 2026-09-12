import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
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

let rolesMock: string[] = ["Player"];
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => rolesMock,
    hasRole: (role: string) => rolesMock.includes(role),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

const getMyProfileMock = vi.fn();
vi.mock("../../../services/coachApi", () => ({
  getMyProfile: () => getMyProfileMock(),
}));

import Sanctions from "../Sanctions";

function buildPlayers() {
  return [
    { id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7 },
    { id: "player-2", name: "Ana", lastName: "García", alias: "Anita", dorsal: 9 },
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

describe("Sanctions — filtro mis sanciones / todas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getTeamSanctionsMock.mockResolvedValue(buildTeamSanctions());
  });

  it("por defecto un jugador con jugador vinculado solo ve sus propias sanciones", async () => {
    rolesMock = ["Player"];
    getMyProfileMock.mockResolvedValue({ roleName: "Player", playerId: "player-1", teamId: "team-1" });

    renderSanctions();

    expect(await screen.findByText("Sanción de Juan")).toBeInTheDocument();
    expect(screen.queryByText("Sanción de Ana")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mis sanciones/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^todas las sanciones$/i })).toBeInTheDocument();
  });

  it("permite cambiar a 'Todas las sanciones' y ver las de otros jugadores", async () => {
    rolesMock = ["Player"];
    getMyProfileMock.mockResolvedValue({ roleName: "Player", playerId: "player-1", teamId: "team-1" });

    renderSanctions();
    await screen.findByText("Sanción de Juan");

    await userEvent.click(screen.getByRole("button", { name: /^todas las sanciones$/i }));

    expect(await screen.findByText("Sanción de Ana")).toBeInTheDocument();
    expect(screen.getByText("Sanción de Juan")).toBeInTheDocument();
  });

  it("no muestra el filtro para un entrenador (siempre ve todas)", async () => {
    rolesMock = ["Coach"];
    getMyProfileMock.mockResolvedValue(null);

    renderSanctions();

    expect(await screen.findByText("Sanción de Juan")).toBeInTheDocument();
    expect(await screen.findByText("Sanción de Ana")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mis sanciones/i })).not.toBeInTheDocument();
  });

  it("sin jugador vinculado (perfil desconocido) no muestra el filtro y ve todas las sanciones", async () => {
    rolesMock = ["FamilyMember"];
    getMyProfileMock.mockResolvedValue(null);

    renderSanctions();

    expect(await screen.findByText("Sanción de Juan")).toBeInTheDocument();
    expect(await screen.findByText("Sanción de Ana")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mis sanciones/i })).not.toBeInTheDocument();
  });
});
