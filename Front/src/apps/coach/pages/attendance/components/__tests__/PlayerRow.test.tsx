import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PlayerRow from "../PlayerRow";

function renderRow(props: Partial<React.ComponentProps<typeof PlayerRow>> = {}) {
  return render(
    <MemoryRouter>
      <ul>
        <PlayerRow name="Hugo Martín" {...props} />
      </ul>
    </MemoryRouter>
  );
}

describe("PlayerRow", () => {
  it("muestra el nombre, el dorsal y la etiqueta de posición", () => {
    renderRow({ dorsal: 9, positionTag: "DEL" });

    expect(screen.getByText("Hugo Martín")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("DEL")).toBeInTheDocument();
  });

  it("muestra el chip de estado y el texto secundario", () => {
    renderRow({ status: { label: "No va", tone: "declined" }, secondary: "Decisión técnica" });

    expect(screen.getByText("No va")).toBeInTheDocument();
    expect(screen.getByText("Decisión técnica")).toBeInTheDocument();
  });

  it("enlaza al detalle del jugador cuando hay detailHref", () => {
    renderRow({ detailHref: "/coach/player/tp1" });

    expect(screen.getByRole("link", { name: /Hugo Martín/ })).toHaveAttribute("href", "/coach/player/tp1");
  });

  it("no enlaza al detalle sin detailHref", () => {
    renderRow();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("muestra un checkbox de selección con su nombre accesible y avisa al cambiarlo", async () => {
    const onToggleSelect = vi.fn();
    renderRow({ selectable: true, selected: false, onToggleSelect, selectLabel: "Seleccionar a Hugo Martín para notificar" });

    await userEvent.click(screen.getByRole("checkbox", { name: "Seleccionar a Hugo Martín para notificar" }));

    expect(onToggleSelect).toHaveBeenCalledTimes(1);
  });

  it("pinta las acciones recibidas", () => {
    renderRow({ actions: <button type="button">Convocar</button> });

    expect(screen.getByRole("button", { name: "Convocar" })).toBeInTheDocument();
  });
});
