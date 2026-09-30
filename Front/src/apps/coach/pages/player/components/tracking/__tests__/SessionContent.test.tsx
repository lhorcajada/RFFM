import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SessionContent from "../SessionContent";
import type { TrainingSessionDetail } from "../../../../../types/training";

const DETAIL: TrainingSessionDetail = {
  id: "ses-1",
  name: "Sesión 1",
  description: "",
  date: "2026-10-14T00:00:00",
  startTime: null,
  isAssociatedToPlan: false,
  targets: [],
  objetivoGeneral: "Mover al rival hasta descolocarlo",
  blocks: [
    {
      id: "b-2",
      order: 2,
      nombre: "Parte final",
      exercises: [{ id: "e-3", exerciseId: "ex-3", position: 1, exerciseName: "Partido condicionado" }],
    },
    {
      id: "b-1",
      order: 1,
      nombre: "Parte principal",
      exercises: [
        { id: "e-2", exerciseId: "ex-2", position: 2, exerciseName: "Transiciones 6x6", exerciseObjetivo: "Asegurar tras robo" },
        {
          id: "e-1",
          exerciseId: "ex-1",
          position: 1,
          exerciseName: "Rondo 4x4+3",
          exerciseObjetivo: "Circular con paciencia",
          exerciseDurationMinutes: 15,
        },
      ],
    },
  ],
};

describe("SessionContent", () => {
  it("muestra el objetivo general y los ejercicios a la vista, por bloque y en orden", () => {
    render(<SessionContent detail={DETAIL} loading={false} />);

    expect(screen.getByText("Mover al rival hasta descolocarlo")).toBeVisible();
    const blocks = screen.getAllByRole("heading", { level: 5 }).map((h) => h.textContent);
    expect(blocks).toEqual(["Parte principal", "Parte final"]);
    const exercises = screen.getAllByRole("listitem").map((item) => item.getAttribute("aria-label"));
    expect(exercises).toEqual(["Rondo 4x4+3", "Transiciones 6x6", "Partido condicionado"]);
    expect(screen.getByText("Circular con paciencia · 15'")).toBeVisible();
    expect(screen.getByText("Asegurar tras robo")).toBeVisible();
  });

  it("avisa si la sesión no tiene ejercicios", () => {
    render(<SessionContent detail={{ ...DETAIL, blocks: [] }} loading={false} />);

    expect(screen.getByText("La sesión no tiene ejercicios registrados")).toBeInTheDocument();
  });

  it("muestra un indicador mientras carga", () => {
    render(<SessionContent detail={null} loading />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
