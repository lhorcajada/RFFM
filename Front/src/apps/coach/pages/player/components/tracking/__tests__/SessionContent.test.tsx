import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../SessionExerciseCard", () => ({
  default: ({ blockExercise, exercise }: { blockExercise: { name?: string }; exercise?: { id: string } }) => (
    <div>{`tarjeta:${blockExercise.name}:${exercise ? "completo" : "basico"}`}</div>
  ),
}));

import SessionContent from "../SessionContent";
import { exercise } from "../../../__tests__/exerciseFixtures";
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
      exercises: [{ id: "e-3", exerciseId: "ex-3", position: 1, name: "Partido condicionado" }],
    },
    {
      id: "b-1",
      order: 1,
      nombre: "Parte principal",
      exercises: [
        { id: "e-2", exerciseId: "ex-2", position: 2, name: "Transiciones 6x6", objetivo: "Asegurar tras robo" },
        {
          id: "e-1",
          exerciseId: "ex-1",
          position: 1,
          name: "Rondo 4x4+3",
          objetivo: "Circular con paciencia",
          durationMinutes: 15,
        },
      ],
    },
  ],
};

describe("SessionContent", () => {
  it("muestra el objetivo general y una tarjeta por ejercicio, por bloque y en orden", () => {
    render(<SessionContent detail={DETAIL} loading={false} exercisesById={new Map([["ex-1", exercise({ id: "ex-1" })]])} teamId="team-1" />);

    expect(screen.getByText("Mover al rival hasta descolocarlo")).toBeVisible();
    const blocks = screen.getAllByRole("heading", { level: 5 }).map((h) => h.textContent);
    expect(blocks).toEqual(["Parte principal", "Parte final"]);
    const cards = screen.getAllByText(/^tarjeta:/).map((c) => c.textContent);
    expect(cards).toEqual(["tarjeta:Rondo 4x4+3:completo", "tarjeta:Transiciones 6x6:basico", "tarjeta:Partido condicionado:basico"]);
  });

  it("muestra la hora, el lugar y el evento de la sesión", () => {
    render(
      <SessionContent
        detail={{ ...DETAIL, startTime: "18:00:00", endTime: "19:30:00", location: "Campo 2", sportEventName: "Entrenamiento martes" }}
        loading={false}
        exercisesById={new Map()}
        teamId="team-1"
      />,
    );

    expect(screen.getByText("18:00 – 19:30 · Campo 2 · Entrenamiento martes")).toBeInTheDocument();
  });

  it("muestra la rotación entre ejercicios del bloque", () => {
    const detail = {
      ...DETAIL,
      blocks: DETAIL.blocks.map((b) => (b.order === 1 ? { ...b, rotacionEntreEjercicios: "Cambian cada 8 minutos" } : b)),
    };
    render(<SessionContent detail={detail} loading={false} exercisesById={new Map()} teamId="team-1" />);

    expect(screen.getByText("Rotación: Cambian cada 8 minutos")).toBeInTheDocument();
  });

  it("avisa si la sesión no tiene ejercicios", () => {
    render(<SessionContent detail={{ ...DETAIL, blocks: [] }} loading={false} exercisesById={new Map()} teamId="team-1" />);

    expect(screen.getByText("La sesión no tiene ejercicios registrados")).toBeInTheDocument();
  });

  it("muestra un indicador mientras carga", () => {
    render(<SessionContent detail={null} loading exercisesById={new Map()} teamId="team-1" />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
