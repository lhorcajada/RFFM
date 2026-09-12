import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SanctionsSummaryCards from "../SanctionsSummaryCards";

describe("SanctionsSummaryCards", () => {
  it("muestra el total multado, el total pendiente y el saldo de la bolsa del equipo", () => {
    render(
      <SanctionsSummaryCards totalFine={150} totalPending={60} fundBalance={90} />
    );

    expect(screen.getByText("Total multado")).toBeInTheDocument();
    expect(screen.getByText("150 €")).toBeInTheDocument();

    expect(screen.getByText("Total pendiente")).toBeInTheDocument();
    expect(screen.getByText("60 €")).toBeInTheDocument();

    expect(screen.getByText("Bolsa del equipo")).toBeInTheDocument();
    expect(screen.getByText("90 €")).toBeInTheDocument();
  });

  it("muestra 0 € cuando el saldo de la bolsa aún no se ha cargado", () => {
    render(<SanctionsSummaryCards totalFine={0} totalPending={0} fundBalance={null} />);

    const cards = screen.getAllByText("0 €");
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });
});
