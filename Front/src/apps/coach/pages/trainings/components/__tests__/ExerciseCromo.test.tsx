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
    nivelesColumnas: ["Palanca 1"],
    niveles: [
      { nivel: 1, valores: {} },
      { nivel: 2, valores: {} },
    ],
    logistica: "10 min",
    descripcion: "Desc",
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

  it("muestra el subtipo del ejercicio traducido cuando lo tiene", () => {
    render(
      <ExerciseCromo
        exercise={buildExercise({ subtipo: "TransicionAtaqueDefensa" })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Transición ataque-defensa")).toBeInTheDocument();
  });

  it("no muestra subtipo cuando el ejercicio no lo tiene", () => {
    render(
      <ExerciseCromo
        exercise={buildExercise({ subtipo: null })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByTestId("subtipo-chip")).not.toBeInTheDocument();
  });

  it("no muestra nada del modelo de juego aunque el ejercicio llegue con relaciones guardadas", () => {
    const legacyExercise = {
      ...buildExercise(),
      isAssociatedToGameModel: true,
      modelRelations: [{ id: "rel-1", subprincipioNumero: "1.1", subprincipioTitulo: "Presión alta", isFoco: true, items: [] }],
    };

    const { container } = render(
      <ExerciseCromo
        exercise={legacyExercise}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByText(/asociado al modelo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Presión alta/)).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="model-chips-row"]')).not.toBeInTheDocument();
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
});
