import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WalletCard from "../WalletCard";

describe("WalletCard", () => {
  it("muestra el saldo del monedero", () => {
    render(<WalletCard balance={2.5} onShowMovements={vi.fn()} />);
    expect(screen.getByText("Mi monedero")).toBeInTheDocument();
    expect(screen.getByText(/2,50\s€/)).toBeInTheDocument();
  });

  it("abre el historial al pulsar «Ver movimientos»", () => {
    const onShowMovements = vi.fn();
    render(<WalletCard balance={0} onShowMovements={onShowMovements} />);
    fireEvent.click(screen.getByRole("button", { name: /ver movimientos/i }));
    expect(onShowMovements).toHaveBeenCalledTimes(1);
  });
});
