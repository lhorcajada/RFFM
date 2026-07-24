import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SubSubPrincipleCard from "../SubSubPrincipleCard";
import styles from "../SubSubPrincipleCard.module.css";
import type { SubSubPrinciple } from "../../../../types/gameModel";
import type { Exercise } from "../../../../types/training";
import trainingService from "../../../../services/trainingService";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

  describe("editar ejercicio", () => {
    beforeEach(() => {
      vi.mocked(trainingService.getExercises).mockReset();
      mockNavigate.mockReset();
    });

    it("navega al formulario completo con el exerciseId al pulsar Editar, en lugar de abrir un diálogo", async () => {
      vi.mocked(trainingService.getExercises).mockResolvedValue([
        buildExercise({ id: "ex-42", urlImage: null, boardStateJson: null }),
      ]);

      render(
        <MemoryRouter initialEntries={["/coach/game-model?clubId=club-1&teamId=team-9"]}>
          <SubSubPrincipleCard index={1} subSubPrinciple={ssp} clubId="club-1" />
        </MemoryRouter>
      );

      await userEvent.click(screen.getByText(/Sub-subprincipio de prueba/));

      const editBtn = await waitFor(() => screen.getByRole("button", { name: "Editar" }));
      await userEvent.click(editBtn);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      const [url, options] = mockNavigate.mock.calls[0];
      const search = new URLSearchParams(url.split("?")[1]);
      expect(url.startsWith("/coach/trainings/new-exercise?")).toBe(true);
      expect(search.get("clubId")).toBe("club-1");
      expect(search.get("teamId")).toBe("team-9");
      expect(search.get("subSubPrincipleId")).toBe("ssp-1");
      expect(search.get("sspName")).toBe("Sub-subprincipio de prueba");
      expect(search.get("exerciseId")).toBe("ex-42");
      expect(options).toMatchObject({
        state: { returnTo: "/coach/game-model?clubId=club-1&teamId=team-9" },
      });
    });
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
