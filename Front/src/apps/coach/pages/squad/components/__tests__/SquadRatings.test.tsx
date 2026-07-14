import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SquadRatings from "../SquadRatings";
import type { PlayerRating } from "../../../types/playerRating";

function buildRating(): PlayerRating {
  return {
    id: "rating-1",
    teamPlayerId: "player-1",
    isGoalkeeper: false,
    physical: 7,
    technical: 8,
    tactical: 6,
    competitiveness: 9,
    ratedAt: new Date().toISOString(),
    answers: [
      {
        characteristicKey: "physicalSpeed",
        level: 7,
        concept: "Veloz",
        categoryKey: "physical",
      },
      {
        characteristicKey: "technicalDribbling",
        level: 8,
        concept: "Buen regate",
        categoryKey: "technical",
      },
    ],
  };
}

function renderSquadRatings(playerOverrides: Partial<{ alias: string | null }> = {}) {
  const rating = buildRating();
  render(
    <MemoryRouter>
      <SquadRatings
        teamId="team-1"
        players={[
          {
            teamPlayerId: "player-1",
            displayName: "Juan Pérez",
            alias: playerOverrides.alias,
            position: "Delantero",
            dorsal: 9,
            photoSrc: null,
          },
        ]}
        latestRatings={{ "player-1": rating }}
      />
    </MemoryRouter>,
  );
  return rating;
}

describe("SquadRatings — alias del jugador", () => {
  it("muestra el alias en vez del nombre completo cuando el jugador tiene alias", () => {
    renderSquadRatings({ alias: "Juanito" });

    expect(screen.getByText("Juanito")).toBeInTheDocument();
    expect(screen.queryByText("Juan Pérez")).not.toBeInTheDocument();
  });

  it("usa el nombre completo como fallback cuando no hay alias", () => {
    renderSquadRatings({ alias: null });

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
  });

  it("el aria-label del panel expandido usa el alias en vez del nombre completo", async () => {
    const user = userEvent.setup();
    renderSquadRatings({ alias: "Juanito" });

    await user.click(screen.getByTitle("Ver subvaloraciones"));

    expect(screen.getByRole("region", { name: /Juanito/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Juan Pérez/i })).not.toBeInTheDocument();
  });
});

describe("SquadRatings — panel de subvaloraciones responsive", () => {
  it("el botón de expandir tiene aria-expanded=false y aria-controls apuntando al panel antes de abrir", () => {
    renderSquadRatings();

    const toggle = screen.getByTitle("Ver subvaloraciones");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    const panelId = toggle.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId as string)).not.toBeNull();
  });

  it("al expandir, el panel expone role=region con aria-label del jugador y aria-expanded pasa a true", async () => {
    const user = userEvent.setup();
    renderSquadRatings();

    await user.click(screen.getByTitle("Ver subvaloraciones"));

    const toggle = screen.getByTitle("Ocultar subvaloraciones");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const region = screen.getByRole("region", { name: /Juan Pérez/i });
    expect(region).toBeInTheDocument();
    expect(within(region).getByText("Veloz")).toBeInTheDocument();
    expect(within(region).getByText("Buen regate")).toBeInTheDocument();
  });

  it("muestra un botón de cerrar dedicado dentro del panel expandido (para el diseño de hoja inferior en móvil/tablet) que colapsa el panel al pulsarlo", async () => {
    const user = userEvent.setup();
    renderSquadRatings();

    await user.click(screen.getByTitle("Ver subvaloraciones"));

    const closeBtn = screen.getByRole("button", { name: /cerrar valoraciones/i });
    expect(closeBtn).toBeInTheDocument();

    await user.click(closeBtn);

    expect(screen.getByTitle("Ver subvaloraciones")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: /Juan Pérez/i })).not.toBeInTheDocument();
  });

  it("al expandir, el panel se lleva a la vista con scrollIntoView (evita que en móvil parezca vacío hasta hacer scroll manual)", async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();
    // jsdom no implementa scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    renderSquadRatings();
    await user.click(screen.getByTitle("Ver subvaloraciones"));

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );
  });

  it("el panel expandido renderiza todas las categorías y sub-valoraciones sin recortar información", async () => {
    const user = userEvent.setup();
    renderSquadRatings();

    await user.click(screen.getByTitle("Ver subvaloraciones"));

    const region = screen.getByRole("region", { name: /Juan Pérez/i });
    expect(within(region).getByText("Físico")).toBeInTheDocument();
    expect(within(region).getByText("Técnica")).toBeInTheDocument();
    expect(within(region).getByText("Velocidad")).toBeInTheDocument();
    expect(within(region).getByText("Regate")).toBeInTheDocument();
  });
});
