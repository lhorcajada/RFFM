import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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

const mockGoToTeamDashboard = vi.fn();
vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => mockGoToTeamDashboard,
}));

const mockGetSeasonsByTeamId = vi.fn();
const mockGetByTeamIdAndSeason = vi.fn();
const mockUpdate = vi.fn();
const mockAssistant = vi.fn();
vi.mock("../../../services/gameModelService", () => ({
  default: {
    getSeasonsByTeamId: (...args: unknown[]) => mockGetSeasonsByTeamId(...args),
    getByTeamIdAndSeason: (...args: unknown[]) => mockGetByTeamIdAndSeason(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    assistant: (...args: unknown[]) => mockAssistant(...args),
    delete: vi.fn(),
  },
}));

const mockGetAiProviders = vi.fn();
vi.mock("../../../services/aiProviderService", () => ({
  getAiProviders: (...args: unknown[]) => mockGetAiProviders(...args),
}));

vi.mock("../../../services/seasonService", () => ({
  default: {
    getSeasons: vi.fn(async () => []),
    createSeason: vi.fn(),
  },
}));

let mockFeaturePermissions: { featureRoute: string; permissionType: string }[] = [
  { featureRoute: "/coach/game-model", permissionType: "ReadWrite" },
];
let mockRoles: string[] = ["Coach"];
vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({
    loading: false,
    roles: mockRoles,
    featurePermissions: mockFeaturePermissions,
    hasFeatureAccess: vi.fn(() => true),
  }),
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
  mockRoles = ["Coach"];
  mockFeaturePermissions = [{ featureRoute: "/coach/game-model", permissionType: "ReadWrite" }];
  mockGetAiProviders.mockResolvedValue([]);
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

  it("muestra los controles de edición cuando el usuario tiene permiso ReadWrite", async () => {
    mockFeaturePermissions = [{ featureRoute: "/coach/game-model", permissionType: "ReadWrite" }];
    mockGetSeasonsByTeamId.mockResolvedValue(["2025/2026"]);
    mockGetByTeamIdAndSeason.mockResolvedValue(buildModel());

    render(
      <MemoryRouter>
        <GameModel />
      </MemoryRouter>
    );

    expect(await screen.findByText("Modelo de Juego 2025/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nuevo modelo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar modelo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminar modelo/i })).toBeInTheDocument();
  });

  it("oculta los controles de edición cuando el usuario solo tiene permiso de lectura", async () => {
    mockFeaturePermissions = [{ featureRoute: "/coach/game-model", permissionType: "Read" }];
    mockGetSeasonsByTeamId.mockResolvedValue(["2025/2026"]);
    mockGetByTeamIdAndSeason.mockResolvedValue(buildModel());

    render(
      <MemoryRouter>
        <GameModel />
      </MemoryRouter>
    );

    expect(await screen.findByText("Modelo de Juego 2025/2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nuevo modelo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar modelo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar modelo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /descargar pdf/i })).toBeInTheDocument();
  });
});

const activeProvider = { id: "p1", template: "claude", baseUrl: "https://api.anthropic.com", model: "claude", maskedApiKey: "****", isActive: true };

const addUno: AssistantChange = {
  id: "c1",
  operation: "add",
  nodeType: "subprincipio",
  parentAddress: "moment-1/1",
  fields: { numero: "1.1", titulo: "Uno", texto: "Texto uno" },
};
const addDos: AssistantChange = {
  id: "c2",
  operation: "add",
  nodeType: "subprincipio",
  parentAddress: "moment-1/1",
  fields: { numero: "1.2", titulo: "Dos", texto: "Texto dos" },
};
const addNota: AssistantChange = {
  id: "c3",
  operation: "add",
  nodeType: "nota",
  parentAddress: "moment-1/1",
  fields: { tipo: "nota", texto: "Tres" },
};

describe("GameModel page — asistente", () => {
  const snackbarListener = vi.fn();

  async function renderPage() {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GameModel />
      </MemoryRouter>
    );
    await screen.findByText("Modelo de Juego 2025/2026");
    return user;
  }

  async function sendProposal(user: ReturnType<typeof userEvent.setup>, changes: AssistantChange[], version = "v2") {
    mockAssistant.mockResolvedValue({ kind: "proposal", message: "Propuesta", changes, discardedCount: 0, version });
    await user.click(await screen.findByRole("button", { name: "Asistente" }));
    await user.type(screen.getByRole("textbox"), "Propón cambios");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Aceptar", hidden: true })).toHaveLength(changes.length)
    );
  }

  beforeEach(() => {
    mockRoles = ["Coach"];
    mockFeaturePermissions = [{ featureRoute: "/coach/game-model", permissionType: "ReadWrite" }];
    mockGetSeasonsByTeamId.mockResolvedValue(["2025/2026"]);
    mockGetByTeamIdAndSeason.mockResolvedValue(buildModel());
    mockGetAiProviders.mockResolvedValue([activeProvider]);
    snackbarListener.mockClear();
    window.addEventListener("rffm.show_snackbar", snackbarListener as EventListener);
  });

  afterEach(() => {
    window.removeEventListener("rffm.show_snackbar", snackbarListener as EventListener);
  });

  it("un usuario sin permiso ReadWrite ni rol de administrador no ve el botón Asistente", async () => {
    mockFeaturePermissions = [{ featureRoute: "/coach/game-model", permissionType: "Read" }];
    await renderPage();

    expect(screen.queryByRole("button", { name: "Asistente" })).not.toBeInTheDocument();
  });

  it("un entrenador con permiso de escritura y un proveedor activo ve el botón Asistente habilitado", async () => {
    await renderPage();

    expect(await screen.findByRole("button", { name: "Asistente" })).toBeEnabled();
  });

  it("sin proveedor activo el botón Asistente está deshabilitado y hay un enlace a Ajustes de IA", async () => {
    mockGetAiProviders.mockResolvedValue([{ ...activeProvider, isActive: false }]);
    await renderPage();

    expect(await screen.findByRole("button", { name: "Asistente" })).toBeDisabled();
    expect(screen.getByRole("link", { name: /ajustes de ia/i })).toHaveAttribute("href", "/coach/ai-settings");
  });

  it("aceptar dos de tres cambios y guardar envía una sola actualización con esos dos y la versión de la propuesta", async () => {
    mockUpdate.mockResolvedValue(undefined);
    const user = await renderPage();
    await sendProposal(user, [addUno, addDos, addNota]);

    await user.click(screen.getAllByRole("button", { name: "Aceptar", hidden: true })[0]);
    await user.click(screen.getAllByRole("button", { name: "Aceptar", hidden: true })[0]);
    await user.click(screen.getByRole("button", { name: "Guardar cambios del asistente", hidden: true }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [draft, options] = mockUpdate.mock.calls[0];
    expect((draft as GameModelType).principles[0].subprincipios.map((s) => s.titulo)).toEqual(["Uno", "Dos"]);
    expect((draft as GameModelType).principles[0].notas).toEqual([]);
    expect(options).toEqual({ expectedVersion: "v2" });
  });

  it("rechazar todas las tarjetas no deja acción de guardar ni envía actualización", async () => {
    const user = await renderPage();
    await sendProposal(user, [addUno, addDos]);

    await user.click(screen.getAllByRole("button", { name: "Rechazar", hidden: true })[0]);
    await user.click(screen.getAllByRole("button", { name: "Rechazar", hidden: true })[0]);

    expect(screen.queryByRole("button", { name: "Guardar cambios del asistente", hidden: true })).not.toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("un fallo al guardar no recarga el modelo guardado y avisa con el mensaje del error", async () => {
    mockUpdate.mockRejectedValue(Object.assign(new Error("No se pudo guardar el modelo."), { code: "ServerError" }));
    const user = await renderPage();
    await sendProposal(user, [addUno]);

    await user.click(screen.getAllByRole("button", { name: "Aceptar", hidden: true })[0]);
    await user.click(screen.getByRole("button", { name: "Guardar cambios del asistente", hidden: true }));

    await waitFor(() => expect(snackbarListener).toHaveBeenCalled());
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockGetByTeamIdAndSeason).toHaveBeenCalledTimes(1);
    expect(snackbarListener.mock.calls.some((call) => JSON.stringify(call[0].detail).includes("No se pudo guardar el modelo."))).toBe(true);
    expect(screen.getAllByRole("heading", { name: "No permitir progresar al rival" }).length).toBeGreaterThan(0);
  });

  it("un error GameModelStale al guardar recarga el modelo, limpia la propuesta y avisa de que hay que regenerarla", async () => {
    mockUpdate.mockRejectedValue(Object.assign(new Error("El modelo ha cambiado."), { code: "GameModelStale" }));
    const user = await renderPage();
    await sendProposal(user, [addUno]);

    await user.click(screen.getAllByRole("button", { name: "Aceptar", hidden: true })[0]);
    await user.click(screen.getByRole("button", { name: "Guardar cambios del asistente", hidden: true }));

    await waitFor(() => expect(mockGetByTeamIdAndSeason).toHaveBeenCalledTimes(2));
    expect(screen.queryAllByRole("button", { name: "Aceptar", hidden: true })).toHaveLength(0);
    await waitFor(() => expect(snackbarListener).toHaveBeenCalled());
    expect(snackbarListener.mock.calls.some((call) => /propuesta/i.test(JSON.stringify(call[0].detail)))).toBe(true);
  });

  it("cerrar el panel con una propuesta pendiente borra la conversación y las tarjetas", async () => {
    const user = await renderPage();
    await sendProposal(user, [addUno]);

    await user.click(screen.getByRole("button", { name: /cerrar/i }));

    await waitFor(() => expect(screen.queryAllByRole("button", { name: "Aceptar", hidden: true })).toHaveLength(0));
    await user.click(screen.getByRole("button", { name: "Asistente" }));
    expect(screen.queryByText("Propón cambios")).not.toBeInTheDocument();
  });
});
