import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SquadRanking from "../SquadRanking";
import type { PlayerRating } from "../../../../types/playerRating";

function rating(teamPlayerId: string, physical: number, technical: number, tactical: number, competitiveness: number): PlayerRating {
  return {
    id: `r-${teamPlayerId}`,
    teamPlayerId,
    isGoalkeeper: false,
    physical,
    technical,
    tactical,
    competitiveness,
    ratedAt: "2026-01-01T00:00:00Z",
    answers: [],
  };
}

const player = (id: string, name: string, position = "Delantero") => ({
  teamPlayerId: id,
  displayName: name,
  position,
  dorsal: null,
  photoSrc: null,
});

const players = [
  player("p1", "Ana Lopez"),
  player("p2", "Beto Ruiz"),
  player("p3", "Carla Sanz"),
  player("p4", "Dani Gil"),
  player("p5", "Eva Mora"),
  player("p6", "Fran Sol"),
  player("p7", "Gema Paz"),
];

const latestRatings = {
  p1: rating("p1", 9, 9, 9, 9),
  p2: rating("p2", 8, 8, 8, 8),
  p3: rating("p3", 7, 7, 7, 7),
  p4: rating("p4", 6, 6, 6, 6),
  p5: rating("p5", 6, 6, 6, 6),
  p6: rating("p6", 10, 1, 1, 1),
};

function renderRanking() {
  return render(
    <SquadRanking
      teamId="team-1"
      players={players}
      latestRatings={latestRatings}
      loading={false}
      onRatingCreated={vi.fn()}
    />,
  );
}

describe("SquadRanking — podio y filas", () => {
  it("muestra los tres primeros puestos como tarjetas de podio con su puntuación", () => {
    renderRanking();

    const first = within(screen.getByLabelText("Puesto 1"));
    expect(first.getByText("Ana Lopez")).toBeInTheDocument();
    expect(first.getByText("9.0")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Puesto 2")).getByText("Beto Ruiz")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Puesto 3")).getByText("Carla Sanz")).toBeInTheDocument();
  });

  it("no usa emojis de medalla en el podio", () => {
    renderRanking();

    expect(screen.queryByText("🥇")).not.toBeInTheDocument();
  });

  it("muestra el resto de puestos como filas «#n» con su puntuación", () => {
    renderRanking();

    const row = within(screen.getByLabelText("Puesto 4"));
    expect(row.getByText("#4")).toBeInTheDocument();
    expect(row.getByText("6.0")).toBeInTheDocument();
  });

  it("agrupa a los empatados en el mismo puesto con la etiqueta de empatados", () => {
    renderRanking();

    const row = within(screen.getByLabelText("Puesto 4"));
    expect(row.getByText("Dani Gil")).toBeInTheDocument();
    expect(row.getByText("Eva Mora")).toBeInTheDocument();
    expect(row.getByText("2 empatados")).toBeInTheDocument();
  });

  it("lista a los jugadores sin valoración en «Sin valorar» con un botón «Valorar»", () => {
    renderRanking();

    const section = within(screen.getByRole("region", { name: "Sin valorar" }));
    expect(section.getByText("Gema Paz")).toBeInTheDocument();
    expect(section.getByRole("button", { name: /valorar a gema paz/i })).toBeInTheDocument();
  });
});

describe("SquadRanking — ordenación", () => {
  it("ofrece la ordenación como chips y marca «Media» como pulsado por defecto", () => {
    renderRanking();

    expect(screen.getByRole("button", { name: "Media" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Físico" })).toHaveAttribute("aria-pressed", "false");
  });

  it("al ordenar por Físico cambia el primer puesto", async () => {
    const user = userEvent.setup();
    renderRanking();

    await user.click(screen.getByRole("button", { name: "Físico" }));

    expect(screen.getByRole("button", { name: "Físico" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByLabelText("Puesto 1")).getByText("Fran Sol")).toBeInTheDocument();
  });
});
