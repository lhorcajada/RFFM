import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";
import { TEAM_FUND_UPDATED_EVENT } from "../../../../../shared/hooks/useTeamFundBalance";

const mockTeam = { id: "team-1", name: "Team 1" };
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => ({
    team: mockTeam,
    teamTitleNode: null,
    clubSubtitleNode: null,
    loading: false,
  }),
}));

const mockGoToTeamDashboard = vi.fn();
vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => mockGoToTeamDashboard,
}));

const getPlayersByTeamMock = vi.fn();
vi.mock("../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args),
  },
}));

const getTeamSanctionsMock = vi.fn();
const createPlayerSanctionMock = vi.fn();
vi.mock("../../../services/teamplayerSanctionService", () => ({
  default: {
    getPlayerSanctions: vi.fn(),
    createPlayerSanction: (...args: unknown[]) => createPlayerSanctionMock(...args),
    updatePlayerSanction: vi.fn(),
    deletePlayerSanction: vi.fn(),
    getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  },
  getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
  createPlayerSanction: (...args: unknown[]) => createPlayerSanctionMock(...args),
  updatePlayerSanction: vi.fn(),
  deletePlayerSanction: vi.fn(),
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

function renderSanctions() {
  return render(
    <UserProvider>
      <MemoryRouter>
        <Sanctions />
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Sanctions — refresco de la bolsa y navegación de vuelta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getTeamSanctionsMock.mockResolvedValue([]);
    getTeamFundMock.mockResolvedValue({ teamId: "team-1", balance: 0, movements: [] });
  });

  it("el botón Volver navega al dashboard del equipo actual, no al dashboard general", async () => {
    renderSanctions();

    const volver = await screen.findByRole("button", { name: /volver/i });
    await userEvent.click(volver);

    expect(mockGoToTeamDashboard).toHaveBeenCalledTimes(1);
  });

  it("crear una sanción dispara el evento de actualización de la bolsa", async () => {
    createPlayerSanctionMock.mockResolvedValue({ id: "s1" });
    const listener = vi.fn();
    window.addEventListener(TEAM_FUND_UPDATED_EVENT, listener);

    renderSanctions();

    const addButton = await screen.findByRole("button", { name: /añadir sanción/i });
    await waitFor(() => expect(addButton).not.toBeDisabled());
    await userEvent.click(addButton);

    const dialog = await screen.findByRole("dialog");
    const dialogScope = within(dialog);
    await userEvent.click(dialogScope.getByLabelText(/jugador/i));
    await userEvent.click(await screen.findByText("Juan Pérez"));
    const sanctionTypeInput = dialogScope.getByLabelText(
      (content) => content.replace(/\s*\*$/, "").trim() === "Tipo de sanción"
    );
    await userEvent.type(sanctionTypeInput, "Retraso");
    await userEvent.click(dialogScope.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(createPlayerSanctionMock).toHaveBeenCalled());
    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));

    window.removeEventListener(TEAM_FUND_UPDATED_EVENT, listener);
  });
});
