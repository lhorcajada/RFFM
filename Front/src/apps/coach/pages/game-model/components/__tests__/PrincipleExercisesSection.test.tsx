import { render, screen, waitFor } from "@testing-library/react";
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
    id: "ex-1", name: "Ejercicio de prueba", description: "", type: "Tactical",
    section: "Principal", durationTotal: 10, playersNumber: 6, goalPeekersNumber: 0,
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
          levelApiId="ssp-1" levelName="Sub-subprincipio X" active
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
          levelApiId="sp-1" levelName="Subprincipio X" active
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(trainingService.getExercises).toHaveBeenCalledWith(
      "club-1", { subPrincipleId: "sp-1" }
    ));
  });

  it("no carga ejercicios cuando active es false", () => {
    render(
      <MemoryRouter>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" active={false}
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
          levelApiId="sp-1" levelName="Subprincipio X" active onCountChange={onCountChange}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(2));
  });

  it("el botón Añadir ejercicio navega con subPrincipleId cuando levelKind es subPrinciple", async () => {
    vi.mocked(trainingService.getExercises).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
        <PrincipleExercisesSection
          clubId="club-1" teamId="team-9" levelKind="subPrinciple"
          levelApiId="sp-1" levelName="Subprincipio X" active
        />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByText("Añadir ejercicio"));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("subPrincipleId=sp-1"),
      expect.anything()
    );
  });
});
