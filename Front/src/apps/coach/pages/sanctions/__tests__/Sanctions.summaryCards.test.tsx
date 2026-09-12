import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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

const getTeamFundMock = vi.fn();
vi.mock("../../../services/teamFundService", () => ({
  default: { getTeamFund: (...args: unknown[]) => getTeamFundMock(...args) },
  getTeamFund: (...args: unknown[]) => getTeamFundMock(...args),
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
          sanctionType: "Sanción económica 1",
          description: null,
          estimatedEnd: null,
          endDate: null,
          isAutomatic: false,
          fine: 100,
          amountPaid: 40,
          pendingAmount: 60,
        },
      ],
    },
    {
      teamPlayerId: "player-2",
      sanctions: [
        {
          id: "s2",
          startDate: "2026-01-02",
          sanctionType: "Sanción económica 2",
          description: null,
          estimatedEnd: null,
          endDate: null,
          isAutomatic: false,
          fine: 50,
          amountPaid: 50,
          pendingAmount: 0,
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

describe("Sanctions — cabecera resumen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getTeamSanctionsMock.mockResolvedValue(buildTeamSanctions());
    getTeamFundMock.mockResolvedValue({ teamId: "team-1", balance: 90, movements: [] });
  });

  it("muestra el total multado, el total pendiente y la bolsa del equipo", async () => {
    renderSanctions();

    await waitFor(() => expect(getTeamFundMock).toHaveBeenCalledWith("team-1"));

    const summary = within(await screen.findByTestId("sanctions-summary-cards"));

    expect(summary.getByText("Total multado")).toBeInTheDocument();
    expect(await summary.findByText("150 €")).toBeInTheDocument();

    expect(summary.getByText("Total pendiente")).toBeInTheDocument();
    expect(await summary.findByText("60 €")).toBeInTheDocument();

    expect(summary.getByText("Bolsa del equipo")).toBeInTheDocument();
    expect(await summary.findByText("90 €")).toBeInTheDocument();
  });
});
