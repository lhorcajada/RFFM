import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameModel as GameModelType } from "../../../types/gameModel";
import type { AssistantChange } from "../../../services/gameModelService";

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
const mockAssistant = vi.fn();
const mockGetByTeamIdAndSeason = vi.fn();
vi.mock("../../../services/gameModelService", () => ({
  default: {
    getMoments: vi.fn(async () => []),
    getByTeamIdAndSeason: (...args: unknown[]) => mockGetByTeamIdAndSeason(...args),
    getEmptyDraft: vi.fn(async () => ({ ...existingModel, id: "" })),
    update: (...args: unknown[]) => mockUpdate(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    assistant: (...args: unknown[]) => mockAssistant(...args),
  },
}));

const mockGetAiProviders = vi.fn();
vi.mock("../../../services/aiProviderService", () => ({
  getAiProviders: (...args: unknown[]) => mockGetAiProviders(...args),
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

const activeProvider = { id: "p1", template: "claude", baseUrl: "https://api.anthropic.com", model: "claude", maskedApiKey: "****", isActive: true };

const addUno: AssistantChange = {
  id: "c1",
  operation: "add",
  nodeType: "subprincipio",
  parentAddress: "moment-1/1",
  fields: { numero: "1.1", titulo: "Presión alta", texto: "Presionar tras pérdida" },
};

function renderEditor(pathname = "/coach/game-model/edit") {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname, search: "?teamId=team-1", state: { season: "2026-2027", teamId: "team-1" } }]}
    >
      <Routes>
        <Route path="/coach/game-model/edit" element={<GameModelCreate />} />
        <Route path="/coach/game-model/create" element={<GameModelCreate />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("GameModelCreate — asistente en la edición", () => {
  const snackbar = vi.fn();
  const onSnackbar = (e: Event) => snackbar((e as CustomEvent).detail);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
    mockGetByTeamIdAndSeason.mockResolvedValue(existingModel);
    mockGetAiProviders.mockResolvedValue([activeProvider]);
    window.addEventListener("rffm.show_snackbar", onSnackbar);
  });

  afterEach(() => window.removeEventListener("rffm.show_snackbar", onSnackbar));

  async function openAndPropose(user: ReturnType<typeof userEvent.setup>, version = "v2") {
    mockAssistant.mockResolvedValue({ kind: "proposal", message: "Propuesta", changes: [addUno], discardedCount: 0, version });
    await user.click(await screen.findByRole("button", { name: "Asistente" }));
    await user.type(screen.getByRole("textbox", { name: /mensaje para el asistente/i, hidden: true }), "Propón cambios");
    await user.click(screen.getByRole("button", { name: "Enviar", hidden: true }));
    await screen.findByRole("button", { name: "Aceptar", hidden: true });
  }

  async function saveFromForm(user: ReturnType<typeof userEvent.setup>) {
    const bar = await screen.findByRole("region", { name: /acciones del formulario/i });
    await user.click(within(bar).getByRole("button", { name: /guardar cambios/i }));
  }

  it("al editar un modelo con proveedor activo hay un botón Asistente habilitado", async () => {
    renderEditor();

    expect(await screen.findByRole("button", { name: "Asistente" })).toBeEnabled();
  });

  it("al crear un modelo nuevo no hay botón Asistente", async () => {
    renderEditor("/coach/game-model/create");

    await screen.findByRole("region", { name: /acciones del formulario/i });
    expect(screen.queryByRole("button", { name: "Asistente" })).not.toBeInTheDocument();
  });

  it("sin proveedor activo el botón está deshabilitado y hay un enlace a Ajustes de IA", async () => {
    mockGetAiProviders.mockResolvedValue([{ ...activeProvider, isActive: false }]);
    renderEditor();

    expect(await screen.findByRole("button", { name: "Asistente" })).toBeDisabled();
    expect(screen.getByRole("link", { name: /ajustes de ia/i })).toHaveAttribute("href", "/coach/ai-settings");
  });

  it("aceptar un cambio y guardar con el botón del editor envía el borrador con el cambio y la versión de la propuesta", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openAndPropose(user);

    await user.click(screen.getByRole("button", { name: "Aceptar", hidden: true }));
    await saveFromForm(user);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [draft, options] = mockUpdate.mock.calls[0];
    expect((draft as GameModelType).principles[0].subprincipios.map((s) => s.titulo)).toEqual(["Presión alta"]);
    expect(options).toEqual({ expectedVersion: "v2" });
  });

  it("guardar sin haber aceptado ningún cambio del asistente no envía versión de propuesta", async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole("button", { name: "Asistente" });

    await saveFromForm(user);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toBeUndefined();
  });

  it("un error GameModelStale al guardar recarga el modelo, limpia la propuesta y avisa de que hay que regenerarla", async () => {
    mockUpdate.mockRejectedValue(Object.assign(new Error("El modelo ha cambiado."), { code: "GameModelStale" }));
    const user = userEvent.setup();
    renderEditor();
    await openAndPropose(user);

    await user.click(screen.getByRole("button", { name: "Aceptar", hidden: true }));
    await saveFromForm(user);

    await waitFor(() => expect(mockGetByTeamIdAndSeason).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryAllByRole("button", { name: "Aceptar", hidden: true })).toHaveLength(0));
    expect(snackbar.mock.calls.some((call) => /propuesta/i.test(JSON.stringify(call[0])))).toBe(true);
  });

  it("tras guardar bien se limpia la conversación del asistente", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openAndPropose(user);

    await user.click(screen.getByRole("button", { name: "Aceptar", hidden: true }));
    await saveFromForm(user);

    await waitFor(() => expect(screen.queryByText("Propón cambios")).not.toBeInTheDocument());
  });
});
