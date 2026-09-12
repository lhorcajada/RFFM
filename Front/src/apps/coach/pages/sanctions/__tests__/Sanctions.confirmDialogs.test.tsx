import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

const getPlayersByTeamMock = vi.fn();
vi.mock("../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args),
  },
}));

const getTeamSanctionsMock = vi.fn();
const updatePlayerSanctionMock = vi.fn();
const deletePlayerSanctionMock = vi.fn();
vi.mock("../../../services/teamplayerSanctionService", () => ({
  default: {
    getPlayerSanctions: vi.fn(),
    createPlayerSanction: vi.fn(),
    updatePlayerSanction: (...args: unknown[]) => updatePlayerSanctionMock(...args),
    deletePlayerSanction: (...args: unknown[]) => deletePlayerSanctionMock(...args),
    getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  },
  getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  createPlayerSanction: vi.fn(),
  updatePlayerSanction: (...args: unknown[]) => updatePlayerSanctionMock(...args),
  deletePlayerSanction: (...args: unknown[]) => deletePlayerSanctionMock(...args),
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
  return [{ id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7 }];
}

function buildPendingSanction() {
  return [
    {
      teamPlayerId: "player-1",
      sanctions: [
        {
          id: "s1",
          startDate: "2026-01-01",
          sanctionType: "Retraso",
          description: null,
          estimatedEnd: null,
          endDate: null,
          isAutomatic: false,
          fine: null,
          amountPaid: null,
          pendingAmount: null,
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

describe("Sanctions — confirmaciones con ConfirmDialog (no confirm() nativo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getTeamSanctionsMock.mockResolvedValue(buildPendingSanction());
    getTeamFundMock.mockResolvedValue({ teamId: "team-1", balance: 0, movements: [] });
    updatePlayerSanctionMock.mockResolvedValue({ id: "s1" });
    deletePlayerSanctionMock.mockResolvedValue(true);
  });

  it("levantar una sanción abre un ConfirmDialog y solo llama al servicio al confirmar", async () => {
    renderSanctions();

    await userEvent.click(await screen.findByRole("button", { name: /levantar sanción/i }));

    expect(await screen.findByText(/¿levantar sanción a juan pérez\?/i)).toBeInTheDocument();
    expect(updatePlayerSanctionMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^levantar$/i }));

    await waitFor(() => expect(updatePlayerSanctionMock).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText(/¿levantar sanción a juan pérez\?/i)
    ).not.toBeInTheDocument();
  });

  it("cancelar el ConfirmDialog de levantar sanción no llama al servicio", async () => {
    renderSanctions();

    await userEvent.click(await screen.findByRole("button", { name: /levantar sanción/i }));
    await screen.findByText(/¿levantar sanción a juan pérez\?/i);

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(
      screen.queryByText(/¿levantar sanción a juan pérez\?/i)
    ).not.toBeInTheDocument();
    expect(updatePlayerSanctionMock).not.toHaveBeenCalled();
  });

  it("eliminar una sanción abre un ConfirmDialog y solo llama al servicio al confirmar", async () => {
    renderSanctions();

    await userEvent.click(await screen.findByRole("button", { name: /^eliminar$/i }));

    expect(await screen.findByText(/¿eliminar la sanción de juan pérez\?/i)).toBeInTheDocument();
    expect(deletePlayerSanctionMock).not.toHaveBeenCalled();

    const dialog = within(screen.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => expect(deletePlayerSanctionMock).toHaveBeenCalledTimes(1));
  });
});
