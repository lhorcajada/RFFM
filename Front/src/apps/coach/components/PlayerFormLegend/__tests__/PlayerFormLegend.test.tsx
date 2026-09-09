import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PlayerFormLegend from "../PlayerFormLegend";

describe("PlayerFormLegend", () => {
  it("muestra las 3 entradas consolidadas: Ef, Rodaje y Cansancio", () => {
    render(<PlayerFormLegend />);
    expect(screen.getByText(/Ef/)).toBeInTheDocument();
    expect(screen.getByText(/Rodaje/)).toBeInTheDocument();
    expect(screen.getByText(/Cansancio/)).toBeInTheDocument();
  });

  it("es una única leyenda (un solo contenedor con aria-label descriptivo)", () => {
    render(<PlayerFormLegend />);
    expect(screen.getByLabelText(/Leyenda/i)).toBeInTheDocument();
  });

  it("documenta el criterio invertido de Cansancio frente a Ef/Rodaje", () => {
    render(<PlayerFormLegend />);
    // Ef/Rodaje: verde >= 80; Cansancio: verde < 40 (criterio invertido)
    const legend = screen.getByLabelText(/Leyenda/i);
    expect(legend).toHaveTextContent("≥80");
    expect(legend).toHaveTextContent("<40");
  });
});
