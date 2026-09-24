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
  deletePlayerSanction: vi.fn(),
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
import SanctionCardStyles from "../components/SanctionCard.module.css";

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
        { id: "s1", startDate: "2026-01-01", sanctionType: "Amonestación", description: null, estimatedEnd: null, endDate: null },
      ],
    },
    {
      teamPlayerId: "player-2",
      sanctions: [
        { id: "s2", startDate: "2026-01-05", sanctionType: "Roja directa", description: null, estimatedEnd: null, endDate: null },
      ],
    },
  ];
}

describe("Sanctions - notification deep-link highlight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getTeamSanctionsMock.mockResolvedValue(buildTeamSanctions());
  });

  it("highlights the sanction card matching the ?highlight query param", async () => {
    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/coach/sanctions?highlight=s2"]}>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    await screen.findByText("Roja directa");

    const highlighted = document.getElementById("sanction-s2")!;
    const notHighlighted = document.getElementById("sanction-s1")!;

    expect(highlighted.className).toContain(SanctionCardStyles.highlighted);
    expect(notHighlighted.className).not.toContain(SanctionCardStyles.highlighted);
  });

  it("does not highlight any card when there is no highlight query param", async () => {
    render(
      <UserProvider>
        <MemoryRouter initialEntries={["/coach/sanctions"]}>
          <Sanctions />
        </MemoryRouter>
      </UserProvider>
    );

    await waitFor(() => expect(getTeamSanctionsMock).toHaveBeenCalled());
    await screen.findByText("Amonestación");

    const s1 = document.getElementById("sanction-s1")!;
    const s2 = document.getElementById("sanction-s2")!;

    expect(s1.className).not.toContain(SanctionCardStyles.highlighted);
    expect(s2.className).not.toContain(SanctionCardStyles.highlighted);
  });
});
