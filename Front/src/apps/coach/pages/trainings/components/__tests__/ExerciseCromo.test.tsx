import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExerciseCromo from "../ExerciseCromo";
import type { Exercise } from "../../../../types/training";

function buildExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Ejercicio de prueba",
    description: "",
    types: ["Tactical"],
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

describe("ExerciseCromo", () => {
  it("renderiza un chip/badge por cada tipo asignado al ejercicio", () => {
    render(
      <ExerciseCromo
        exercise={buildExercise({ types: ["Physical", "Cognitive"] })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Físico")).toBeInTheDocument();
    expect(screen.getByText("Cognitivo")).toBeInTheDocument();
  });

  it("usa el primer tipo como tipo primario para el color de borde de la tarjeta", () => {
    const { container } = render(
      <ExerciseCromo
        exercise={buildExercise({ types: ["Game", "Psychological"] })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(container.querySelector('[class*="type_Game"]')).toBeInTheDocument();
  });
});
