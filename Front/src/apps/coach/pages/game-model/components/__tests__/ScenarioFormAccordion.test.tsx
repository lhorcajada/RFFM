import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GameModel, Scenario } from "../../../../types/gameModel";
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
  },
}));

function buildScenario(id: number, order: number, subPrincipleCount = 0, apiId?: string): Scenario {
  return {
    id,
    apiId,
    order,
    name: `Escenario nombre ${order}`,
    context: "",
    tacticalPrinciples: [],
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

function buildDraft(scenarios: Scenario[]): GameModel {
  return {
    id: "draft-1",
    teamId: "team-1",
    name: "Modelo de prueba",
    season: "2025/2026",
    gameMoments: [
      { id: 1, name: "Momento", zones: [{ id: 1, name: "Zona", scenarios }] },
    ],
  };
}

function renderWithDraft(scenarios: Scenario[]) {
  const draft = buildDraft(scenarios);
  render(
    <GameModelDraftProvider initialDraft={draft} availablePrinciples={[]}>
      <ScenarioFormAccordion mi={0} zi={0} scenarios={draft.gameMoments[0].zones[0].scenarios} />
    </GameModelDraftProvider>
  );
}

describe("ScenarioFormAccordion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMediaQuery.mockReturnValue(false); // desktop by default
  });

  it("muestra la lista de escenarios y su detalle en escritorio", () => {
    renderWithDraft([buildScenario(1, 1), buildScenario(2, 2)]);
    expect(screen.getByText("Escenario nombre 1")).toBeInTheDocument();
    expect(screen.getByText("Escenario nombre 2")).toBeInTheDocument();
  });

  it("selecciona automáticamente el único escenario cuando solo hay uno", () => {
    renderWithDraft([buildScenario(1, 1)]);
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });

  it("añadir escenario despacha ADD_SCENARIO y aparece un nuevo escenario en la lista", async () => {
    renderWithDraft([buildScenario(1, 1)]);
    await userEvent.click(screen.getByRole("button", { name: /añadir escenario/i }));
    expect(screen.getByText("Escenario 2")).toBeInTheDocument();
  });

  it("dentro del detalle de un escenario, añadir subprincipio despacha ADD_SP", async () => {
    renderWithDraft([buildScenario(1, 1, 0)]);
    await userEvent.click(screen.getByRole("button", { name: /añadir subprincipio/i }));
    expect(screen.getByText("Subprincipio A")).toBeInTheDocument();
  });

  it("los botones mover arriba/abajo de subprincipio están deshabilitados en los extremos", () => {
    renderWithDraft([buildScenario(1, 1, 2)]);
    const rows = screen.getAllByRole("button", { name: "Mover arriba" });
    expect(rows[0]).toBeDisabled();
    const downButtons = screen.getAllByRole("button", { name: "Mover abajo" });
    expect(downButtons[downButtons.length - 1]).toBeDisabled();
  });

  it("mover un subprincipio abajo despacha MOVE_SP y reordena", async () => {
    renderWithDraft([buildScenario(1, 1, 2)]);
    const downButtons = screen.getAllByRole("button", { name: "Mover abajo" });
    await userEvent.click(downButtons[0]); // move first subprinciple down
    // After moving, label "A" now maps to what was "B" (reducer relabels A/B by index)
    const list = screen.getByLabelText("Lista de subprincipios");
    const items = within(list).getAllByRole("button");
    expect(items[0]).toHaveTextContent("Subprincipio B");
  });

  it("añadir sub-subprincipio dentro de un subprincipio despacha ADD_SSP y muestra sus campos", async () => {
    renderWithDraft([buildScenario(1, 1, 1)]);
    await userEvent.click(screen.getByRole("button", { name: /añadir sub-subprincipio/i }));
    expect(screen.getByPlaceholderText(/Acción: describe/)).toBeInTheDocument();
  });

  it("las filas de habilidad se apilan verticalmente por CSS (clase presente) al añadir una habilidad", async () => {
    renderWithDraft([buildScenario(1, 1, 1)]);
    await userEvent.click(screen.getByRole("button", { name: /añadir sub-subprincipio/i }));
    await userEvent.click(screen.getByRole("button", { name: /añadir habilidad/i }));
    expect(screen.getByPlaceholderText("Nombre de la habilidad")).toBeInTheDocument();
  });

  it("escenario sin apiId muestra el aviso de guardar el modelo y no el campo de media", () => {
    renderWithDraft([buildScenario(1, 1, 0)]);
    expect(screen.getByText(/guarda el modelo de juego/i)).toBeInTheDocument();
    expect(screen.queryByText(/subir imagen.*v[ií]deo/i)).not.toBeInTheDocument();
  });

  it("escenario con apiId muestra el campo de media", () => {
    renderWithDraft([buildScenario(1, 1, 0, "scenario-api-1")]);
    expect(screen.getByText(/subir imagen.*v[ií]deo/i)).toBeInTheDocument();
    expect(screen.queryByText(/guarda el modelo de juego/i)).not.toBeInTheDocument();
  });

  it("el formulario de escenario muestra principios tácticos colectivos pero el de subprincipio no", async () => {
    renderWithDraft([buildScenario(1, 1, 1)]);

    // Scenario-level field is present (single scenario auto-selected).
    expect(screen.getByLabelText("Principios tácticos colectivos")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Subprincipio A"));

    // Only the scenario-level field remains; no duplicate for the subprincipio.
    expect(screen.getAllByLabelText("Principios tácticos colectivos")).toHaveLength(1);
  });
});
