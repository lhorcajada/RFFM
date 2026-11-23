import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NivelesEditor from "../NivelesEditor";
import type { ExerciseLevelRow } from "../../../../../types/training";

const niveles: ExerciseLevelRow[] = [
  { nivel: 1, valores: { "Palanca 1": "a" } },
  { nivel: 2, valores: { "Palanca 1": "b" } },
  { nivel: 3, valores: { "Palanca 1": "c" } },
];

function setup(nivelDibujo: number | null, withMarker = true) {
  const onChange = vi.fn();
  const onNivelDibujoChange = vi.fn();
  render(
    <NivelesEditor
      columnas={["Palanca 1"]}
      niveles={niveles}
      onChange={onChange}
      nivelDibujo={nivelDibujo}
      onNivelDibujoChange={withMarker ? onNivelDibujoChange : undefined}
    />,
  );
  return { onChange, onNivelDibujoChange };
}

describe("NivelesEditor — nivel que muestra el dibujo", () => {
  it("no muestra la marca del dibujo cuando no se pasa onNivelDibujoChange", () => {
    setup(null, false);

    expect(screen.queryByRole("button", { name: /el dibujo muestra el nivel/i })).not.toBeInTheDocument();
  });

  it("marca como pulsado solo el nivel que muestra el dibujo", () => {
    setup(2);

    expect(screen.getByRole("button", { name: "El dibujo muestra el nivel 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "El dibujo muestra el nivel 1" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marca un nivel al pulsarlo y lo desmarca al pulsarlo otra vez", async () => {
    const { onNivelDibujoChange } = setup(2);

    await userEvent.click(screen.getByRole("button", { name: "El dibujo muestra el nivel 1" }));
    await userEvent.click(screen.getByRole("button", { name: "El dibujo muestra el nivel 2" }));

    expect(onNivelDibujoChange).toHaveBeenNthCalledWith(1, 1);
    expect(onNivelDibujoChange).toHaveBeenNthCalledWith(2, null);
  });

  it("limpia la marca avisando cuando se borra la fila marcada", async () => {
    const { onNivelDibujoChange } = setup(2);

    await userEvent.click(screen.getAllByRole("button", { name: "Eliminar nivel" })[1]);

    expect(onNivelDibujoChange).toHaveBeenCalledWith(null, true);
  });

  it("mueve la marca al renumerar cuando se borra una fila anterior", async () => {
    const { onNivelDibujoChange } = setup(3);

    await userEvent.click(screen.getAllByRole("button", { name: "Eliminar nivel" })[0]);

    expect(onNivelDibujoChange).toHaveBeenCalledWith(2);
  });

  it("no toca la marca al borrar una fila posterior", async () => {
    const { onNivelDibujoChange } = setup(1);

    await userEvent.click(screen.getAllByRole("button", { name: "Eliminar nivel" })[2]);

    expect(onNivelDibujoChange).not.toHaveBeenCalled();
  });
});
