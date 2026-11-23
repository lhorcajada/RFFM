import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LinesEditor, { MAX_SHEET_LINES } from "../LinesEditor";
import TeamsEditor, { MAX_SHEET_TEAMS } from "../TeamsEditor";
import type { ExerciseTeam } from "../../../../../types/training";

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

const team: ExerciseTeam = { color: "blue", nombre: "Azules", cantidad: 4, roles: "1 pivote", objetivos: ["Posesión"] };

describe("TeamsEditor", () => {
  it("muestra una tarjeta por equipo con sus datos", () => {
    render(<TeamsEditor teams={[team]} onChange={vi.fn()} />);

    expect(screen.getByDisplayValue("Azules")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1 pivote")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Posesión")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Azul" })).toHaveAttribute("aria-pressed", "true");
  });

  it("añade un equipo vacío y respeta el máximo", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<TeamsEditor teams={[]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "+ Añadir equipo" }));
    expect(onChange).toHaveBeenCalledWith([{ color: null, nombre: "", cantidad: null, roles: null, objetivos: [] }]);

    rerender(<TeamsEditor teams={Array.from({ length: MAX_SHEET_TEAMS }, () => team)} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "+ Añadir equipo" })).toBeDisabled();
  });

  it("cambia el color del equipo y lo quita al volver a pulsarlo", async () => {
    const onChange = vi.fn();
    render(<TeamsEditor teams={[team]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Amarillo" }));
    await userEvent.click(screen.getByRole("button", { name: "Azul" }));

    expect(onChange).toHaveBeenNthCalledWith(1, [{ ...team, color: "yellow" }]);
    expect(onChange).toHaveBeenNthCalledWith(2, [{ ...team, color: null }]);
  });

  it("edita el nombre del equipo", async () => {
    const onChange = vi.fn();
    render(<TeamsEditor teams={[team]} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Nombre del equipo 1"), "s");

    expect(onChange).toHaveBeenLastCalledWith([{ ...team, nombre: "Azuless" }]);
  });

  it("añade una línea de objetivo al equipo", async () => {
    const onChange = vi.fn();
    render(<TeamsEditor teams={[team]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "+ Añadir línea" }));

    expect(onChange).toHaveBeenCalledWith([{ ...team, objetivos: ["Posesión", ""] }]);
  });

  it("elimina un equipo", async () => {
    const onChange = vi.fn();
    render(<TeamsEditor teams={[team, { ...team, nombre: "Rojos" }]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar equipo 1" }));

    expect(onChange).toHaveBeenCalledWith([{ ...team, nombre: "Rojos" }]);
  });
});
