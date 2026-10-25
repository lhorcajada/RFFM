import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PositionGroupedList from "../PositionGroupedList";

type Item = { id: string; name: string; position?: string };

const items: Item[] = [
  { id: "9", name: "Delantero Nueve", position: "Delantero Centro" },
  { id: "0", name: "Sin Posición" },
  { id: "1", name: "Portero Uno", position: "Portero" },
  { id: "4", name: "Central Cuatro", position: "Defensa Central" },
];

describe("PositionGroupedList", () => {
  it("ordena a los jugadores por posición con los que no tienen posición al final", () => {
    render(
      <PositionGroupedList
        items={items}
        getPosition={(i) => i.position}
        renderItem={(i) => <li key={i.id}>{i.name}</li>}
      />
    );

    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Portero Uno",
      "Central Cuatro",
      "Delantero Nueve",
      "Sin Posición",
    ]);
  });

  it("no pinta cabeceras de posición", () => {
    render(
      <PositionGroupedList
        items={items}
        getPosition={(i) => i.position}
        renderItem={(i) => <li key={i.id}>{i.name}</li>}
      />
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
