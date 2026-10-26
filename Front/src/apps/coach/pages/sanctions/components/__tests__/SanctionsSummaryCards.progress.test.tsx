import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SanctionsSummaryCards from "../SanctionsSummaryCards";

describe("SanctionsSummaryCards — progreso de cobro", () => {
  it("muestra lo cobrado frente a lo multado", () => {
    render(<SanctionsSummaryCards totalFine={150} totalPending={60} fundBalance={90} />);

    expect(screen.getByText("90 € cobrados de 150 €")).toBeInTheDocument();
  });

  it("la barra de progreso refleja el porcentaje cobrado", () => {
    render(<SanctionsSummaryCards totalFine={150} totalPending={60} fundBalance={90} />);

    expect(screen.getByRole("progressbar", { name: /cobrado/i })).toHaveAttribute("aria-valuenow", "60");
  });

  it("no divide por cero cuando no hay multas", () => {
    render(<SanctionsSummaryCards totalFine={0} totalPending={0} fundBalance={null} />);

    expect(screen.getByRole("progressbar", { name: /cobrado/i })).toHaveAttribute("aria-valuenow", "0");
  });
});
