import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SquadFilters from "../SquadFilters";

const categories = [
  { key: 0, label: "Porteros", count: 2 },
  { key: 3, label: "Delanteros", count: 5 },
];

function renderFilters(props: Partial<React.ComponentProps<typeof SquadFilters>> = {}) {
  const onSelect = vi.fn();
  const onQueryChange = vi.fn();
  render(
    <SquadFilters
      categories={categories}
      selected={null}
      onSelect={onSelect}
      query=""
      onQueryChange={onQueryChange}
      {...props}
    />
  );
  return { onSelect, onQueryChange };
}

describe("SquadFilters", () => {
  it("muestra «Todos» y un chip por posición", () => {
    renderFilters();

    expect(screen.getByRole("button", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Porteros" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delanteros" })).toBeInTheDocument();
  });

  it("muestra cuántos jugadores hay en cada posición dentro del chip", () => {
    renderFilters();

    expect(screen.getByRole("button", { name: "Porteros" })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Delanteros" })).toHaveTextContent("5");
  });

  it("marca «Todos» como pulsado cuando no hay posición seleccionada", () => {
    renderFilters({ selected: null });

    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Porteros" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marca como pulsada la posición seleccionada", () => {
    renderFilters({ selected: 3 });

    expect(screen.getByRole("button", { name: "Delanteros" })).toHaveAttribute("aria-pressed", "true");
  });

  it("avisa de la posición elegida al pulsar un chip", async () => {
    const { onSelect } = renderFilters();

    await userEvent.click(screen.getByRole("button", { name: "Porteros" }));

    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it("vuelve a todos al pulsar «Todos»", async () => {
    const { onSelect } = renderFilters({ selected: 3 });

    await userEvent.click(screen.getByRole("button", { name: "Todos" }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("avisa del texto buscado al escribir en el buscador", async () => {
    const { onQueryChange } = renderFilters();

    await userEvent.type(screen.getByRole("textbox", { name: /buscar jugador/i }), "a");

    expect(onQueryChange).toHaveBeenCalledWith("a");
  });
});
