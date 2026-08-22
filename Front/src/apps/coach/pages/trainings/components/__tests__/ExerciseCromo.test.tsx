import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExerciseCromo from "../ExerciseCromo";
import type { Exercise } from "../../../../types/training";

function buildExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Ejercicio de prueba",
    tipo: "Situacional",
    objetivo: "Objetivo",
    modelRelations: [],
    nivelesColumnas: ["Palanca 1"],
    niveles: [
      { nivel: 1, valores: {} },
      { nivel: 2, valores: {} },
    ],
    logistica: "10 min",
    descripcion: "Desc",
    isAssociatedToGameModel: false,
    ...overrides,
  };
}

describe("ExerciseCromo", () => {
  it("muestra un badge con el Tipo del ejercicio", () => {
    render(
      <ExerciseCromo
        exercise={buildExercise({ tipo: "Global" })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("muestra el chip 'Asociado al modelo' cuando isAssociatedToGameModel es true", () => {
    render(
      <ExerciseCromo
        exercise={buildExercise({ isAssociatedToGameModel: true })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText(/asociado al modelo/i)).toBeInTheDocument();
  });

  it("no muestra el chip 'Asociado al modelo' cuando isAssociatedToGameModel es false", () => {
    render(
      <ExerciseCromo
        exercise={buildExercise({ isAssociatedToGameModel: false })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByText(/asociado al modelo/i)).not.toBeInTheDocument();
  });

  it("renderiza un chip por cada relación con el modelo (Subprincipio) y por cada item (SubSubPrincipio)", () => {
    render(
      <ExerciseCromo
        exercise={buildExercise({
          isAssociatedToGameModel: true,
          modelRelations: [
            {
              id: "rel-1",
              subprincipioId: "sub-1",
              subprincipioNumero: "1.1",
              subprincipioTitulo: "Presión alta",
              isFoco: true,
              habilidadesImprescindibles: ["Pase"],
              items: [
                { id: "item-1", subSubPrincipioId: "ssp-1", subSubPrincipioNumero: "1.1.1", subSubPrincipioRol: "Central", isFoco: false },
              ],
            },
          ],
        })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText(/1\.1.*Presión alta/)).toBeInTheDocument();
    expect(screen.getByText(/1\.1\.1.*Central/)).toBeInTheDocument();
    expect(screen.getByText("Pase")).toBeInTheDocument();
  });

  it("muestra la duración cuando durationMinutes está establecido", () => {
    render(
      <ExerciseCromo
        exercise={buildExercise({ durationMinutes: 15 })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("no renderiza ninguna fila de chips de modelo cuando modelRelations está vacío", () => {
    const { container } = render(
      <ExerciseCromo
        exercise={buildExercise({ modelRelations: [] })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(container.querySelector('[data-testid="model-chips-row"]')).not.toBeInTheDocument();
  });
});
