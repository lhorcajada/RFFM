import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameModel as GameModelType } from "../../../types/gameModel";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ actionBar, children }: { actionBar?: React.ReactNode; children: React.ReactNode }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));

const mockTeam = { id: "team-1", name: "Equipo 1", club: { id: "club-1" } };
vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: vi.fn(() => ({
    teamTitleNode: <span>Equipo 1</span>,
    clubSubtitleNode: <span>Club 1</span>,
    team: mockTeam,
  })),
}));

const mockGoToTeamDashboard = vi.fn();
vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => mockGoToTeamDashboard,
}));

const mockGetSeasonsByTeamId = vi.fn();
const mockGetByTeamIdAndSeason = vi.fn();
vi.mock("../../../services/gameModelService", () => ({
  default: {
    getSeasonsByTeamId: (...args: unknown[]) => mockGetSeasonsByTeamId(...args),
    getByTeamIdAndSeason: (...args: unknown[]) => mockGetByTeamIdAndSeason(...args),
    delete: vi.fn(),
  },
}));

vi.mock("../../../services/seasonService", () => ({
  default: {
    getSeasons: vi.fn(async () => []),
    createSeason: vi.fn(),
  },
}));

import GameModel from "../GameModel";

function buildModel(): GameModelType {
  return {
    id: "gm-1",
    teamId: "team-1",
    name: "Modelo de Juego 2025/2026",
    season: "2025/2026",
    principles: [
      {
        id: 1,
        gameMomentId: 1,
        gameMomentName: "Defensa Organizada",
        numero: 1,
        titulo: "No permitir progresar al rival",
        texto: "texto",
        subprincipios: [],
        notas: [],
      },
    ],
    setPieceRules: [],
    openIssues: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GameModel page", () => {
  it("muestra el estado vacío cuando el equipo no tiene modelo de juego", async () => {
    mockGetSeasonsByTeamId.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <GameModel />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText(/No hay modelo de juego creado para este equipo/)).toBeInTheDocument()
    );
  });

  it("carga el modelo de la temporada seleccionada y lo renderiza como el documento legible", async () => {
    mockGetSeasonsByTeamId.mockResolvedValue(["2025/2026"]);
    mockGetByTeamIdAndSeason.mockResolvedValue(buildModel());

    render(
      <MemoryRouter>
        <GameModel />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetByTeamIdAndSeason).toHaveBeenCalledWith("team-1", "2025/2026"));
    expect(await screen.findByText("Modelo de Juego 2025/2026")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2, name: "Defensa Organizada" }).length).toBeGreaterThan(0);
  });
});
