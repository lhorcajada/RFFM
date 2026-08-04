import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GameModel, Principle, Scenario } from "../../../../types/gameModel";
import { GameModelDraftProvider } from "../../../../context/GameModelDraftContext";
import ScenarioFormAccordion from "../ScenarioFormAccordion";

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

vi.mock("../../../../services/gameModelService", () => ({
  default: {
    uploadScenarioMedia: vi.fn(),
    deleteScenarioMedia: vi.fn(),
    moveScenarioToPrinciple: vi.fn(),
  },
}));

import gameModelService from "../../../../services/gameModelService";

function buildScenario(id: number, order: number, subPrincipleCount = 0, apiId?: string): Scenario {
  return {
    id,
    apiId,
    order,
    name: `Escenario nombre ${order}`,
    context: "",
    subPrinciples: Array.from({ length: subPrincipleCount }, (_, i) => ({
      id: id * 100 + i,
      order: i + 1,
      label: String.fromCharCode(65 + i),
      name: `Subprincipio ${String.fromCharCode(65 + i)}`,
      context: "",
      subSubPrinciples: [],
    })),
  };
}

function buildPrinciple(id: number, order: number, scenarios: Scenario[], apiId?: string): Principle {
  return {
    id,
    apiId,
    gameMomentId: 1,
    gameZoneId: 1,
    order,
    title: `Principio nombre ${order}`,
    description: "",
    scenarios,
  };
}

function buildDraft(principles: Principle[]): GameModel {
  return {
    id: "draft-1",
    teamId: "team-1",
    name: "Modelo de prueba",
    season: "2025/2026",
    gameMoments: [
      {
        id: 1,
        name: "Momento",
        zones: [
          { id: 1, name: "Zona", principles },
          { id: 2, name: "Zona 2", principles: [] },
        ],
      },
      {
        id: 2,
        name: "Momento 2",
        zones: [
          { id: 1, name: "Zona", principles: [] },
          { id: 2, name: "Zona 2", principles: [] },
        ],
      },
    ],
  };
}

function renderWithDraft(principles: Principle[]) {
  const draft = buildDraft(principles);
  render(
    <GameModelDraftProvider initialDraft={draft}>
      <ScenarioFormAccordion mi={0} zi={0} principles={draft.gameMoments[0].zones[0].principles} />
    </GameModelDraftProvider>
  );
}

describe("ScenarioFormAccordion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMediaQuery.mockReturnValue(false); // desktop by default
  });

  it("muestra la lista de principios y su detalle en escritorio", () => {
    renderWithDraft([buildPrinciple(1, 1, []), buildPrinciple(2, 2, [])]);
    expect(screen.getByText("Principio nombre 1")).toBeInTheDocument();
    expect(screen.getByText("Principio nombre 2")).toBeInTheDocument();
  });

  it("selecciona automáticamente el único principio cuando solo hay uno", () => {
    renderWithDraft([buildPrinciple(1, 1, [])]);
    expect(screen.getByLabelText("Título")).toBeInTheDocument();
  });

  it("añadir principio despacha ADD_PRINCIPLE y aparece un nuevo principio en la lista", async () => {
    renderWithDraft([buildPrinciple(1, 1, [])]);
    await userEvent.click(screen.getByRole("button", { name: /añadir principio/i }));
    expect(screen.getByLabelText("Título")).toBeInTheDocument();
    expect(screen.getByLabelText("Descripción")).toBeInTheDocument();
  });

  it("editar título del principio despacha UPD_PRINCIPLE", async () => {
    renderWithDraft([buildPrinciple(1, 1, [])]);
    const titleField = screen.getByLabelText("Título");
    await userEvent.clear(titleField);
    await userEvent.type(titleField, "Nuevo título");
    expect(screen.getByDisplayValue("Nuevo título")).toBeInTheDocument();
  });

  it("eliminar principio despacha DEL_PRINCIPLE y desaparece de la lista", async () => {
    renderWithDraft([buildPrinciple(1, 1, []), buildPrinciple(2, 2, [])]);
    await userEvent.click(screen.getAllByRole("button", { name: /eliminar principio/i })[0]);
    expect(screen.queryByText("Principio nombre 1")).not.toBeInTheDocument();
    expect(screen.getByText("Principio nombre 2")).toBeInTheDocument();
  });

  it("dentro del detalle de un principio, añadir escenario despacha ADD_SCENARIO y aparece en la lista", async () => {
    renderWithDraft([buildPrinciple(1, 1, [])]);
    await userEvent.click(screen.getByRole("button", { name: /añadir escenario/i }));
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });

  it("dentro del detalle de un escenario (único, auto-seleccionado), añadir subprincipio despacha ADD_SP", async () => {
    renderWithDraft([buildPrinciple(1, 1, [buildScenario(1, 1, 0)])]);
    await userEvent.click(screen.getByRole("button", { name: /añadir subprincipio/i }));
    expect(screen.getByText("Subprincipio A")).toBeInTheDocument();
  });

  it("los botones mover arriba/abajo de subprincipio están deshabilitados en los extremos", () => {
    renderWithDraft([buildPrinciple(1, 1, [buildScenario(1, 1, 2)])]);
    const rows = screen.getAllByRole("button", { name: "Mover arriba" });
    expect(rows[0]).toBeDisabled();
    const downButtons = screen.getAllByRole("button", { name: "Mover abajo" });
    expect(downButtons[downButtons.length - 1]).toBeDisabled();
  });

  it("mover un subprincipio abajo despacha MOVE_SP y reordena", async () => {
    renderWithDraft([buildPrinciple(1, 1, [buildScenario(1, 1, 2)])]);
    const downButtons = screen.getAllByRole("button", { name: "Mover abajo" });
    await userEvent.click(downButtons[0]);
    const list = screen.getByLabelText("Lista de subprincipios");
    const items = within(list).getAllByRole("button");
    expect(items[0]).toHaveTextContent("Subprincipio B");
  });

  it("añadir sub-subprincipio dentro de un subprincipio despacha ADD_SSP y muestra sus campos", async () => {
    renderWithDraft([buildPrinciple(1, 1, [buildScenario(1, 1, 1)])]);
    await userEvent.click(screen.getByRole("button", { name: /añadir sub-subprincipio/i }));
    expect(screen.getByPlaceholderText(/Acción: describe/)).toBeInTheDocument();
  });

  it("las filas de habilidad se apilan verticalmente por CSS (clase presente) al añadir una habilidad", async () => {
    renderWithDraft([buildPrinciple(1, 1, [buildScenario(1, 1, 1)])]);
    await userEvent.click(screen.getByRole("button", { name: /añadir sub-subprincipio/i }));
    await userEvent.click(screen.getByRole("button", { name: /añadir habilidad/i }));
    expect(screen.getByPlaceholderText("Nombre de la habilidad")).toBeInTheDocument();
  });

  it("escenario sin apiId muestra el aviso de guardar el modelo y no el campo de media", () => {
    renderWithDraft([buildPrinciple(1, 1, [buildScenario(1, 1, 0)])]);
    expect(screen.getByText(/guarda el modelo de juego/i)).toBeInTheDocument();
    expect(screen.queryByText(/subir imagen.*v[ií]deo/i)).not.toBeInTheDocument();
  });

  it("escenario con apiId muestra el campo de media", () => {
    renderWithDraft([buildPrinciple(1, 1, [buildScenario(1, 1, 0, "scenario-api-1")])]);
    expect(screen.getByText(/subir imagen.*v[ií]deo/i)).toBeInTheDocument();
    expect(screen.queryByText(/guarda el modelo de juego/i)).not.toBeInTheDocument();
  });

  it("no se muestra ningún campo 'Principios tácticos colectivos' en el formulario", () => {
    renderWithDraft([buildPrinciple(1, 1, [buildScenario(1, 1, 1)])]);
    expect(screen.queryByLabelText(/principios tácticos colectivos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/principios tácticos colectivos/i)).not.toBeInTheDocument();
  });

  describe("Mover a…", () => {
    it("no muestra el control Mover cuando no hay otro principio disponible como destino", () => {
      renderWithDraft([buildPrinciple(1, 1, [buildScenario(1, 1)])]);
      expect(screen.queryByRole("button", { name: "Mover escenario" })).not.toBeInTheDocument();
    });

    it("escenario con apiId: al mover llama al servicio con el id del principio destino y despacha MOVE_SCENARIO_LOCATION con el order devuelto", async () => {
      vi.mocked(gameModelService.moveScenarioToPrinciple).mockResolvedValue({ order: 1 });
      renderWithDraft([
        buildPrinciple(1, 1, [buildScenario(1, 1, 0, "scenario-api-1")], "principle-api-1"),
        buildPrinciple(2, 2, [], "principle-api-2"),
      ]);
      await userEvent.click(screen.getByText("Principio nombre 1"));

      const select = screen.getByLabelText("Principio");
      await userEvent.click(select);
      await userEvent.click(await screen.findByRole("option", { name: /Principio nombre 2/i }));

      const moveButton = screen.getByRole("button", { name: "Mover escenario" });
      expect(moveButton).not.toBeDisabled();
      await userEvent.click(moveButton);

      expect(gameModelService.moveScenarioToPrinciple).toHaveBeenCalledWith(
        "scenario-api-1",
        "principle-api-2"
      );
      expect(screen.queryByText("Escenario nombre 1")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /añadir escenario/i })).toBeInTheDocument();
    });

    it("escenario sin apiId: al mover despacha MOVE_SCENARIO_LOCATION sin llamar al servicio", async () => {
      renderWithDraft([buildPrinciple(1, 1, [buildScenario(1, 1, 0)]), buildPrinciple(2, 2, [])]);
      await userEvent.click(screen.getByText("Principio nombre 1"));

      const moveButton = screen.getByRole("button", { name: "Mover escenario" });
      await userEvent.click(moveButton);

      expect(gameModelService.moveScenarioToPrinciple).not.toHaveBeenCalled();
      expect(screen.queryByText("Escenario nombre 1")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /añadir escenario/i })).toBeInTheDocument();
    });

    it("si el servicio falla, emite rffm.show_snackbar con severity error y no despacha MOVE_SCENARIO_LOCATION", async () => {
      vi.mocked(gameModelService.moveScenarioToPrinciple).mockRejectedValue(new Error("network error"));
      const listener = vi.fn();
      window.addEventListener("rffm.show_snackbar", listener);

      renderWithDraft([
        buildPrinciple(1, 1, [buildScenario(1, 1, 0, "scenario-api-1")], "principle-api-1"),
        buildPrinciple(2, 2, [], "principle-api-2"),
      ]);
      await userEvent.click(screen.getByText("Principio nombre 1"));

      const moveButton = screen.getByRole("button", { name: "Mover escenario" });
      await userEvent.click(moveButton);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as CustomEvent<{ message: string; severity: string }>;
      expect(event.detail.severity).toBe("error");
      expect(screen.getByDisplayValue("Escenario nombre 1")).toBeInTheDocument();

      window.removeEventListener("rffm.show_snackbar", listener);
    });
  });
});
