import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TrialConfirmDialog from "./TrialConfirmDialog";

describe("TrialConfirmDialog", () => {
  it("calls onAccept when the accept button is clicked", () => {
    const onAccept = vi.fn();
    const onClose = vi.fn();
    render(
      <TrialConfirmDialog
        open
        isProcessing={false}
        onClose={onClose}
        onAccept={onAccept}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Aceptar 7 días/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the cancel button is clicked", () => {
    const onAccept = vi.fn();
    const onClose = vi.fn();
    render(
      <TrialConfirmDialog
        open
        isProcessing={false}
        onClose={onClose}
        onAccept={onAccept}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while isProcessing", () => {
    render(
      <TrialConfirmDialog
        open
        isProcessing
        onClose={() => {}}
        onAccept={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Aceptar 7 días/i })
    ).toBeDisabled();
  });

  it("does not render when open is false", () => {
    render(
      <TrialConfirmDialog
        open={false}
        isProcessing={false}
        onClose={() => {}}
        onAccept={() => {}}
      />
    );
    expect(
      screen.queryByText(/activar la licencia gratuita/i)
    ).not.toBeInTheDocument();
  });
});
