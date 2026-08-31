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
const createPlayerSanctionMock = vi.fn();
const updatePlayerSanctionMock = vi.fn();
vi.mock("../../../services/teamplayerSanctionService", () => ({
  default: {
    getPlayerSanctions: vi.fn(),
    createPlayerSanction: (...args: unknown[]) => createPlayerSanctionMock(...args),
    updatePlayerSanction: (...args: unknown[]) => updatePlayerSanctionMock(...args),
    deletePlayerSanction: vi.fn(),
    getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  },
  getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  createPlayerSanction: (...args: unknown[]) => createPlayerSanctionMock(...args),
  updatePlayerSanction: (...args: unknown[]) => updatePlayerSanctionMock(...args),
}));

let rolesMock: string[] = ["Coach"];
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => rolesMock,
    hasRole: (role: string) => rolesMock.includes(role),
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
    { id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7 },
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
          sanctionType: "Amonestación",
          description: null,
          estimatedEnd: null,
          endDate: null,
        },
      ],
    },
  ];
}

describe("Sanctions - action visibility by role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getTeamSanctionsMock.mockResolvedValue(buildTeamSanctions());
  });

  it("shows 'Añadir sanción', 'Editar' and 'Levantar sanción' actions for a coach", async () => {
    rolesMock = ["Coach"];

    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());

    expect(
      await screen.findByRole("button", { name: /añadir sanción/i })
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^editar$/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /levantar sanción/i })).toBeInTheDocument();
  });

  it("hides sanction management actions for a player", async () => {
    rolesMock = ["Player"];

    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    await screen.findByText("Amonestación");

    expect(
      screen.queryByRole("button", { name: /añadir sanción/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /levantar sanción/i })).not.toBeInTheDocument();
  });

  it("hides sanction management actions for a family member", async () => {
    rolesMock = ["FamilyMember"];

    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    await screen.findByText("Amonestación");

    expect(
      screen.queryByRole("button", { name: /añadir sanción/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /levantar sanción/i })).not.toBeInTheDocument();
  });

  it("hides sanction management actions for a family player", async () => {
    rolesMock = ["FamilyPlayer"];

    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    await screen.findByText("Amonestación");

    expect(
      screen.queryByRole("button", { name: /añadir sanción/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /levantar sanción/i })).not.toBeInTheDocument();
  });
});
