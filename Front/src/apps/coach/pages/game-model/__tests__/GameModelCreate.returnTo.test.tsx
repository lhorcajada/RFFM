import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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
vi.mock("../../../services/gameModelService", () => ({
  default: {
    getMoments: vi.fn(async () => []),
    getByTeamIdAndSeason: vi.fn(async () => existingModel),
    getEmptyDraft: vi.fn(),
    update: (...args: unknown[]) => mockUpdate(...args),
    create: vi.fn(),
  },
}));

import GameModelCreate from "../GameModelCreate";

const existingModel: GameModelType = {
  id: "gm-1",
  teamId: "team-1",
  name: "Modelo de Juego 2026-2027",
  season: "2026-2027",
  principles: [
    {
      id: 1,
      apiId: "principle-1",
      gameMomentId: 1,
      gameMomentName: "Fase defensiva",
      numero: 1,
      titulo: "Defensa organizada",
      texto: "",
      subprincipios: [],
      notas: [],
    },
  ],
  setPieceRules: [],
  openIssues: [],
};

const boardUrl = "/coach/trainings/content-board?clubId=club-1&teamId=team-1&microcicloId=micro-a";

function BoardProbe() {
  const location = useLocation();
  const state = location.state as { microciclo?: { weekLabel: string } } | null;
  return (
    <div>
      <div data-testid="board-location">{`${location.pathname}${location.search}`}</div>
      <div data-testid="board-week">{state?.microciclo?.weekLabel ?? ""}</div>
    </div>
  );
}

function renderEditor(state: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/coach/game-model/edit", search: "?teamId=team-1", state }]}>
      <Routes>
        <Route path="/coach/game-model/edit" element={<GameModelCreate />} />
        <Route path="/coach/game-model" element={<div>Pantalla de modelo de juego</div>} />
        <Route path="/coach/trainings/content-board" element={<BoardProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

const baseState = { season: "2026-2027", teamId: "team-1" };

describe("GameModelCreate — vuelta a la pantalla de origen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("al guardar vuelve a returnTo conservando su state", async () => {
    renderEditor({ ...baseState, returnTo: boardUrl, returnState: { microciclo: { weekLabel: "Semana 3" } } });

    const bar = await screen.findByRole("region", { name: /acciones del formulario/i });
    await userEvent.click(within(bar).getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(screen.getByTestId("board-location")).toHaveTextContent(boardUrl));
    expect(screen.getByTestId("board-week")).toHaveTextContent("Semana 3");
  });

  it("al cancelar vuelve a returnTo", async () => {
    renderEditor({ ...baseState, returnTo: boardUrl });

    await screen.findByRole("region", { name: /acciones del formulario/i });
    await userEvent.click(screen.getAllByRole("button", { name: /cancelar/i })[0]);

    expect(screen.getByTestId("board-location")).toHaveTextContent(boardUrl);
  });

  it("sin returnTo, cancelar vuelve a la pantalla de modelo de juego", async () => {
    renderEditor(baseState);

    await screen.findByRole("region", { name: /acciones del formulario/i });
    await userEvent.click(screen.getAllByRole("button", { name: /cancelar/i })[0]);

    expect(screen.getByText("Pantalla de modelo de juego")).toBeInTheDocument();
  });
});
