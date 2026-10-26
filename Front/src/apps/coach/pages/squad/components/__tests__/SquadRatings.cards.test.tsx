import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SquadRatings from "../SquadRatings";
import type { PlayerRating } from "../../../../types/playerRating";

function buildRating(teamPlayerId: string, physical: number, technical: number, tactical: number, competitiveness: number): PlayerRating {
  return {
    id: `rating-${teamPlayerId}`,
    teamPlayerId,
    isGoalkeeper: false,
    physical,
    technical,
    tactical,
    competitiveness,
    ratedAt: new Date().toISOString(),
    answers: [{ characteristicKey: "physicalSpeed", level: physical, concept: "Veloz", categoryKey: "physical" }],
  };
}

const players = [
  { teamPlayerId: "p1", displayName: "Ana Lopez", position: "Delantero", dorsal: 10, photoSrc: null },
  { teamPlayerId: "p2", displayName: "Beto Ruiz", position: "Delantero", dorsal: 11, photoSrc: null },
  { teamPlayerId: "p3", displayName: "Carla Sanz", position: "Delantero", dorsal: 7, photoSrc: null },
];

const ratings = {
  p1: buildRating("p1", 7, 8, 6, 9),
  p2: buildRating("p2", 9, 5, 5, 5),
};

function renderRatings(props: Partial<React.ComponentProps<typeof SquadRatings>> = {}) {
  return render(
    <MemoryRouter>
      <SquadRatings teamId="team-1" players={players} latestRatings={ratings} {...props} />
    </MemoryRouter>,
  );
}

function cardOf(name: string) {
  return screen.getByRole("article", { name });
}

describe("SquadRatings — tarjetas de valoración", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = () => {};
  });

  it("muestra la media y las cuatro valoraciones de cada jugador valorado", () => {
    renderRatings();

    const card = within(cardOf("Ana Lopez"));
    expect(card.getByText("7.5")).toBeInTheDocument();
    for (const label of ["Físico", "Técnica", "Táctica", "Competitividad"]) {
      expect(card.getByText(label)).toBeInTheDocument();
    }
    expect(card.getByText("9")).toBeInTheDocument();
  });

  it("indica que un jugador sin valorar no tiene valoración y no muestra barras", () => {
    renderRatings();

    const card = within(cardOf("Carla Sanz"));
    expect(card.getByText("Sin valoración")).toBeInTheDocument();
    expect(card.queryByText("Físico")).not.toBeInTheDocument();
  });

  it("al abrir las subvaloraciones de una tarjeta se cierran las de la anterior", async () => {
    const user = userEvent.setup();
    renderRatings();

    await user.click(within(cardOf("Ana Lopez")).getByTitle("Ver subvaloraciones"));
    await user.click(within(cardOf("Beto Ruiz")).getByTitle("Ver subvaloraciones"));

    expect(within(cardOf("Ana Lopez")).getByTitle("Ver subvaloraciones")).toHaveAttribute("aria-expanded", "false");
    expect(within(cardOf("Beto Ruiz")).getByTitle("Ocultar subvaloraciones")).toHaveAttribute("aria-expanded", "true");
  });

  it("ofrece la ordenación como chips y marca el elegido como pulsado", async () => {
    const user = userEvent.setup();
    renderRatings();

    expect(screen.getByRole("button", { name: "Posición" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Físico" }));

    expect(screen.getByRole("button", { name: "Físico" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Posición" })).toHaveAttribute("aria-pressed", "false");
  });

  it("al ordenar por Físico coloca primero al jugador con más físico y los sin valorar al final", async () => {
    const user = userEvent.setup();
    renderRatings();

    await user.click(screen.getByRole("button", { name: "Físico" }));

    const names = screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"));
    expect(names).toEqual(["Beto Ruiz", "Ana Lopez", "Carla Sanz"]);
  });

  it("ofrece editar la valoración solo cuando no es de solo lectura", () => {
    const { unmount } = renderRatings();
    expect(within(cardOf("Ana Lopez")).getByRole("button", { name: /editar valoración/i })).toBeInTheDocument();
    unmount();

    renderRatings({ readOnly: true });
    expect(screen.queryByRole("button", { name: /editar valoración/i })).not.toBeInTheDocument();
  });

  it("no muestra la barra de ordenación en solo lectura", () => {
    renderRatings({ readOnly: true });

    expect(screen.queryByRole("button", { name: "Posición" })).not.toBeInTheDocument();
  });
});
