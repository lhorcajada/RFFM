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

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
    hasRole: () => true,
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

function buildTeamSanctions() {
  return [
    {
      teamPlayerId: "player-1",
      sanctions: [
        {
          id: "s1",
          startDate: "2026-01-01",
          sanctionType: "Amarillas acumuladas (5)",
          description: "Generada automáticamente",
          estimatedEnd: null,
          endDate: null,
          isAutomatic: true,
          fine: 50,
        },
      ],
    },
  ];
}

describe("Sanctions — multa y sanción automática", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getTeamSanctionsMock.mockResolvedValue(buildTeamSanctions());
  });

  it("muestra la columna Multa con el importe de la sanción", async () => {
    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    expect(await screen.findByText("Multa")).toBeInTheDocument();
    // "50 €" appears both in the Multa column and (with no amountPaid) in the
    // Pendiente column, since pendingAmount defaults to the full fine.
    expect((await screen.findAllByText("50 €")).length).toBeGreaterThanOrEqual(1);
  });

  it("muestra el chip 'Automática' junto al tipo de sanción cuando isAutomatic es true", async () => {
    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    expect(await screen.findByText("Automática")).toBeInTheDocument();
  });

  it("deshabilita el campo Tipo de sanción en el diálogo de edición para una sanción automática", async () => {
    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    const editButton = await screen.findByRole("button", { name: /^editar$/i });
    await userEvent.click(editButton);

    const sanctionTypeField = await screen.findByRole("textbox", { name: "Tipo de sanción" });
    expect(sanctionTypeField).toBeDisabled();
  });

  it("permite editar el campo Multa (€) en el diálogo de edición", async () => {
    render(
      <UserProvider>
        <MemoryRouter>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    const editButton = await screen.findByRole("button", { name: /^editar$/i });
    await userEvent.click(editButton);

    const fineField = await screen.findByLabelText(/multa/i);
    expect(fineField).not.toBeDisabled();
  });
});
