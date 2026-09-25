import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import HabilidadChips from "../HabilidadChips";
import type { Habilidad } from "../../../../../types/gameModel";

function habilidad(overrides: Partial<Habilidad> = {}): Habilidad {
  return {
    id: -1,
    apiId: "hab-1",
    nombre: "Perfilamiento",
    descripcion: "Orientar el cuerpo hacia fuera",
    entrenable: "Situaciones 1x1 en banda",
    referenciaAKey: null,
    ...overrides,
  };
}

describe("HabilidadChips", () => {
  it("muestra un chip por cada habilidad", () => {
    render(
      <HabilidadChips
        habilidades={[habilidad(), habilidad({ id: -2, apiId: "hab-2", nombre: "Anticipación" })]}
      />
    );

    expect(screen.getByText("Perfilamiento")).toBeInTheDocument();
    expect(screen.getByText("Anticipación")).toBeInTheDocument();
  });

  it("al pasar por el chip muestra la descripción y el texto de entrenable", async () => {
    render(<HabilidadChips habilidades={[habilidad()]} />);

    await userEvent.hover(screen.getByText("Perfilamiento"));

    expect(await screen.findByText("Orientar el cuerpo hacia fuera")).toBeInTheDocument();
    expect(screen.getByText("Entrenable: Situaciones 1x1 en banda")).toBeInTheDocument();
  });

  it("indica 'Igual que' cuando la habilidad remite a otro sub-subprincipio", async () => {
    render(<HabilidadChips habilidades={[habilidad({ descripcion: "", entrenable: "", referenciaAKey: "1.2.3" })]} />);

    await userEvent.hover(screen.getByText("Perfilamiento"));

    expect(await screen.findByText("Igual que 1.2.3")).toBeInTheDocument();
  });

  it("no renderiza nada cuando no hay habilidades", () => {
    const { container } = render(<HabilidadChips habilidades={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
