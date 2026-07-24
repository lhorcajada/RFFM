import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SubSubPrincipleCard from "../SubSubPrincipleCard";
import styles from "../SubSubPrincipleCard.module.css";
import type { SubSubPrinciple } from "../../../../types/gameModel";
import type { Exercise } from "../../../../types/training";
import trainingService from "../../../../services/trainingService";

vi.mock("../../../../services/trainingService", () => ({
  default: { getExercises: vi.fn(), deleteExercise: vi.fn() },
}));

const ssp: SubSubPrinciple = {
  id: 1,
  apiId: "ssp-1",
  order: 1,
  name: "Sub-subprincipio de prueba",
  action: "Acción de prueba",
  essentialSkills: [],
};

function buildExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Ejercicio de prueba",
    description: "",
    type: "Tactical",
    section: "Principal",
    durationTotal: 10,
    playersNumber: 6,
    goalPeekersNumber: 0,
    fieldSpace: "",
    skills: [],
    conditions: [],
    ...overrides,
  };
}

describe("SubSubPrincipleCard", () => {
  it("el botón de expandir lleva la clase de touch-target", () => {
    render(
      <MemoryRouter>
        <SubSubPrincipleCard index={1} subSubPrinciple={ssp} clubId="" />
      </MemoryRouter>
    );
    const expandBtn = screen.getByRole("button");
    expect(expandBtn.className).toContain(styles.expandBtn);
  });

  it("el título aplica la clase con ajuste de línea para textos largos", () => {
    render(
      <MemoryRouter>
        <SubSubPrincipleCard index={1} subSubPrinciple={ssp} clubId="" />
      </MemoryRouter>
    );
    expect(screen.getByText(/Sub-subprincipio de prueba/)).toHaveClass(styles.title);
  });

  describe("media del ejercicio sin urlImage", () => {
    beforeEach(() => {
      vi.mocked(trainingService.getExercises).mockReset();
    });

    it("muestra el dibujo de la pizarra (aunque esté vacío) en lugar de las iniciales cuando hay boardStateJson", async () => {
      const emptySnapshot = {
        placedChapas: {},
        chapaPetoById: {},
        placedSpaces: [],
        placedMaterials: [],
        placedLines: [],
      };
      vi.mocked(trainingService.getExercises).mockResolvedValue([
        buildExercise({ urlImage: null, boardStateJson: JSON.stringify(emptySnapshot) }),
      ]);

      render(
        <MemoryRouter>
          <SubSubPrincipleCard index={1} subSubPrinciple={ssp} clubId="club-1" />
        </MemoryRouter>
      );

      await userEvent.click(screen.getByText(/Sub-subprincipio de prueba/));

      await waitFor(() => {
        expect(screen.getByLabelText("Vista previa de la pizarra")).toBeInTheDocument();
      });
      expect(screen.queryByText("EJ")).not.toBeInTheDocument();
    });

    it("muestra las iniciales de fallback cuando no hay ni urlImage ni boardStateJson", async () => {
      vi.mocked(trainingService.getExercises).mockResolvedValue([
        buildExercise({ urlImage: null, boardStateJson: null, name: "Ejercicio sin media" }),
      ]);

      render(
        <MemoryRouter>
          <SubSubPrincipleCard index={1} subSubPrinciple={ssp} clubId="club-1" />
        </MemoryRouter>
      );

      await userEvent.click(screen.getByText(/Sub-subprincipio de prueba/));

      await waitFor(() => {
        expect(screen.getByText("EJ")).toBeInTheDocument();
      });
      expect(screen.queryByLabelText("Vista previa de la pizarra")).not.toBeInTheDocument();
    });

    it("no despliega ninguna vista ampliada al hacer clic sobre el dibujo de la pizarra", async () => {
      const snapshotWithChapa = {
        placedChapas: { a: { x: 10, y: 10 } },
        chapaPetoById: {},
        placedSpaces: [],
        placedMaterials: [],
        placedLines: [],
      };
      vi.mocked(trainingService.getExercises).mockResolvedValue([
        buildExercise({ urlImage: null, boardStateJson: JSON.stringify(snapshotWithChapa) }),
      ]);

      render(
        <MemoryRouter>
          <SubSubPrincipleCard index={1} subSubPrinciple={ssp} clubId="club-1" />
        </MemoryRouter>
      );

      await userEvent.click(screen.getByText(/Sub-subprincipio de prueba/));

      const preview = await waitFor(() => screen.getByLabelText("Vista previa de la pizarra"));
      fireEvent.click(preview);

      expect(screen.getAllByLabelText("Vista previa de la pizarra")).toHaveLength(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
