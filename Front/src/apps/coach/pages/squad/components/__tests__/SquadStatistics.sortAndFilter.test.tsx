import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SquadStatistics from "../SquadStatistics";
import type { PlayerStatistics } from "../../../../services/teamPlayerStatisticsService";

function buildPlayer(overrides: Partial<PlayerStatistics> = {}): PlayerStatistics {
  return {
    teamPlayerId: "tp-1",
    displayName: "Jugador",
    position: "Delantero",
    dorsal: 1,
    goals: 0,
    yellowCards: 0,
    redCards: 0,
    minutesPlayed: 0,
    trainingsAttended: 0,
    matchesPlayed: 0,
    daysSinceLastInjury: null,
    lastInjuryDurationDays: null,
    physicalFitness: 60,
    fatigue: 20,
    availability: 40,
    readiness: 50,
    readinessBreakdown: null,
    ...overrides,
  };
}

function cardNamesInOrder(): string[] {
  const cards = screen.getAllByTestId(/^squad-stat-card-/);
  return cards.map((card) => within(card).getByTestId("squad-stat-player-name").textContent ?? "");
}

describe("SquadStatistics — tarjetas y filtros", () => {
  it("renderiza una tarjeta por jugador con sus estadísticas visibles", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({ teamPlayerId: "p1", displayName: "Juan Pérez", dorsal: 9, goals: 3, yellowCards: 1, redCards: 0, minutesPlayed: 450 }),
          buildPlayer({ teamPlayerId: "p2", displayName: "Ana Ruiz", dorsal: 4, goals: 1, yellowCards: 2, redCards: 1, minutesPlayed: 300 }),
        ]}
        loading={false}
      />,
    );

    const juanCard = screen.getByTestId("squad-stat-card-p1");
    expect(within(juanCard).getByText("Juan Pérez")).toBeInTheDocument();
    expect(within(juanCard).getByText("9")).toBeInTheDocument();
    expect(within(juanCard).getByText("3")).toBeInTheDocument();
    expect(within(juanCard).getByText("450")).toBeInTheDocument();

    const anaCard = screen.getByTestId("squad-stat-card-p2");
    expect(within(anaCard).getByText("Ana Ruiz")).toBeInTheDocument();
  });

  it("ordena las tarjetas al elegir Goles en el selector de orden, descendente y luego ascendente", async () => {
    const user = userEvent.setup();
    render(
      <SquadStatistics
        players={[
          buildPlayer({ teamPlayerId: "p1", displayName: "Bajo Goles", goals: 1 }),
          buildPlayer({ teamPlayerId: "p2", displayName: "Alto Goles", goals: 5 }),
          buildPlayer({ teamPlayerId: "p3", displayName: "Medio Goles", goals: 3 }),
        ]}
        loading={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^goles$/i }));

    const directionButton = screen.getByRole("button", { name: /orden (ascendente|descendente)/i });

    // Ensure descending order first
    if (directionButton.getAttribute("aria-label")?.includes("ascendente")) {
      await user.click(directionButton);
    }
    expect(cardNamesInOrder()).toEqual(["Alto Goles", "Medio Goles", "Bajo Goles"]);

    await user.click(screen.getByRole("button", { name: /orden descendente/i }));
    expect(cardNamesInOrder()).toEqual(["Bajo Goles", "Medio Goles", "Alto Goles"]);
  });

  it("filtra las tarjetas por posición seleccionada", async () => {
    const user = userEvent.setup();
    render(
      <SquadStatistics
        players={[
          buildPlayer({ teamPlayerId: "p1", displayName: "Delantero Uno", position: "Delantero" }),
          buildPlayer({ teamPlayerId: "p2", displayName: "Defensa Uno", position: "Defensa" }),
        ]}
        loading={false}
      />,
    );

    expect(screen.getByText("Delantero Uno")).toBeInTheDocument();
    expect(screen.getByText("Defensa Uno")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /posición/i }));
    await user.click(await screen.findByRole("option", { name: "Defensa" }));

    expect(screen.queryByText("Delantero Uno")).not.toBeInTheDocument();
    expect(screen.getByText("Defensa Uno")).toBeInTheDocument();
  });

  it("muestra 'Sin datos' cuando el rodaje es null", () => {
    render(
      <SquadStatistics
        players={[buildPlayer({ teamPlayerId: "p1", displayName: "Nuevo Jugador", readiness: null })]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).getByText("Sin datos")).toBeInTheDocument();
  });
});
