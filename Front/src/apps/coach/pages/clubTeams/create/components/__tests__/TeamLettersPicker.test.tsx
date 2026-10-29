import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TeamLettersPicker from "../TeamLettersPicker";

const onChange = vi.fn();

function renderPicker(selected: string[] = [], existing: string[] = ["A", "B"]) {
  return render(
    <TeamLettersPicker
      categoryName="Cadete"
      existing={existing}
      selected={selected}
      onChange={onChange}
    />
  );
}

describe("TeamLettersPicker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloquea las letras de equipos que ya existen", () => {
    renderPicker();
    expect(screen.getByRole("button", { name: "Cadete A, ya existe" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cadete C" })).toBeEnabled();
  });

  it("marca como pulsadas las letras seleccionadas", () => {
    renderPicker(["C"]);
    expect(screen.getByRole("button", { name: "Cadete C" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Cadete D" })).toHaveAttribute("aria-pressed", "false");
  });

  it("añade una letra al pulsarla", async () => {
    renderPicker(["C"]);
    await userEvent.click(screen.getByRole("button", { name: "Cadete D" }));
    expect(onChange).toHaveBeenCalledWith(["C", "D"]);
  });

  it("quita una letra ya seleccionada al pulsarla", async () => {
    renderPicker(["C", "D"]);
    await userEvent.click(screen.getByRole("button", { name: "Cadete C" }));
    expect(onChange).toHaveBeenCalledWith(["D"]);
  });

  it("el atajo A–D selecciona solo las letras libres", async () => {
    renderPicker();
    await userEvent.click(screen.getByRole("button", { name: "A–D" }));
    expect(onChange).toHaveBeenCalledWith(["C", "D"]);
  });

  it("el atajo A–Z selecciona todas las letras libres", async () => {
    renderPicker();
    await userEvent.click(screen.getByRole("button", { name: "A–Z" }));
    expect(onChange.mock.calls[0][0]).toHaveLength(24);
  });

  it("Limpiar vacía la selección", async () => {
    renderPicker(["C"]);
    await userEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
