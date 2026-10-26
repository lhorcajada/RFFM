import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SquadSummary from "../SquadSummary";

const players = [
  { position: "Portero", isInjured: false },
  { position: "Portero", isInjured: false },
  { position: "Central", isInjured: true },
  { position: "Mediocentro", isInjured: false },
  { position: "Delantero centro", isInjured: false },
  { position: null, isInjured: false },
];

function figureFor(label: string) {
  return screen.getByText(label).parentElement as HTMLElement;
}

describe("SquadSummary", () => {
  it("muestra el total de jugadores", () => {
    render(<SquadSummary players={players} />);

    expect(figureFor("Jugadores")).toHaveTextContent("6");
  });

  it("cuenta los lesionados", () => {
    render(<SquadSummary players={players} />);

    expect(figureFor("Lesionados")).toHaveTextContent("1");
  });

  it("no repite los totales por posición, que van en los filtros", () => {
    render(<SquadSummary players={players} />);

    expect(screen.queryByText("Porteros")).not.toBeInTheDocument();
  });
});
