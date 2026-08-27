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

const mockGetPlayersByTeam = vi.fn();
vi.mock("../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => mockGetPlayersByTeam(...args),
  },
}));

const mockGetTeamSanctions = vi.fn();
vi.mock("../../../services/teamplayerSanctionService", () => ({
  default: {
    createPlayerSanction: vi.fn(),
    updatePlayerSanction: vi.fn(),
    getTeamSanctions: (...args: unknown[]) => mockGetTeamSanctions(...args),
  },
  getPlayerSanctions: vi.fn(),
  getTeamSanctions: (...args: unknown[]) => mockGetTeamSanctions(...args),
  createPlayerSanction: vi.fn(),
  updatePlayerSanction: vi.fn(),
}));

import Sanctions from "../Sanctions";

function renderPage() {
  render(
    <MemoryRouter>
      <Sanctions />
    </MemoryRouter>
  );
}

describe("Sanctions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("obtiene las sanciones de todo el equipo con una única llamada, no una por jugador", async () => {
    mockGetPlayersByTeam.mockResolvedValue([
      { id: "tp-1", name: "Ana", lastName: "García", alias: "ana" },
      { id: "tp-2", name: "Luis", lastName: "Pérez", alias: "luis" },
    ]);
    mockGetTeamSanctions.mockResolvedValue([
      {
        teamPlayerId: "tp-1",
        sanctions: [
          {
            id: "san-1",
            startDate: "2026-01-01T00:00:00Z",
            sanctionType: "Expulsión",
            endDate: null,
          },
        ],
      },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("Expulsión")).toBeInTheDocument());

    expect(mockGetTeamSanctions).toHaveBeenCalledTimes(1);
    expect(mockGetTeamSanctions).toHaveBeenCalledWith("team-1");
  });

  it("muestra un estado vacío cuando ningún jugador tiene sanciones registradas", async () => {
    mockGetPlayersByTeam.mockResolvedValue([
      { id: "tp-1", name: "Ana", lastName: "García", alias: "ana" },
    ]);
    mockGetTeamSanctions.mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/Sin sanciones/i)).toBeInTheDocument());
  });
});
