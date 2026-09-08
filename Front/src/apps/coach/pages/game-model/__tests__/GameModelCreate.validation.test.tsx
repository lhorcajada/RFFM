import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

const mockUpdate = vi.fn();
const mockGetByTeamIdAndSeason = vi.fn();
vi.mock("../../../services/gameModelService", () => ({
  default: {
    getMoments: vi.fn(async () => []),
    getByTeamIdAndSeason: (...args: unknown[]) => mockGetByTeamIdAndSeason(...args),
    getEmptyDraft: vi.fn(async (teamId: string, season: string) => ({
      id: "",
      teamId,
      season,
      name: `Modelo de Juego ${season}`,
      principles: [],
      setPieceRules: [],
      openIssues: [],
    })),
    update: (...args: unknown[]) => mockUpdate(...args),
    create: vi.fn(),
  },
}));

import GameModelCreate from "../GameModelCreate";

function buildModelWithZonasAndDirectSubSubPrincipios(): GameModelType {
  return {
    id: "gm-1",
    teamId: "team-1",
    name: "Modelo de Juego 2025/2026",
    season: "2025/2026",
    principles: [
      {
        id: 1,
        gameMomentId: 1,
        gameMomentName: "Balón Parado",
        numero: 6,
        titulo: "Principio 6",
        texto: "texto",
        subprincipios: [
          {
            id: 1,
            apiId: "sp-1",
            numero: "2.3",
            titulo: "Resolver en Zona de Finalización",
            texto: "texto",
            zonas: [
              {
                id: 1,
                apiId: "z-1",
                zoneKeys: ["finalizacion"],
                texto: "",
                subSubPrincipios: [],
                notas: [],
              },
            ],
            subSubPrincipios: [
              {
                id: 2,
                apiId: "ssp-1",
                numero: "2.3.1",
                rol: "Jugador de segunda línea",
                texto: "texto",
                habilidades: [],
                notas: [],
              },
            ],
            notas: [],
          },
        ],
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

describe("GameModelCreate — subprincipio con Zonas y sub-subprincipios directos a la vez", () => {
  it("permite guardar sin bloquear: un subprincipio puede tener sub-subprincipios generales (directos) y zona-específicos (bajo Zonas) a la vez", async () => {
    mockGetByTeamIdAndSeason.mockResolvedValue(buildModelWithZonasAndDirectSubSubPrincipios());
    mockUpdate.mockResolvedValue(undefined);

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/coach/game-model/edit", search: "?teamId=team-1", state: { season: "2025/2026", teamId: "team-1" } },
        ]}
      >
        <Routes>
          <Route path="/coach/game-model/edit" element={<GameModelCreate />} />
          <Route path="/coach/game-model" element={<div>Volver al modelo de juego</div>} />
        </Routes>
      </MemoryRouter>
    );

    const bar = await screen.findByRole("region", { name: /acciones del formulario/i });
    const saveButton = within(bar).getByRole("button", { name: /guardar cambios/i });

    await userEvent.click(saveButton);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Errores de validación/i)).not.toBeInTheDocument();
  });
});
