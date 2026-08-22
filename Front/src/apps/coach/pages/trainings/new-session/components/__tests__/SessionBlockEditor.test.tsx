import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../services/trainingService", () => ({
  default: { getExercises: vi.fn() },
}));

import SessionBlockEditor from "../SessionBlockEditor";
import trainingService from "../../../../../services/trainingService";
import type { SessionBlockRequest } from "../../../../../types/training";

const exerciseOptions = [
  { id: "ex-1", name: "Rondo con porterías" },
  { id: "ex-2", name: "Circuito físico" },
];

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
    (trainingService.getExercises as ReturnType<typeof vi.fn>).mockResolvedValue(
      exerciseOptions.map((e) => ({ id: e.id, name: e.name }))
    );
  });

  it("añade un bloque nuevo (numerado secuencialmente) al pulsar 'Añadir bloque'", async () => {
    const { onChange } = setup({ blocks: [] });

    await userEvent.click(screen.getByRole("button", { name: /añadir bloque/i }));

    expect(onChange).toHaveBeenCalled();
    const [blocks] = onChange.mock.calls[0];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].order).toBe(1);
  });

  it("exige 'Cómo conecta con el anterior' incluso para el primer bloque (campo visible y obligatorio)", () => {
    setup({
      blocks: [
        { order: 1, nombre: "Bloque 1", comoConectaConAnterior: "", rotacionEntreEjercicios: null, exercises: [] },
      ],
    });

    expect(screen.getByLabelText(/cómo conecta con el anterior/i)).toBeInTheDocument();
  });

  it("solo muestra 'Rotación entre ejercicios' cuando el bloque tiene 2 o más ejercicios", () => {
    setup({
      blocks: [
        {
          order: 1,
          nombre: "Bloque 1",
          comoConectaConAnterior: "Primer bloque",
          rotacionEntreEjercicios: null,
          exercises: [{ exerciseId: "ex-1", position: 1 }],
        },
      ],
    });

    expect(screen.queryByLabelText(/rotación entre ejercicios/i)).not.toBeInTheDocument();
  });

  it("muestra 'Rotación entre ejercicios' cuando el bloque tiene 2 ejercicios en paralelo", () => {
    setup({
      blocks: [
        {
          order: 1,
          nombre: "Bloque 1",
          comoConectaConAnterior: "Primer bloque",
          rotacionEntreEjercicios: null,
          exercises: [
            { exerciseId: "ex-1", position: 1 },
            { exerciseId: "ex-2", position: 2 },
          ],
        },
      ],
    });

    expect(screen.getByLabelText(/rotación entre ejercicios/i)).toBeInTheDocument();
  });

  it("añade un ejercicio existente al bloque desde el Autocomplete", async () => {
    const onChange = vi.fn();
    setup({
      blocks: [
        { order: 1, nombre: "Bloque 1", comoConectaConAnterior: "Primer bloque", rotacionEntreEjercicios: null, exercises: [] },
      ],
      onChange,
    });

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

  it("elimina un bloque y renumera el resto (sin huecos)", async () => {
    const onChange = vi.fn();
    setup({
      blocks: [
        { order: 1, nombre: "Bloque 1", comoConectaConAnterior: "A", rotacionEntreEjercicios: null, exercises: [] },
        { order: 2, nombre: "Bloque 2", comoConectaConAnterior: "B", rotacionEntreEjercicios: null, exercises: [] },
      ],
      onChange,
    });

    const deleteButtons = screen.getAllByRole("button", { name: /eliminar bloque/i });
    await userEvent.click(deleteButtons[0]);

    const [blocks] = onChange.mock.calls[0];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].order).toBe(1);
    expect(blocks[0].nombre).toBe("Bloque 2");
  });
});
