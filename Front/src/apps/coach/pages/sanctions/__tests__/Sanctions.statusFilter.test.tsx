import React from "react";
import { render, screen } from "@testing-library/react";
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

function buildTeamSanctions() {
  return [
    {
      teamPlayerId: "player-1",
      sanctions: [
        sanction("s1", "Pendiente antigua", "2026-01-01", null),
        sanction("s2", "Pagada reciente", "2026-03-01", "2026-03-05"),
        sanction("s3", "Pendiente reciente", "2026-02-01", null),
      ],
    },
  ];
}

const SANCTION_TYPES = /^(Pendiente antigua|Pagada reciente|Pendiente reciente)$/;

function renderedOrder(): string[] {
  return screen.getAllByText(SANCTION_TYPES).map((el) => el.textContent ?? "");
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

describe("Sanctions — filtro por estado (todas / pendientes / pagadas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue([
      { id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7 },
    ]);
    getTeamSanctionsMock.mockResolvedValue(buildTeamSanctions());
  });

  it("por defecto muestra todas las sanciones con las pendientes primero y luego las pagadas", async () => {
    renderSanctions();
    await screen.findByText("Pagada reciente");

    expect(renderedOrder()).toEqual(["Pendiente reciente", "Pendiente antigua", "Pagada reciente"]);
  });

  it("el filtro 'Pendientes' muestra solo las sanciones pendientes", async () => {
    renderSanctions();
    await screen.findByText("Pagada reciente");

    await userEvent.click(screen.getByRole("button", { name: /^pendientes$/i }));

    expect(renderedOrder()).toEqual(["Pendiente reciente", "Pendiente antigua"]);
  });

  it("el filtro 'Pagadas' muestra solo las sanciones pagadas", async () => {
    renderSanctions();
    await screen.findByText("Pagada reciente");

    await userEvent.click(screen.getByRole("button", { name: /^pagadas$/i }));

    expect(renderedOrder()).toEqual(["Pagada reciente"]);
  });

  it("el filtro 'Todas' vuelve a mostrar todas las sanciones", async () => {
    renderSanctions();
    await screen.findByText("Pagada reciente");

    await userEvent.click(screen.getByRole("button", { name: /^pagadas$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^todas$/i }));

    expect(renderedOrder()).toHaveLength(3);
  });
});
