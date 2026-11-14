import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import RatingViewSwitcher from "../RatingViewSwitcher";

function renderSwitcher(hasUnsavedChanges: boolean, onChange = vi.fn()) {
  render(<RatingViewSwitcher value="traits" hasUnsavedChanges={hasUnsavedChanges} onChange={onChange} />);
  return onChange;
}

async function openList() {
  await userEvent.click(screen.getByRole("combobox", { name: "Vista" }));
}

async function choose(name: string) {
  await openList();
  await userEvent.click(await screen.findByRole("option", { name }));
}

describe("RatingViewSwitcher", () => {
  it("es un selector que muestra la vista actual", () => {
    renderSwitcher(false);

    expect(screen.getByRole("combobox", { name: "Vista" })).toHaveTextContent("Conducta en partido");
  });

  it("ofrece las cuatro vistas y marca la actual", async () => {
    renderSwitcher(false);

    await openList();

    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Capacidad",
      "Conducta en partido",
      "Orden por puesto",
      "Configurar",
    ]);
    expect(screen.getByRole("option", { name: "Conducta en partido" })).toHaveAttribute("aria-selected", "true");
  });

  it("puede cambiar a la configuración", async () => {
    const onChange = renderSwitcher(false);

    await choose("Configurar");

    expect(onChange).toHaveBeenCalledWith("config");
  });

  it("cambia de vista sin preguntar cuando no hay cambios sin guardar", async () => {
    const onChange = renderSwitcher(false);

    await choose("Orden por puesto");

    expect(onChange).toHaveBeenCalledWith("order");
  });

  it("pide confirmación antes de cambiar de vista con cambios sin guardar", async () => {
    const onChange = renderSwitcher(true);

    await choose("Capacidad");

    expect(await screen.findByText("Cambiar de vista")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cambia de vista al confirmar", async () => {
    const onChange = renderSwitcher(true);

    await choose("Capacidad");
    await userEvent.click(await screen.findByRole("button", { name: "Cambiar" }));

    expect(onChange).toHaveBeenCalledWith("capacity");
  });

  it("se queda en la vista actual al cancelar", async () => {
    const onChange = renderSwitcher(true);

    await choose("Capacidad");
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByRole("combobox", { name: "Vista" })).toHaveTextContent("Conducta en partido");
  });

  it("no hace nada al elegir la vista actual", async () => {
    const onChange = renderSwitcher(true);

    await choose("Conducta en partido");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Cambiar de vista")).not.toBeInTheDocument();
  });
});
