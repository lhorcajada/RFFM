import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SessionBlockExercise } from "../../../../../types/training";
import { exercise } from "../../../__tests__/exerciseFixtures";

vi.mock("../../../../../components/TacticalBoardSnapshotPreview", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../components/TacticalBoardSnapshotPreview")>()),
  default: ({ teamId }: { teamId?: string }) => <div>{`pizarra:${teamId}`}</div>,
}));

import SessionExerciseCard from "../SessionExerciseCard";

const BLOCK_EXERCISE: SessionBlockExercise = {
  id: "e-1",
  exerciseId: "ex-1",
  position: 1,
  name: "Rondo 4x4+3",
  objetivo: "Circular con paciencia",
  durationMinutes: 15,
};

const BOARD_JSON = JSON.stringify({ placedChapas: { a: { x: 1, y: 1 } } });

describe("SessionExerciseCard", () => {
  it("muestra la imagen, el nombre, el tipo, la duración y el objetivo", () => {
    render(
      <SessionExerciseCard blockExercise={BLOCK_EXERCISE} exercise={exercise({ urlImage: "img/rondo.png" })} teamId="team-1" />,
    );

    expect(screen.getByRole("img", { name: "Rondo 4x4+3" })).toBeInTheDocument();
    expect(screen.getByText("Rondo 4x4+3")).toBeInTheDocument();
    expect(screen.getByText("Situacional")).toBeInTheDocument();
    expect(screen.getByText("15'")).toBeInTheDocument();
    expect(screen.getByText("Circular con paciencia")).toBeInTheDocument();
  });

  it("sin imagen muestra el dibujo de la pizarra táctica", () => {
    render(
      <SessionExerciseCard blockExercise={BLOCK_EXERCISE} exercise={exercise({ boardStateJson: BOARD_JSON })} teamId="team-1" />,
    );

    expect(screen.getByText("pizarra:team-1")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("Ver detalle despliega descripción, logística, niveles en lista y relación con el modelo", async () => {
    render(<SessionExerciseCard blockExercise={BLOCK_EXERCISE} exercise={exercise()} teamId="team-1" />);
    expect(screen.queryByText("Mantener la posesión hasta encontrar el hombre libre.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ver detalle" }));

    expect(screen.getByText("Mantener la posesión hasta encontrar el hombre libre.")).toBeInTheDocument();
    expect(screen.getByText("Conos y petos")).toBeInTheDocument();
    const niveles = screen.getByRole("list", { name: "Niveles" });
    const items = within(niveles).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Nivel 1Espacio: 30x30 · Toques: Libre",
      "Nivel 2Espacio: 20x20 · Toques: 2",
    ]);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const relacion = screen.getByRole("region", { name: "Relación con el modelo" });
    expect(within(relacion).getByText("2.3 · Circular para desordenar")).toBeInTheDocument();
    expect(within(relacion).getByText("2.3.1 · Extremo")).toBeInTheDocument();
    expect(within(relacion).getByText("Pase")).toBeInTheDocument();
    expect(within(relacion).getByText("Percepción")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar detalle" })).toHaveAttribute("aria-expanded", "true");
  });

  it("sin los datos completos del ejercicio muestra lo básico y no ofrece detalle", () => {
    render(<SessionExerciseCard blockExercise={BLOCK_EXERCISE} exercise={undefined} teamId="team-1" />);

    expect(screen.getByText("Rondo 4x4+3")).toBeInTheDocument();
    expect(screen.getByText("Circular con paciencia")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver detalle" })).not.toBeInTheDocument();
  });
});
