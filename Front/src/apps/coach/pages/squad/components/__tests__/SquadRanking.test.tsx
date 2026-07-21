import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SquadRanking from "../SquadRanking";
import type { PlayerRating } from "../../../types/playerRating";

function buildRating(overrides: Partial<PlayerRating> = {}): PlayerRating {
  return {
    id: "rating-1",
    teamPlayerId: "player-1",
    isGoalkeeper: false,
    physical: 7,
    technical: 8,
    tactical: 6,
    competitiveness: 9,
    ratedAt: new Date().toISOString(),
    answers: [],
    ...overrides,
  };
}

type PlayerOverride = {
  teamPlayerId: string;
  displayName: string;
  alias?: string | null;
  score: number;
};

function renderSquadRanking(players: PlayerOverride[], unrated: PlayerOverride[] = []) {
  const latestRatings: Record<string, PlayerRating> = {};
  for (const p of players) {
    latestRatings[p.teamPlayerId] = buildRating({
      teamPlayerId: p.teamPlayerId,
      technical: p.score,
      tactical: p.score,
      physical: p.score,
      competitiveness: p.score,
    });
  }

  const allPlayers = [...players, ...unrated].map((p) => ({
    teamPlayerId: p.teamPlayerId,
    displayName: p.displayName,
    alias: p.alias,
    position: "Delantero",
    dorsal: 1,
    photoSrc: null,
  }));

  render(
    <SquadRanking
      teamId="team-1"
      players={allPlayers}
      latestRatings={latestRatings}
      loading={false}
      onRatingCreated={vi.fn()}
    />,
  );
}

describe("SquadRanking — alias del jugador", () => {
  it("muestra el alias en vez del nombre completo en el podio", () => {
    renderSquadRanking([
      { teamPlayerId: "p1", displayName: "Juan Pérez", alias: "Juanito", score: 10 },
      { teamPlayerId: "p2", displayName: "Pedro Gómez", score: 9 },
      { teamPlayerId: "p3", displayName: "Ana Ruiz", score: 8 },
    ]);

    expect(screen.getByText("Juanito")).toBeInTheDocument();
    expect(screen.queryByText("Juan Pérez")).not.toBeInTheDocument();
  });

  it("usa el nombre completo como fallback en el podio cuando no hay alias", () => {
    renderSquadRanking([
      { teamPlayerId: "p1", displayName: "Juan Pérez", score: 10 },
      { teamPlayerId: "p2", displayName: "Pedro Gómez", score: 9 },
      { teamPlayerId: "p3", displayName: "Ana Ruiz", score: 8 },
    ]);

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
  });

  it("muestra el alias en vez del nombre completo en los tiers normales (fuera del podio)", () => {
    renderSquadRanking([
      { teamPlayerId: "p1", displayName: "Juan Pérez", score: 10 },
      { teamPlayerId: "p2", displayName: "Pedro Gómez", score: 9 },
      { teamPlayerId: "p3", displayName: "Ana Ruiz", score: 8 },
      { teamPlayerId: "p4", displayName: "Carlos Fernández Largo", alias: "Carlitos", score: 7 },
    ]);

    expect(screen.getByText("Carlitos")).toBeInTheDocument();
    expect(screen.queryByText("Carlos Fernández Largo")).not.toBeInTheDocument();
  });

  it("usa el nombre completo como fallback en los tiers normales cuando no hay alias", () => {
    renderSquadRanking([
      { teamPlayerId: "p1", displayName: "Juan Pérez", score: 10 },
      { teamPlayerId: "p2", displayName: "Pedro Gómez", score: 9 },
      { teamPlayerId: "p3", displayName: "Ana Ruiz", score: 8 },
      { teamPlayerId: "p4", displayName: "Carlos Fernández Largo", score: 7 },
    ]);

    expect(screen.getByText("Carlos Fernández Largo")).toBeInTheDocument();
  });

  it("muestra el alias en vez del nombre completo en la sección 'Sin valorar'", () => {
    renderSquadRanking(
      [{ teamPlayerId: "p1", displayName: "Juan Pérez", score: 10 }],
      [{ teamPlayerId: "p5", displayName: "Sin Valorar Nombre Largo", alias: "SinVal", score: 0 }],
    );

    expect(screen.getByText("SinVal")).toBeInTheDocument();
    expect(screen.queryByText("Sin Valorar Nombre Largo")).not.toBeInTheDocument();
  });

  it("usa el nombre completo como fallback en 'Sin valorar' cuando alias es vacío o solo espacios", () => {
    renderSquadRanking(
      [{ teamPlayerId: "p1", displayName: "Juan Pérez", score: 10 }],
      [{ teamPlayerId: "p5", displayName: "Sin Valorar Nombre", alias: "   ", score: 0 }],
    );

    expect(screen.getByText("Sin Valorar Nombre")).toBeInTheDocument();
  });

  it("usa el nombre completo como fallback cuando alias es null o undefined", () => {
    renderSquadRanking(
      [{ teamPlayerId: "p1", displayName: "Juan Pérez", score: 10 }],
      [{ teamPlayerId: "p5", displayName: "Otro Jugador", alias: null, score: 0 }],
    );

    expect(screen.getByText("Otro Jugador")).toBeInTheDocument();
  });
});
