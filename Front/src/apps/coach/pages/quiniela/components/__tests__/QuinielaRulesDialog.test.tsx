import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuinielaRulesDialog from "../QuinielaRulesDialog";

function renderDialog(props: Partial<React.ComponentProps<typeof QuinielaRulesDialog>> = {}) {
  return render(<QuinielaRulesDialog open onClose={vi.fn()} {...props} />);
}

function prizeRow(name: string): HTMLElement {
  return screen.getByText(name).closest("li") as HTMLElement;
}

describe("QuinielaRulesDialog — reparto de premios", () => {
  it("indica qué parte de la bolsa se lleva cada categoría", () => {
    renderDialog();
    expect(within(prizeRow("Categoría Especial")).getByText(/19,5\s%/)).toBeInTheDocument();
    expect(within(prizeRow("1ª categoría")).getByText(/41,6\s%/)).toBeInTheDocument();
    expect(within(prizeRow("2ª categoría")).getByText(/19,5\s%/)).toBeInTheDocument();
    expect(within(prizeRow("3ª categoría")).getByText(/19,5\s%/)).toBeInTheDocument();
  });

  it("con la bolsa de la jornada muestra el importe que corresponde hoy a cada categoría", () => {
    renderDialog({ prizePool: 38.5 });
    expect(within(prizeRow("Categoría Especial")).getByText(/7,50\s€/)).toBeInTheDocument();
    expect(within(prizeRow("1ª categoría")).getByText(/16,00\s€/)).toBeInTheDocument();
    expect(within(prizeRow("2ª categoría")).getByText(/7,50\s€/)).toBeInTheDocument();
    expect(within(prizeRow("3ª categoría")).getByText(/7,50\s€/)).toBeInTheDocument();
  });

  it("sin bolsa conocida no muestra importes", () => {
    renderDialog();
    expect(screen.queryByText(/\d,\d\d\s€/)).not.toBeInTheDocument();
  });

  it("explica que el premio de cada categoría se divide entre sus acertantes", () => {
    renderDialog();
    expect(screen.getByText(/a partes iguales entre los acertantes de su categoría/i)).toBeInTheDocument();
  });

  it("explica qué pasa con una categoría sin acertantes", () => {
    renderDialog();
    expect(screen.getByText(/si la 2ª categoría queda desierta, su importe pasa a la 3ª/i)).toBeInTheDocument();
    expect(screen.getByText(/si no hay acertantes en las demás, pasa de bote a la jornada siguiente/i)).toBeInTheDocument();
  });

  it("explica que una categoría inferior nunca cobra más por persona que una superior", () => {
    renderDialog();
    expect(screen.getByText(/nunca cobra más por persona que una superior/i)).toBeInTheDocument();
  });

  it("explica que el resto de lo recaudado va a la hucha del equipo", () => {
    renderDialog();
    expect(screen.getByText(/el resto de lo recaudado va a la hucha del equipo/i)).toBeInTheDocument();
  });

  it("se cierra con «Entendido»", () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
