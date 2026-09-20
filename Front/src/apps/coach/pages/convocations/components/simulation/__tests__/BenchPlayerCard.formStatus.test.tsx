import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BenchPlayerCard } from "../BenchPlayerCard";
import type { SquadPlayer } from "../../../../squad/components/IdealLineup";

function renderCard(overrides: Partial<SquadPlayer>) {
  const player: SquadPlayer = { id: "p1", displayName: "Jugador Uno", readiness: 60, fatigue: 15, ...overrides };
  render(<BenchPlayerCard player={player} isDragActive={false} isLeaving={false} minutesPlayed={10} hasPlayed />);
}

describe("BenchPlayerCard - Estado de forma del backend", () => {
  it("muestra en Ef el formStatus del backend cuando difiere del cálculo local", () => {
    renderCard({ formStatus: 33 });

    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("33%");
  });

  it("cae al cálculo local (Rodaje en vivo) cuando no hay formStatus", () => {
    renderCard({});

    // Sin desglose de rodaje el Rodaje en vivo es null, así que el cálculo local da guion.
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("—");
  });
});
