import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("muestra confirmar y cancelar, y no muestra acción secundaria por defecto", () => {
    render(<ConfirmDialog open title="Título" onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("muestra la acción secundaria y la ejecuta sin confirmar ni cancelar", async () => {
    const onSecondary = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Título"
        secondaryText="Editar ejercicio"
        onSecondary={onSecondary}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Editar ejercicio" }));

    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("no muestra la acción secundaria si falta su manejador", () => {
    render(<ConfirmDialog open secondaryText="Editar ejercicio" onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Editar ejercicio" })).not.toBeInTheDocument();
  });
});
