import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WalletDonateDialog from "../WalletDonateDialog";

function renderDialog(props: Partial<React.ComponentProps<typeof WalletDonateDialog>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(<WalletDonateDialog open balance={4} onSubmit={onSubmit} onCancel={onCancel} {...props} />);
  return { onSubmit, onCancel };
}

describe("WalletDonateDialog", () => {
  it("indica que el máximo es el saldo disponible", () => {
    renderDialog();
    expect(screen.getByText(/hasta 4,00\s€/i)).toBeInTheDocument();
  });

  it("envía el importe indicado", () => {
    const { onSubmit } = renderDialog();
    fireEvent.change(screen.getByLabelText(/importe/i), { target: { value: "2,5" } });
    fireEvent.click(screen.getByRole("button", { name: /^donar$/i }));
    expect(onSubmit).toHaveBeenCalledWith(2.5);
  });

  it("no envía un importe mayor que el saldo y lo explica", () => {
    const { onSubmit } = renderDialog();
    fireEvent.change(screen.getByLabelText(/importe/i), { target: { value: "4,01" } });
    fireEvent.click(screen.getByRole("button", { name: /^donar$/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/supera tu saldo/i)).toBeInTheDocument();
  });

  it("avisa de que la donación no se puede deshacer", () => {
    renderDialog();
    expect(screen.getByText(/no se puede deshacer/i)).toBeInTheDocument();
  });
});
