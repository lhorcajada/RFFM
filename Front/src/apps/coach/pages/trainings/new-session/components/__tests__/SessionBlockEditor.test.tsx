import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../services/trainingService", () => ({
  default: { getExercises: vi.fn() },
}));

import SessionBlockEditor from "../SessionBlockEditor";
import trainingService from "../../../../../services/trainingService";
import type { Exercise, SessionBlockRequest } from "../../../../../types/training";

function buildExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: "ex-x",
    name: "Ejercicio",
    tipo: "Analitico",
    objetivo: "",
    objetivoPorRol: null,
    modelRelations: [],
    nivelesColumnas: [],
    niveles: [],
    logistica: "",
    durationMinutes: null,
    porteros: null,
    dibujo: null,
    descripcion: "",
    urlImage: null,
    boardStateJson: null,
    isAssociatedToGameModel: false,
    ...overrides,
  };
}

const exercises: Exercise[] = [
  buildExercise({
    id: "ex-1",
    name: "Rondo con porterías",
    tipo: "Situacional",
    objetivo: "Mejorar el perfilamiento antes de recibir",
    descripcion: "Rondo 4v2 en 15x15 con dos porterías pequeñas",
    logistica: "8 conos, 4 petos, 2 miniporterías",
    durationMinutes: 12,
  }),
  buildExercise({ id: "ex-2", name: "Circuito físico" }),
];

function block(order: number, nombre: string, exerciseIds: string[] = []): SessionBlockRequest {
  return {
    order,
    nombre,
    rotacionEntreEjercicios: null,
    exercises: exerciseIds.map((exerciseId, i) => ({ exerciseId, position: i + 1 })),
  };
}

function setup(overrides: Partial<{ blocks: SessionBlockRequest[]; onChange: (b: SessionBlockRequest[]) => void }> = {}) {
  const onChange = overrides.onChange ?? vi.fn();
  const blocks = overrides.blocks ?? [];
  render(
    <MemoryRouter>
      <SessionBlockEditor blocks={blocks} onChange={onChange} clubId="club-1" />
    </MemoryRouter>
  );
  return { onChange };
}

describe("SessionBlockEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (trainingService.getExercises as ReturnType<typeof vi.fn>).mockResolvedValue(exercises);
  });

  it("añade un bloque nuevo (numerado secuencialmente) al pulsar 'Añadir bloque'", async () => {
    const { onChange } = setup({ blocks: [] });

    await userEvent.click(screen.getByRole("button", { name: /añadir bloque/i }));

    expect(onChange).toHaveBeenCalled();
    const [blocks] = onChange.mock.calls[0];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].order).toBe(1);
  });

  it("no muestra el campo 'Cómo conecta con el anterior'", () => {
    setup({ blocks: [block(1, "Bloque 1")] });

    expect(screen.queryByLabelText(/cómo conecta con el anterior/i)).not.toBeInTheDocument();
  });

  it("solo muestra 'Rotación entre ejercicios' cuando el bloque tiene 2 o más ejercicios", () => {
    setup({ blocks: [block(1, "Bloque 1", ["ex-1"])] });

    expect(screen.queryByLabelText(/rotación entre ejercicios/i)).not.toBeInTheDocument();
  });

  it("muestra 'Rotación entre ejercicios' cuando el bloque tiene 2 ejercicios en paralelo", () => {
    setup({ blocks: [block(1, "Bloque 1", ["ex-1", "ex-2"])] });

    expect(screen.getByLabelText(/rotación entre ejercicios/i)).toBeInTheDocument();
  });

  it("añade un ejercicio existente al bloque desde el Autocomplete", async () => {
    const onChange = vi.fn();
    setup({ blocks: [block(1, "Bloque 1")], onChange });

    await waitFor(() => {
      expect(trainingService.getExercises).toHaveBeenCalled();
    });

    const combobox = await screen.findByRole("combobox", { name: /añadir ejercicio existente/i });
    await userEvent.click(combobox);
    const listbox = screen.getByRole("listbox");
    await userEvent.click(within(listbox).getByText("Rondo con porterías"));

    expect(onChange).toHaveBeenCalled();
    const [blocks] = onChange.mock.calls[0];
    expect(blocks[0].exercises).toEqual([{ exerciseId: "ex-1", position: 1 }]);
  });

  it("muestra la ficha del ejercicio elegido (tipo, duración, objetivo, descripción y logística)", async () => {
    setup({ blocks: [block(1, "Bloque 1", ["ex-1"])] });

    const card = await screen.findByRole("article", { name: "Rondo con porterías" });
    expect(within(card).getByText("Situacional")).toBeInTheDocument();
    expect(within(card).getByText("12 min")).toBeInTheDocument();
    expect(within(card).getByText("Mejorar el perfilamiento antes de recibir")).toBeInTheDocument();
    expect(within(card).getByText("Rondo 4v2 en 15x15 con dos porterías pequeñas")).toBeInTheDocument();
    expect(within(card).getByText("8 conos, 4 petos, 2 miniporterías")).toBeInTheDocument();
  });

  it("elimina un bloque y renumera el resto (sin huecos)", async () => {
    const onChange = vi.fn();
    setup({ blocks: [block(1, "Bloque 1"), block(2, "Bloque 2")], onChange });

    const deleteButtons = screen.getAllByRole("button", { name: /eliminar bloque/i });
    await userEvent.click(deleteButtons[0]);

    const [blocks] = onChange.mock.calls[0];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].order).toBe(1);
    expect(blocks[0].nombre).toBe("Bloque 2");
  });

  it("baja un bloque una posición y renumera el orden", async () => {
    const onChange = vi.fn();
    setup({ blocks: [block(1, "Calentamiento"), block(2, "Principal"), block(3, "Vuelta a la calma")], onChange });

    const moveDownButtons = screen.getAllByRole("button", { name: /bajar bloque/i });
    await userEvent.click(moveDownButtons[0]);

    const [blocks] = onChange.mock.calls[0];
    expect(blocks.map((b: SessionBlockRequest) => [b.order, b.nombre])).toEqual([
      [1, "Principal"],
      [2, "Calentamiento"],
      [3, "Vuelta a la calma"],
    ]);
  });

  it("sube un bloque una posición y renumera el orden", async () => {
    const onChange = vi.fn();
    setup({ blocks: [block(1, "Calentamiento"), block(2, "Principal"), block(3, "Vuelta a la calma")], onChange });

    const moveUpButtons = screen.getAllByRole("button", { name: /subir bloque/i });
    await userEvent.click(moveUpButtons[2]);

    const [blocks] = onChange.mock.calls[0];
    expect(blocks.map((b: SessionBlockRequest) => [b.order, b.nombre])).toEqual([
      [1, "Calentamiento"],
      [2, "Vuelta a la calma"],
      [3, "Principal"],
    ]);
  });

  it("deshabilita 'Subir' en el primer bloque y 'Bajar' en el último", () => {
    setup({ blocks: [block(1, "Calentamiento"), block(2, "Principal")] });

    expect(screen.getAllByRole("button", { name: /subir bloque/i })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /bajar bloque/i })[1]).toBeDisabled();
  });

  it("ofrece un asa para arrastrar cada bloque", () => {
    setup({ blocks: [block(1, "Calentamiento"), block(2, "Principal")] });

    expect(screen.getAllByRole("button", { name: /arrastrar bloque/i })).toHaveLength(2);
  });
});
