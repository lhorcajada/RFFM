import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    actionBar,
    children,
  }: {
    actionBar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));

const mockTeam = { id: "team-1", name: "Equipo 1", club: { id: "club-1" } };
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: vi.fn(() => ({
    teamTitleNode: <span>Equipo 1</span>,
    team: mockTeam,
  })),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

const mockGetPlayersByTeam = vi.fn();
const mockGetTeamInjuries = vi.fn();
vi.mock("../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => mockGetPlayersByTeam(...args),
  },
  getPlayerInjuries: vi.fn(),
  getTeamInjuries: (...args: unknown[]) => mockGetTeamInjuries(...args),
  createPlayerInjury: vi.fn(),
  updatePlayerInjury: vi.fn(),
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

import Injured from "../Injured";

function renderPage() {
  render(
    <MemoryRouter>
      <Injured />
    </MemoryRouter>
  );
}

describe("Injured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rolesMock = ["Coach"];
  });

  it("obtiene las lesiones de todo el equipo con una única llamada, no una por jugador", async () => {
    mockGetPlayersByTeam.mockResolvedValue([
      { id: "tp-1", name: "Ana", lastName: "García", alias: "ana" },
      { id: "tp-2", name: "Luis", lastName: "Pérez", alias: "luis" },
    ]);
    mockGetTeamInjuries.mockResolvedValue([
      {
        teamPlayerId: "tp-1",
        injuries: [
          {
            id: "inj-1",
            startDate: "2026-01-01T00:00:00Z",
            injuryType: "Rotura fibrilar",
            endDate: null,
          },
        ],
      },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("Rotura fibrilar")).toBeInTheDocument());

    expect(mockGetTeamInjuries).toHaveBeenCalledTimes(1);
    expect(mockGetTeamInjuries).toHaveBeenCalledWith("team-1");
  });

  it("muestra un estado vacío cuando ningún jugador tiene lesiones registradas", async () => {
    mockGetPlayersByTeam.mockResolvedValue([
      { id: "tp-1", name: "Ana", lastName: "García", alias: "ana" },
    ]);
    mockGetTeamInjuries.mockResolvedValue([]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Sin lesiones registradas/i)).toBeInTheDocument()
    );
  });
});

describe("Injured - action visibility by role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlayersByTeam.mockResolvedValue([
      { id: "tp-1", name: "Ana", lastName: "García", alias: "ana" },
    ]);
    mockGetTeamInjuries.mockResolvedValue([
      {
        teamPlayerId: "tp-1",
        injuries: [
          {
            id: "inj-1",
            startDate: "2026-01-01T00:00:00Z",
            injuryType: "Rotura fibrilar",
            endDate: null,
          },
        ],
      },
    ]);
  });

  it("shows 'Añadir lesión', 'Editar' and 'Dar de alta' actions for a coach", async () => {
    rolesMock = ["Coach"];

    renderPage();

    await waitFor(() => expect(mockGetTeamInjuries).toHaveBeenCalled());
    await screen.findByText("Rotura fibrilar");

    expect(
      await screen.findByRole("button", { name: /añadir lesión/i })
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^editar$/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /dar de alta/i })).toBeInTheDocument();
  });

  it("hides injury management actions for a player", async () => {
    rolesMock = ["Player"];

    renderPage();

    await waitFor(() => expect(mockGetTeamInjuries).toHaveBeenCalled());
    await screen.findByText("Rotura fibrilar");

    expect(
      screen.queryByRole("button", { name: /añadir lesión/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dar de alta/i })).not.toBeInTheDocument();
  });

  it("hides injury management actions for a family member", async () => {
    rolesMock = ["FamilyMember"];

    renderPage();

    await waitFor(() => expect(mockGetTeamInjuries).toHaveBeenCalled());
    await screen.findByText("Rotura fibrilar");

    expect(
      screen.queryByRole("button", { name: /añadir lesión/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dar de alta/i })).not.toBeInTheDocument();
  });

  it("hides injury management actions for a family player", async () => {
    rolesMock = ["FamilyPlayer"];

    renderPage();

    await waitFor(() => expect(mockGetTeamInjuries).toHaveBeenCalled());
    await screen.findByText("Rotura fibrilar");

    expect(
      screen.queryByRole("button", { name: /añadir lesión/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dar de alta/i })).not.toBeInTheDocument();
  });
});
