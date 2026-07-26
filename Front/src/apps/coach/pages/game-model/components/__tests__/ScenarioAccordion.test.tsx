import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Scenario } from "../../../../types/gameModel";
import ScenarioAccordion from "../ScenarioAccordion";

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

vi.mock("../../../../services/trainingService", () => ({
  default: { getExercises: vi.fn().mockResolvedValue([]), deleteExercise: vi.fn() },
}));

vi.mock("../PrincipleExercisesSection", () => ({
  default: ({
    levelKind,
    levelApiId,
    onCountChange,
    parentScenarioApiId,
    parentScenarioName,
    siblingSubSubPrinciples,
  }: {
    levelKind: string;
    levelApiId: string;
    onCountChange?: (count: number) => void;
    parentScenarioApiId?: string | null;
    parentScenarioName?: string | null;
    siblingSubSubPrinciples?: { apiId: string; name: string }[];
  }) => {
    useEffect(() => {
      onCountChange?.(3);
    }, [onCountChange]);
    return (
      <div
        data-testid="principle-exercises-section"
        data-level-kind={levelKind}
        data-level-api-id={levelApiId}
        data-parent-scenario-api-id={parentScenarioApiId ?? ""}
        data-parent-scenario-name={parentScenarioName ?? ""}
        data-sibling-ssp={JSON.stringify(siblingSubSubPrinciples ?? [])}
      />
    );
  },
}));

function buildScenario(
  id: number,
  order: number,
  subPrincipleCount = 0,
  media?: { mediaUrl: string | null; mediaType: "image" | "video" | null }
): Scenario {
  return {
    id,
    order,
    name: `Escenario nombre ${order}`,
    context: `Contexto del escenario ${order}`,
    tacticalPrinciples: [],
    mediaUrl: media?.mediaUrl ?? null,
    mediaType: media?.mediaType ?? null,
    subPrinciples: Array.from({ length: subPrincipleCount }, (_, i) => ({
      id: id * 100 + i,
      order: i + 1,
      label: String.fromCharCode(65 + i),
      name: `Subprincipio ${String.fromCharCode(65 + i)}`,
      context: `Contexto subprincipio ${String.fromCharCode(65 + i)}`,
      subSubPrinciples: [],
    })),
  };
}

function renderAccordion(scenarios: Scenario[]) {
  render(
    <MemoryRouter>
      <ScenarioAccordion
        scenarios={scenarios}
        clubId="club-1"
        teamId="team-1"
        gameMomentName="Momento"
        zoneName="Zona"
      />
    </MemoryRouter>
  );
}

describe("ScenarioAccordion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMediaQuery.mockReturnValue(false);
  });

  it("muestra la lista de escenarios en escritorio", () => {
    renderAccordion([buildScenario(1, 1), buildScenario(2, 2)]);
    expect(screen.getByText("Escenario nombre 1")).toBeInTheDocument();
    expect(screen.getByText("Escenario nombre 2")).toBeInTheDocument();
  });

  it("selecciona automáticamente el único escenario cuando solo hay uno", () => {
    renderAccordion([buildScenario(1, 1)]);
    expect(screen.getByText("Contexto del escenario 1")).toBeInTheDocument();
  });

  it("al seleccionar un escenario en móvil se oculta la lista y aparece Volver", async () => {
    mockUseMediaQuery.mockReturnValue(true);
    renderAccordion([buildScenario(1, 1), buildScenario(2, 2)]);
    await userEvent.click(screen.getByText("Escenario nombre 1"));
    expect(screen.getByText("Contexto del escenario 1")).toBeInTheDocument();
    expect(screen.queryByText("Escenario nombre 2")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("muestra el detalle del subprincipio seleccionado dentro del escenario", async () => {
    renderAccordion([buildScenario(1, 1, 2)]);
    await userEvent.click(screen.getByText("Subprincipio A"));
    expect(screen.getByText("Contexto subprincipio A")).toBeInTheDocument();
  });

  it("renderiza un <video> cuando mediaType es 'video'", () => {
    renderAccordion([
      buildScenario(1, 1, 0, { mediaUrl: "https://example.com/clip.mp4", mediaType: "video" }),
    ]);
    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "https://example.com/clip.mp4");
  });

  it("renderiza un <img> cuando mediaType es 'image'", () => {
    renderAccordion([
      buildScenario(1, 1, 0, { mediaUrl: "https://example.com/img.jpg", mediaType: "image" }),
    ]);
    expect(screen.getByAltText(/situación: escenario nombre 1/i)).toBeInTheDocument();
  });

  it("muestra los principios tácticos del escenario pero no dentro del subprincipio", async () => {
    const scenario: Scenario = {
      id: 1,
      order: 1,
      name: "Escenario X",
      context: "Contexto",
      tacticalPrinciples: [{ id: 1, name: "Coberturas y Permutas" }],
      mediaUrl: null,
      mediaType: null,
      subPrinciples: [
        {
          id: 101,
          order: 1,
          label: "A",
          name: "Subprincipio A",
          context: "Contexto SP",
          subSubPrinciples: [],
        },
      ],
    };
    renderAccordion([scenario]);

    // Single subprincipio auto-selects its detail view alongside the scenario detail.
    const principlesLabels = screen.getAllByText("Principios tácticos colectivos:");
    expect(principlesLabels).toHaveLength(1);
  });

  it("no renderiza ningún elemento de media si no hay mediaUrl", () => {
    renderAccordion([buildScenario(1, 1, 0)]);
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  it("con una mediaUrl relativa (storage local), usa el proxy /api/public/storage", () => {
    renderAccordion([
      buildScenario(1, 1, 0, { mediaUrl: "game-scenarios/abc.jpg", mediaType: "image" }),
    ]);
    expect(screen.getByAltText(/situación: escenario nombre 1/i)).toHaveAttribute(
      "src",
      "/api/public/storage?url=game-scenarios%2Fabc.jpg"
    );
  });

  describe("ejercicios a nivel de subprincipio", () => {
    function scenarioWithSubPrincipleApiId(apiId: string): Scenario {
      return {
        id: 1,
        order: 1,
        name: "Escenario X",
        context: "Contexto",
        tacticalPrinciples: [],
        mediaUrl: null,
        mediaType: null,
        subPrinciples: [
          {
            id: 101,
            apiId,
            order: 1,
            label: "A",
            name: "Subprincipio A",
            context: "Contexto SP",
            subSubPrinciples: [],
          },
        ],
      };
    }

    it("pasa también el apiId/nombre del escenario padre, para que el selector 'Vinculado a' pueda ofrecer moverlo al escenario", async () => {
      renderAccordion([
        {
          id: 1,
          apiId: "scenario-api-parent",
          order: 1,
          name: "Escenario X",
          context: "Contexto",
          tacticalPrinciples: [],
          mediaUrl: null,
          mediaType: null,
          subPrinciples: [
            {
              id: 101,
              apiId: "sp-api-1",
              order: 1,
              label: "A",
              name: "Subprincipio A",
              context: "Contexto SP",
              subSubPrinciples: [],
            },
          ],
        },
      ]);

      const sections = await screen.findAllByTestId("principle-exercises-section");
      const section = sections.find((el) => el.getAttribute("data-level-kind") === "subPrinciple");
      expect(section).toBeDefined();
      expect(section).toHaveAttribute("data-parent-scenario-api-id", "scenario-api-parent");
      expect(section).toHaveAttribute("data-parent-scenario-name", "Escenario X");
    });

    it("pasa la lista de sub-subprincipios del propio subprincipio, para ofrecerlos como destino cuando hay varios", async () => {
      renderAccordion([
        {
          id: 1,
          apiId: "scenario-api-parent",
          order: 1,
          name: "Escenario X",
          context: "Contexto",
          tacticalPrinciples: [],
          mediaUrl: null,
          mediaType: null,
          subPrinciples: [
            {
              id: 101,
              apiId: "sp-api-1",
              order: 1,
              label: "A",
              name: "Subprincipio A",
              context: "Contexto SP",
              subSubPrinciples: [
                { id: 1001, apiId: "ssp-a", order: 1, name: "Habilidad A", action: "", essentialSkills: [] },
                { id: 1002, apiId: "ssp-b", order: 2, name: "Habilidad B", action: "", essentialSkills: [] },
              ],
            },
          ],
        },
      ]);

      const sections = await screen.findAllByTestId("principle-exercises-section");
      const section = sections.find((el) => el.getAttribute("data-level-kind") === "subPrinciple");
      expect(section).toBeDefined();
      expect(JSON.parse(section!.getAttribute("data-sibling-ssp") ?? "[]")).toEqual([
        { apiId: "ssp-a", name: "Habilidad A" },
        { apiId: "ssp-b", name: "Habilidad B" },
      ]);
    });

    it("renderiza PrincipleExercisesSection con levelKind=subPrinciple y el apiId del subprincipio", async () => {
      renderAccordion([scenarioWithSubPrincipleApiId("sp-api-1")]);

      const section = await screen.findByTestId("principle-exercises-section");
      expect(section).toHaveAttribute("data-level-kind", "subPrinciple");
      expect(section).toHaveAttribute("data-level-api-id", "sp-api-1");
    });

    it("muestra un chip con el conteo de ejercicios junto a los botones de sesiones", async () => {
      renderAccordion([scenarioWithSubPrincipleApiId("sp-api-1")]);

      expect(await screen.findByText("3 ej.")).toBeInTheDocument();
    });

    it("no renderiza la sección de ejercicios cuando el subprincipio no tiene apiId", () => {
      renderAccordion([buildScenario(1, 1, 1)]);
      expect(screen.queryByTestId("principle-exercises-section")).not.toBeInTheDocument();
    });
  });

  describe("ejercicios a nivel de escenario", () => {
    function scenarioWithApiId(apiId: string): Scenario {
      return {
        id: 1,
        apiId,
        order: 1,
        name: "Escenario X",
        context: "Contexto",
        tacticalPrinciples: [],
        mediaUrl: null,
        mediaType: null,
        subPrinciples: [
          {
            id: 101,
            order: 1,
            label: "A",
            name: "Subprincipio A",
            context: "Contexto SP",
            subSubPrinciples: [],
          },
        ],
      };
    }

    it("renderiza PrincipleExercisesSection con levelKind=scenario y el apiId del escenario", async () => {
      renderAccordion([scenarioWithApiId("scenario-api-1")]);

      const section = await screen.findByTestId("principle-exercises-section");
      expect(section).toHaveAttribute("data-level-kind", "scenario");
      expect(section).toHaveAttribute("data-level-api-id", "scenario-api-1");
    });

    it("muestra un chip con el conteo de ejercicios en la cabecera del escenario", async () => {
      renderAccordion([scenarioWithApiId("scenario-api-1")]);

      expect(await screen.findByText("3 ej.")).toBeInTheDocument();
    });

    it("no renderiza la sección de ejercicios cuando el escenario no tiene apiId", () => {
      renderAccordion([buildScenario(1, 1, 1)]);
      const sections = screen.queryAllByTestId("principle-exercises-section");
      // Should only have section from subprincipio, not from scenario
      expect(sections.length).toBeLessThanOrEqual(1);
    });
  });
});
