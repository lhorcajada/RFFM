import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PositionGroupedList from "../PositionGroupedList";

type Item = { id: string; name: string; position?: string };

const items: Item[] = [
  { id: "9", name: "Delantero Nueve", position: "Delantero Centro" },
  { id: "1", name: "Portero Uno", position: "Portero" },
  { id: "4", name: "Central Cuatro", position: "Defensa Central" },
];

describe("PositionGroupedList", () => {
  it("muestra un encabezado por posición en orden y cada jugador bajo su grupo", () => {
    render(
      <PositionGroupedList
        items={items}
        getPosition={(i) => i.position}
        renderItem={(i) => <div key={i.id}>{i.name}</div>}
      />
    );

    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual(["Porteros1", "Defensas1", "Delanteros1"]);
    const porteros = screen.getByRole("region", { name: /porteros/i });
    expect(porteros).toHaveTextContent("Portero Uno");
    expect(porteros).not.toHaveTextContent("Delantero Nueve");
  });

  it("no pinta grupos vacíos", () => {
    render(
      <PositionGroupedList
        items={items}
        getPosition={(i) => i.position}
        renderItem={(i) => <div key={i.id}>{i.name}</div>}
      />
    );

    expect(screen.queryByRole("heading", { name: /medios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /sin posición/i })).not.toBeInTheDocument();
  });
});
