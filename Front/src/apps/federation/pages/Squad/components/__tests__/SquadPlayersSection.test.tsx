import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../PlayerRow", () => ({
  default: ({ player }: { player: { name: string } }) => <div>fila-rffm {player.name}</div>,
}));

import SquadPlayersSection from "../SquadPlayersSection";
import type { CoachSquadComparison } from "../../../../services/squadComparisonService";
import type { Player } from "../../playersTypes";

const rffmPlayers: Player[] = [{ id: 1, name: "PEREZ, JOSE" }];

const coachComparison: CoachSquadComparison = {
  isCoachTeam: true,
  teamId: "t1",
  teamName: "Infantil A",
  players: [
    { name: "José Pérez", photoUrl: null, jerseyNumber: "10", rffmPlayerId: "1", teamPlayerId: "tp1", status: "Licensed", stats: null },
    { name: "Mario Gómez", photoUrl: null, jerseyNumber: "4", rffmPlayerId: null, teamPlayerId: "tp2", status: "Unlicensed", stats: null },
  ],
};

describe("SquadPlayersSection", () => {
  it("con el equipo del coach muestra las tarjetas de comparación en lugar del listado RFFM", () => {
    render(<SquadPlayersSection season="22" teamName="CD Ejemplo A" players={rffmPlayers} comparison={coachComparison} />);

    expect(screen.getByText("José Pérez")).toBeInTheDocument();
    expect(screen.getByText("Sin ficha")).toBeInTheDocument();
    expect(screen.getByText(/mi equipo/i)).toBeInTheDocument();
    expect(screen.queryByText(/fila-rffm/)).not.toBeInTheDocument();
  });

  it("si el equipo no es del coach muestra el listado RFFM", () => {
    render(
      <SquadPlayersSection
        season="22"
        teamName="CD Ejemplo A"
        players={rffmPlayers}
        comparison={{ isCoachTeam: false, teamId: null, teamName: null, players: [] }}
      />,
    );

    expect(screen.getByText("fila-rffm PEREZ, JOSE")).toBeInTheDocument();
  });

  it("sin comparación disponible muestra el listado RFFM", () => {
    render(<SquadPlayersSection season="22" teamName="CD Ejemplo A" players={rffmPlayers} comparison={null} />);

    expect(screen.getByText("fila-rffm PEREZ, JOSE")).toBeInTheDocument();
  });
});
