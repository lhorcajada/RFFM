import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../services/trainingService", () => ({
  default: { getExercises: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../../../components/TacticalBoardSnapshotPreview", () => ({
  default: () => <div data-testid="board-preview" />,
  tryParseBoardSnapshot: (json?: string | null) => (json ? { parsed: true } : null),
  hasBoardObjects: () => true,
}));

import SessionBlockEditor from "../SessionBlockEditor";
import trainingService from "../../../../../services/trainingService";
import type { SessionBlockRequest } from "../../../../../types/training";

function renderEditor(blocks: SessionBlockRequest[]) {
  return render(
    <MemoryRouter>
      <SessionBlockEditor blocks={blocks} onChange={vi.fn()} clubId="club-1" teamId="team-1" />
    </MemoryRouter>
  );
}

describe("SessionBlockEditor — diseño de bloques", () => {
  beforeEach(() => vi.clearAllMocks());

  it("un bloque sin ejercicios muestra el aviso de bloque vacío", () => {
    renderEditor([{ order: 1, nombre: "Activación", rotacionEntreEjercicios: null, exercises: [] }]);

    expect(screen.getByText("Este bloque aún no tiene ejercicios.")).toBeInTheDocument();
  });

  it("un bloque con ejercicios no muestra el aviso de bloque vacío", () => {
    renderEditor([
      { order: 1, nombre: "Activación", rotacionEntreEjercicios: null, exercises: [{ exerciseId: "ex-1", position: 1 }] },
    ]);

    expect(screen.queryByText("Este bloque aún no tiene ejercicios.")).not.toBeInTheDocument();
  });

  it("cada bloque muestra su número de orden en una insignia", () => {
    renderEditor([
      { order: 1, nombre: "Activación", rotacionEntreEjercicios: null, exercises: [] },
      { order: 2, nombre: "Parte principal", rotacionEntreEjercicios: null, exercises: [] },
    ]);

    expect(screen.getByTestId("block-badge-2")).toHaveTextContent("2");
  });

  it("muestra el gráfico de la pizarra de un ejercicio sin imagen", async () => {
    (trainingService.getExercises as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "ex-1", name: "Rondo", tipo: "Situacional", objetivo: "", descripcion: "", logistica: "", urlImage: null, boardStateJson: "{}" },
    ]);
    renderEditor([
      { order: 1, nombre: "Activación", rotacionEntreEjercicios: null, exercises: [{ exerciseId: "ex-1", position: 1 }] },
    ]);

    expect(await screen.findByTestId("board-preview")).toBeInTheDocument();
  });

  it("muestra la imagen del ejercicio en lugar de la pizarra cuando tiene imagen", async () => {
    (trainingService.getExercises as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "ex-1", name: "Rondo", tipo: "Situacional", objetivo: "", descripcion: "", logistica: "", urlImage: "ex.png", boardStateJson: "{}" },
    ]);
    renderEditor([
      { order: 1, nombre: "Activación", rotacionEntreEjercicios: null, exercises: [{ exerciseId: "ex-1", position: 1 }] },
    ]);

    expect(await screen.findByAltText("Dibujo de Rondo")).toBeInTheDocument();
    expect(screen.queryByTestId("board-preview")).not.toBeInTheDocument();
  });
});
