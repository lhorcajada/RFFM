import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LinesEditor, { MAX_SHEET_LINES } from "../LinesEditor";

describe("LinesEditor", () => {
  it("muestra una línea editable por cada línea", () => {
    render(<LinesEditor label="Regla" lines={["Dos toques", "Sin manos"]} onChange={vi.fn()} />);

    expect(screen.getByDisplayValue("Dos toques")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sin manos")).toBeInTheDocument();
  });

  it("numera las líneas cuando es una lista ordenada", () => {
    render(<LinesEditor label="Paso" lines={["a", "b"]} onChange={vi.fn()} numbered />);

    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
  });

  it("añade una línea vacía al pulsar «Añadir línea»", async () => {
    const onChange = vi.fn();
    render(<LinesEditor label="Regla" lines={["Una"]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "+ Añadir línea" }));

    expect(onChange).toHaveBeenCalledWith(["Una", ""]);
  });

  it("no permite añadir más líneas que el máximo", () => {
    const lines = Array.from({ length: MAX_SHEET_LINES }, (_, i) => `Línea ${i}`);
    render(<LinesEditor label="Regla" lines={lines} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "+ Añadir línea" })).toBeDisabled();
  });

  it("edita el texto de una línea", async () => {
    const onChange = vi.fn();
    render(<LinesEditor label="Regla" lines={["Uno", "Dos"]} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Regla 2"), "!");

    expect(onChange).toHaveBeenLastCalledWith(["Uno", "Dos!"]);
  });

  it("elimina una línea", async () => {
    const onChange = vi.fn();
    render(<LinesEditor label="Regla" lines={["Uno", "Dos"]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar regla 1" }));

    expect(onChange).toHaveBeenCalledWith(["Dos"]);
  });
});
