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
      tacticalPrinciples: [],
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
});
