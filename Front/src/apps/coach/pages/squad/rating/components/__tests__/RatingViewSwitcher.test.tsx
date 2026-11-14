import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import RatingViewSwitcher from "../RatingViewSwitcher";

function renderSwitcher(hasUnsavedChanges: boolean, onChange = vi.fn()) {
  render(<RatingViewSwitcher value="traits" hasUnsavedChanges={hasUnsavedChanges} onChange={onChange} />);
  return onChange;
}

describe("RatingViewSwitcher", () => {
  it("muestra las tres vistas y marca la actual", () => {
    renderSwitcher(false);

    expect(screen.getByRole("button", { name: "Capacidad" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Conducta en partido" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Orden por puesto" })).toHaveAttribute("aria-pressed", "false");
  });

  it("cambia de vista sin preguntar cuando no hay cambios sin guardar", async () => {
    const onChange = renderSwitcher(false);

    await userEvent.click(screen.getByRole("button", { name: "Orden por puesto" }));

    expect(onChange).toHaveBeenCalledWith("order");
  });

  it("pide confirmación antes de cambiar de vista con cambios sin guardar", async () => {
    const onChange = renderSwitcher(true);

    await userEvent.click(screen.getByRole("button", { name: "Capacidad" }));

    expect(await screen.findByText("Cambiar de vista")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cambia de vista al confirmar", async () => {
    const onChange = renderSwitcher(true);

    await userEvent.click(screen.getByRole("button", { name: "Capacidad" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cambiar" }));

    expect(onChange).toHaveBeenCalledWith("capacity");
  });

  it("se queda en la vista actual al cancelar", async () => {
    const onChange = renderSwitcher(true);

    await userEvent.click(screen.getByRole("button", { name: "Capacidad" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("no hace nada al pulsar la vista actual", async () => {
    const onChange = renderSwitcher(true);

    await userEvent.click(screen.getByRole("button", { name: "Conducta en partido" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Cambiar de vista")).not.toBeInTheDocument();
  });
});
