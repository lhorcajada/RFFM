import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";

const mockTeam = { id: "team-1", name: "Infantil A" };
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
vi.mock("../../../services/teamplayerSanctionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/teamplayerSanctionService")>();
  return {
    ...actual,
    default: { ...actual.default, getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args) },
    getTeamSanctions: (...args: unknown[]) => getTeamSanctionsMock(...args),
    createPlayerSanction: vi.fn(),
    updatePlayerSanction: vi.fn(),
  };
});

const getRolesMock = vi.fn();
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => getRolesMock(),
    hasRole: (role: string) => getRolesMock().includes(role),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

import Sanctions from "../Sanctions";

function sanction(id: string, sanctionType: string, fine: number | null, endDate: string | null) {
  return {
    id,
    startDate: "2026-10-01",
    sanctionType,
    description: null,
    estimatedEnd: null,
    endDate,
    isAutomatic: false,
    fine,
    amountPaid: null,
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

describe("Sanctions — listado de pendientes para WhatsApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRolesMock.mockReturnValue(["Coach"]);
    getPlayersByTeamMock.mockResolvedValue([
      { id: "player-1", name: "Juan", lastName: "Pérez", alias: "Juanito", dorsal: 7 },
    ]);
    getTeamSanctionsMock.mockResolvedValue([
      {
        teamPlayerId: "player-1",
        sanctions: [
          sanction("s1", "Expulsión", 10, "2026-10-02"),
          sanction("s2", "Cumplida y pagada", null, "2026-10-02"),
        ],
      },
    ]);
  });

  it("el entrenador abre el listado de sanciones pendientes con solo las pendientes", async () => {
    renderSanctions();
    await screen.findByText("Cumplida y pagada");

    await userEvent.click(screen.getByRole("button", { name: /listado whatsapp/i }));

    const message = (screen.getByRole("textbox", { name: /mensaje para whatsapp/i }) as HTMLTextAreaElement).value;
    expect(message).toContain("*Sanciones pendientes – Infantil A*");
    expect(message).toContain("• Expulsión – 10,00 € pendientes");
    expect(message).not.toContain("Cumplida y pagada");
  });

  it("deshabilita el listado cuando no hay sanciones pendientes", async () => {
    getTeamSanctionsMock.mockResolvedValue([
      { teamPlayerId: "player-1", sanctions: [sanction("s2", "Cumplida y pagada", null, "2026-10-02")] },
    ]);
    renderSanctions();
    await screen.findByText("Cumplida y pagada");

    expect(screen.getByRole("button", { name: /listado whatsapp/i })).toBeDisabled();
  });

  it("no muestra el listado a jugadores ni familiares", async () => {
    getRolesMock.mockReturnValue(["FamilyPlayer"]);
    renderSanctions();
    await screen.findByText("Cumplida y pagada");

    expect(screen.queryByRole("button", { name: /listado whatsapp/i })).not.toBeInTheDocument();
  });
});
