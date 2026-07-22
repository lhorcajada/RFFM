import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MobileSaveCancelBar from "../MobileSaveCancelBar";

describe("MobileSaveCancelBar", () => {
  it("invoca onSave al pulsar el botón de guardar", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<MobileSaveCancelBar onSave={onSave} onCancel={onCancel} saving={false} saveLabel="Guardar Modelo" />);
    await userEvent.click(screen.getByRole("button", { name: /guardar modelo/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("invoca onCancel al pulsar cancelar", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<MobileSaveCancelBar onSave={onSave} onCancel={onCancel} saving={false} saveLabel="Guardar Modelo" />);
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("deshabilita el botón de guardar mientras guarda", () => {
    render(<MobileSaveCancelBar onSave={vi.fn()} onCancel={vi.fn()} saving={true} saveLabel="Guardar Modelo" />);
    expect(screen.getByRole("button", { name: /guardando/i })).toBeDisabled();
  });
});
