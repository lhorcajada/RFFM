import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import BatchSummary from "../BatchSummary";

const onSubmit = vi.fn();
const onCancel = vi.fn();

function renderSummary(names: string[], existingCount = 2, processing = false) {
  return render(
    <BatchSummary
      names={names}
      existingCount={existingCount}
      processing={processing}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}

describe("BatchSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra los contadores y la lista de nombres a crear", () => {
    renderSummary(["Cadete C", "Cadete D"]);
    expect(screen.getByText("se crearán").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("ya existen").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("Cadete C")).toBeInTheDocument();
    expect(screen.getByText("Cadete D")).toBeInTheDocument();
  });

  it("el botón indica el número de equipos y envía al pulsarlo", async () => {
    renderSummary(["Cadete C", "Cadete D"]);
    await userEvent.click(screen.getByRole("button", { name: "Crear 2 equipos" }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("usa el singular con un solo equipo", () => {
    renderSummary(["Cadete C"]);
    expect(screen.getByRole("button", { name: "Crear 1 equipo" })).toBeEnabled();
  });

  it("deshabilita el botón y pide elegir una letra si no hay selección", () => {
    renderSummary([]);
    expect(screen.getByRole("button", { name: "Crear equipos" })).toBeDisabled();
    expect(screen.getByText(/Selecciona al menos una letra/)).toBeInTheDocument();
  });

  it("deshabilita el botón mientras se procesa", () => {
    renderSummary(["Cadete C"], 0, true);
    expect(screen.getByRole("button", { name: "Creando..." })).toBeDisabled();
  });

  it("cancela con el botón Cancelar", async () => {
    renderSummary(["Cadete C"]);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
