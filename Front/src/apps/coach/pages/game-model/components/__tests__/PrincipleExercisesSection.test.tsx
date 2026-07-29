import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PrincipleExercisesSection from "../PrincipleExercisesSection";
import type { Exercise } from "../../../../types/training";
import trainingService from "../../../../services/trainingService";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../../../services/trainingService", () => ({
  default: { getExercises: vi.fn(), deleteExercise: vi.fn() },
}));

function buildExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1", name: "Ejercicio de prueba", description: "", types: ["Tactical"],
    section: "Principal", methodology: "Analitico", durationTotal: 10, playersNumber: 6, goalPeekersNumber: 0,
    fieldSpace: "", skills: [], conditions: [], ...overrides,
  };
}

describe("PrincipleExercisesSection", () => {
  beforeEach(() => {
    vi.mocked(trainingService.getExercises).mockReset();
    mockNavigate.mockReset();
  });

  it("carga ejercicios filtrando por subSubPrincipleId cuando levelKind es subSubPrinciple", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([buildExercise()]);

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subSubPrinciple"
          levelApiId="ssp-1" levelName="Sub-subprincipio X" contextLabel="Sub-subprincipio 1" active
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(trainingService.getExercises).toHaveBeenCalledWith(
      "club-1", { subSubPrincipleId: "ssp-1" }
    ));
    expect(await screen.findByText("Ejercicio de prueba")).toBeInTheDocument();
  });

  it("carga ejercicios filtrando por subPrincipleId cuando levelKind es subPrinciple", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([buildExercise()]);

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" contextLabel="Subprincipio A" active
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(trainingService.getExercises).toHaveBeenCalledWith(
      "club-1", { subPrincipleId: "sp-1" }
    ));
  });

  it("recarga los ejercicios cuando cambia el escenario sin desmontar el componente", async () => {
    vi.mocked(trainingService.getExercises)
      .mockResolvedValueOnce([buildExercise({ id: "ex-scenario-1", name: "Ejercicio del escenario 1" })])
      .mockResolvedValueOnce([buildExercise({ id: "ex-scenario-2", name: "Ejercicio del escenario 2" })]);

    const renderSection = (
      props: Partial<ComponentProps<typeof PrincipleExercisesSection>> = {}
    ) => (
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="scenario"
          levelApiId="scenario-1" levelName="Escenario 1" contextLabel="Escenario 1" active
          {...props}
        />
      </MemoryRouter>
    );

    const { rerender } = render(renderSection());

    expect(await screen.findByText("Ejercicio del escenario 1")).toBeInTheDocument();

    // Simula el comportamiento real: DrillDownPanel reutiliza la misma instancia
    // de PrincipleExercisesSection al cambiar de escenario (no la desmonta), solo
    // le pasa un levelApiId nuevo.
    rerender(renderSection({ levelApiId: "scenario-2", levelName: "Escenario 2", contextLabel: "Escenario 2" }));

    await waitFor(() => expect(trainingService.getExercises).toHaveBeenCalledWith(
      "club-1", { scenarioId: "scenario-2" }
    ));
    expect(await screen.findByText("Ejercicio del escenario 2")).toBeInTheDocument();
    expect(screen.queryByText("Ejercicio del escenario 1")).not.toBeInTheDocument();
  });

  it("no carga ejercicios cuando active es false", () => {
    render(
      <MemoryRouter>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" contextLabel="Subprincipio A" active={false}
        />
      </MemoryRouter>
    );
    expect(trainingService.getExercises).not.toHaveBeenCalled();
  });

  it("reporta el conteo de ejercicios cargados via onCountChange", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([buildExercise(), buildExercise({ id: "ex-2" })]);
    const onCountChange = vi.fn();

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" contextLabel="Subprincipio A" active onCountChange={onCountChange}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(2));
  });

  it("renderiza un chip por cada tipo asignado al ejercicio", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([
      buildExercise({ types: ["Physical", "Cognitive"] }),
    ]);

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subSubPrinciple"
          levelApiId="ssp-1" levelName="Sub-subprincipio X" contextLabel="Sub-subprincipio 1" active
        />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Físico")).length).toBeGreaterThan(0);
    expect(screen.getByText("Cognitivo")).toBeInTheDocument();
  });

  it("renderiza un chip con la metodología del ejercicio", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([
      buildExercise({ methodology: "Integrado" }),
    ]);

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subSubPrinciple"
          levelApiId="ssp-1" levelName="Sub-subprincipio X" contextLabel="Sub-subprincipio 1" active
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("Integrado")).toBeInTheDocument();
  });

  it("coloca el tag de metodologia en la cabecera de la tarjeta, sobre la media", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([
      buildExercise({ methodology: "Global" }),
    ]);

    const { container } = render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subSubPrinciple"
          levelApiId="ssp-1" levelName="Sub-subprincipio X" contextLabel="Sub-subprincipio 1" active
        />
      </MemoryRouter>
    );

    await screen.findByText("Global");
    const media = container.querySelector('[class*="exCardMedia"]');
    expect(media).not.toBeNull();
    expect(media?.querySelector('[data-testid="ex-methodology-badge"]')).toBeInTheDocument();
  });

  it("representa la seccion como una franja lateral de color con el nombre en vertical", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([
      buildExercise({ section: "Calentamiento" }),
    ]);

    const { container } = render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subSubPrinciple"
          levelApiId="ssp-1" levelName="Sub-subprincipio X" contextLabel="Sub-subprincipio 1" active
        />
      </MemoryRouter>
    );

    await screen.findByText("Ejercicio de prueba");
    const strip = container.querySelector('[data-testid="ex-section-strip"]');
    expect(strip).toBeInTheDocument();
    expect(strip).toHaveAttribute("title", "Calentamiento");
    expect(strip?.textContent).toBe("Calentamiento");
  });

  it("el botón Añadir ejercicio navega con subPrincipleId cuando levelKind es subPrinciple", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" contextLabel="Subprincipio A" active
        />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByText("Añadir ejercicio"));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("subPrincipleId=sp-1"),
      expect.anything()
    );
  });

  it("muestra el nombre del nivel en la cabecera para distinguir cajas en la misma pantalla", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" contextLabel="Subprincipio A" active
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("Ejercicios de entrenamiento de Subprincipio A")).toBeInTheDocument();
  });
});
