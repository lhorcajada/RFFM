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
    methodology: "Integrado",
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

  it("muestra un pill con la metodologia del ejercicio", () => {
    render(
      <ExerciseCromo
        exercise={buildExercise({ methodology: "Global" })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("coloca el tag de metodologia en la cabecera de la tarjeta, sobre la foto", () => {
    const { container } = render(
      <ExerciseCromo
        exercise={buildExercise({ methodology: "Analitico" })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const photoArea = container.querySelector('[class*="photoArea"]');
    expect(photoArea).not.toBeNull();
    expect(photoArea?.querySelector('[data-testid="methodology-badge"]')).toBeInTheDocument();
  });

  it("representa la seccion como una franja lateral de color con el nombre en vertical", () => {
    const { container } = render(
      <ExerciseCromo
        exercise={buildExercise({ section: "Calentamiento" })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const strip = container.querySelector('[data-testid="section-strip"]');
    expect(strip).toBeInTheDocument();
    expect(strip).toHaveAttribute("title", "Calentamiento");
    expect(strip?.textContent).toBe("Calentamiento");
  });

  it("agrupa los tags de tipo y sub-principio debajo del titulo, no sobre la foto", () => {
    const { container } = render(
      <ExerciseCromo
        exercise={buildExercise({
          types: ["Physical", "Cognitive"],
          subSubPrincipleName: "Superioridad posicional",
        })}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onPrint={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const photoArea = container.querySelector('[class*="photoArea"]');
    const tagsRow = container.querySelector('[data-testid="tags-row"]');
    expect(tagsRow).toBeInTheDocument();
    expect(photoArea?.contains(tagsRow)).toBe(false);
    expect(tagsRow?.textContent).toContain("Físico");
    expect(tagsRow?.textContent).toContain("Cognitivo");
    expect(tagsRow?.textContent).toContain("Superioridad posicional");
  });
});
