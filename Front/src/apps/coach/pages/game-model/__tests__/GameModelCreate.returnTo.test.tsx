import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const mockCreate = vi.fn();
const mockGetByTeamIdAndSeason = vi.fn();
vi.mock("../../../services/gameModelService", () => ({
  default: {
    getMoments: vi.fn(async () => []),
    getByTeamIdAndSeason: (...args: unknown[]) => mockGetByTeamIdAndSeason(...args),
    getEmptyDraft: vi.fn(async () => ({ ...existingModel, id: "" })),
    update: (...args: unknown[]) => mockUpdate(...args),
    create: (...args: unknown[]) => mockCreate(...args),
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

function EditorLocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname}</div>;
}

function renderEditor(state: Record<string, unknown>, pathname = "/coach/game-model/edit") {
  return render(
    <MemoryRouter initialEntries={[{ pathname, search: "?teamId=team-1", state }]}>
      <EditorLocationProbe />
      <Routes>
        <Route path="/coach/game-model/edit" element={<GameModelCreate />} />
        <Route path="/coach/game-model/create" element={<GameModelCreate />} />
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
    mockGetByTeamIdAndSeason.mockResolvedValue(existingModel);
  });

  it("al cancelar vuelve a returnTo conservando su state", async () => {
    renderEditor({ ...baseState, returnTo: boardUrl, returnState: { microciclo: { weekLabel: "Semana 3" } } });

    await screen.findByRole("region", { name: /acciones del formulario/i });
    await userEvent.click(screen.getAllByRole("button", { name: /cancelar/i })[0]);

    expect(screen.getByTestId("board-location")).toHaveTextContent(boardUrl);
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

describe("GameModelCreate — guardar sin salir del editor", () => {
  let snackbar: ReturnType<typeof vi.fn>;
  const onSnackbar = (e: Event) => snackbar((e as CustomEvent).detail);

  beforeEach(() => {
    vi.clearAllMocks();
    snackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", onSnackbar);
    mockUpdate.mockResolvedValue(undefined);
    mockGetByTeamIdAndSeason.mockResolvedValue(existingModel);
  });

  afterEach(() => window.removeEventListener("rffm.show_snackbar", onSnackbar));

  async function clickSave(name: RegExp) {
    const bar = await screen.findByRole("region", { name: /acciones del formulario/i });
    await userEvent.click(within(bar).getByRole("button", { name }));
  }

  it("al guardar bien se queda en el editor y muestra una alerta de éxito", async () => {
    renderEditor({ ...baseState, returnTo: boardUrl });

    await clickSave(/guardar cambios/i);

    await waitFor(() =>
      expect(snackbar).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
    );
    expect(screen.getByTestId("current-location")).toHaveTextContent("/coach/game-model/edit");
    expect(screen.queryByTestId("board-location")).not.toBeInTheDocument();
  });

  it("al guardar bien recarga el modelo del servidor", async () => {
    renderEditor(baseState);

    await clickSave(/guardar cambios/i);

    await waitFor(() => expect(mockGetByTeamIdAndSeason).toHaveBeenCalledTimes(2));
  });

  it("si falla, se queda en el editor y muestra el error del backend", async () => {
    mockUpdate.mockRejectedValue({ response: { data: { detail: "La zona no es válida" } } });
    renderEditor({ ...baseState, returnTo: boardUrl });

    await clickSave(/guardar cambios/i);

    await waitFor(() =>
      expect(snackbar).toHaveBeenCalledWith({ message: "La zona no es válida", severity: "error" })
    );
    expect(screen.getByTestId("current-location")).toHaveTextContent("/coach/game-model/edit");
  });

  it("si falla sin detalle, muestra un mensaje de error genérico", async () => {
    mockUpdate.mockRejectedValue(new Error("Network Error"));
    renderEditor(baseState);

    await clickSave(/guardar cambios/i);

    await waitFor(() =>
      expect(snackbar).toHaveBeenCalledWith({ message: "No se pudo guardar el modelo.", severity: "error" })
    );
  });

  it("al crear un modelo nuevo pasa a modo edición en la misma pantalla", async () => {
    mockCreate.mockResolvedValue({ ...existingModel, id: "gm-new" });
    renderEditor(baseState, "/coach/game-model/create");

    await clickSave(/guardar modelo/i);

    await waitFor(() => expect(screen.getByTestId("current-location")).toHaveTextContent("/coach/game-model/edit"));
    expect(snackbar).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }));
  });
});
