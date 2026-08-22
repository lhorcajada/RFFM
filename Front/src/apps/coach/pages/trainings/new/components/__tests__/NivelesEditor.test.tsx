import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NivelesEditor, { renumberNiveles } from "../NivelesEditor";
import type { ExerciseLevelRow } from "../../../../../types/training";

describe("renumberNiveles", () => {
  it("renumbers rows to 1..N contiguously, preserving order and valores", () => {
    const rows: ExerciseLevelRow[] = [
      { nivel: 3, valores: { a: "x" } },
      { nivel: 7, valores: { a: "y" } },
    ];
    expect(renumberNiveles(rows)).toEqual([
      { nivel: 1, valores: { a: "x" } },
      { nivel: 2, valores: { a: "y" } },
    ]);
  });
});

function setup(overrides: Partial<{ columnas: string[]; niveles: ExerciseLevelRow[] }> = {}) {
  const onChange = vi.fn();
  const columnas = overrides.columnas ?? ["Palanca 1"];
  const niveles = overrides.niveles ?? [
    { nivel: 1, valores: { "Palanca 1": "" } },
    { nivel: 2, valores: { "Palanca 1": "" } },
  ];
  render(<NivelesEditor columnas={columnas} niveles={niveles} onChange={onChange} />);
  return { onChange };
}

describe("NivelesEditor", () => {
  it("renderiza una columna por palanca y una fila por nivel", () => {
    setup({
      columnas: ["Espacio", "Toques"],
      niveles: [
        { nivel: 1, valores: { Espacio: "8x8", Toques: "libres" } },
        { nivel: 2, valores: { Espacio: "10x10", Toques: "2 toques" } },
      ],
    });

    expect(screen.getByDisplayValue("Espacio")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Toques")).toBeInTheDocument();
    expect(screen.getByDisplayValue("8x8")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2 toques")).toBeInTheDocument();
  });

  it("añade una columna nueva al pulsar '+ columna'", async () => {
    const { onChange } = setup();

    await userEvent.click(screen.getByRole("button", { name: /añadir columna/i }));

    expect(onChange).toHaveBeenCalled();
    const [columnas] = onChange.mock.calls[0];
    expect(columnas).toHaveLength(2);
  });

  it("añade una fila nueva (numerada secuencialmente) al pulsar '+ nivel', hasta un máximo de 5", async () => {
    const { onChange } = setup({
      niveles: [
        { nivel: 1, valores: {} },
        { nivel: 2, valores: {} },
      ],
    });

    await userEvent.click(screen.getByRole("button", { name: /\+ nivel/i }));

    expect(onChange).toHaveBeenCalled();
    const [, niveles] = onChange.mock.calls[0];
    expect(niveles).toHaveLength(3);
    expect(niveles[2].nivel).toBe(3);
  });

  it("deshabilita '+ nivel' cuando ya hay 5 filas", () => {
    setup({
      niveles: [1, 2, 3, 4, 5].map((n) => ({ nivel: n, valores: {} })),
    });

    expect(screen.getByRole("button", { name: /\+ nivel/i })).toBeDisabled();
  });

  it("deshabilita eliminar fila cuando solo quedan 2 filas", () => {
    setup({
      niveles: [
        { nivel: 1, valores: {} },
        { nivel: 2, valores: {} },
      ],
    });

    const deleteRowButtons = screen.getAllByRole("button", { name: /eliminar nivel/i });
    deleteRowButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("al eliminar una columna, elimina esa clave de valores en todas las filas (sin celdas huérfanas)", async () => {
    const { onChange } = setup({
      columnas: ["Espacio", "Toques"],
      niveles: [
        { nivel: 1, valores: { Espacio: "8x8", Toques: "libres" } },
        { nivel: 2, valores: { Espacio: "10x10", Toques: "2 toques" } },
      ],
    });

    const deleteColumnButtons = screen.getAllByRole("button", { name: /eliminar columna/i });
    await userEvent.click(deleteColumnButtons[1]);

    const [columnas, niveles] = onChange.mock.calls[0];
    expect(columnas).toEqual(["Espacio"]);
    expect(niveles[0].valores).not.toHaveProperty("Toques");
    expect(niveles[1].valores).not.toHaveProperty("Toques");
  });
});
