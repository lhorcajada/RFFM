import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SizeDialog from "../SizeDialog";

const makeDialog = (onSubmit = vi.fn()) => ({
  title: "Tamaño del espacio",
  fields: [
    { label: "Ancho/Largo (m)", value: "1" },
    { label: "Alto (m)", value: "1" },
  ],
  onSubmit,
});

describe("SizeDialog", () => {
  it("permite aplicar valores menores que el tamaño inicial", async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<SizeDialog dialog={makeDialog(onSubmit)} onClose={onClose} />);

    const width = screen.getByLabelText("Ancho/Largo (m)");
    await userEvent.clear(width);
    await userEvent.type(width, "0,5");
    await userEvent.click(screen.getByRole("button", { name: /aplicar/i }));

    expect(onSubmit).toHaveBeenCalledWith([0.5, 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it("deshabilita aplicar cuando un valor no es válido", async () => {
    render(<SizeDialog dialog={makeDialog()} onClose={vi.fn()} />);

    const height = screen.getByLabelText("Alto (m)");
    await userEvent.clear(height);
    await userEvent.type(height, "abc");

    expect(screen.getByRole("button", { name: /aplicar/i })).toBeDisabled();
  });

  it("cierra sin aplicar al cancelar", async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<SizeDialog dialog={makeDialog(onSubmit)} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
