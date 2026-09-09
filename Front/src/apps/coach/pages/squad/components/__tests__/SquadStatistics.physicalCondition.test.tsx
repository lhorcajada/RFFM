import React from "react";
import { render, screen, within } from "@testing-library/react";
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

describe("SquadStatistics — Ef, Rodaje y Cansancio", () => {
  it("muestra Ef (Rodaje - Cansancio), Rodaje y Cansancio con sus valores, ya no Forma física ni Disponibilidad", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Uno",
            readiness: 70,
            fatigue: 20,
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).getByText("Ef")).toBeInTheDocument();
    expect(within(card).getByText("Rodaje")).toBeInTheDocument();
    expect(within(card).getByText("Cansancio")).toBeInTheDocument();
    // Ef = max(0, min(100, 70 - 20)) = 50
    expect(within(card).getByTestId("player-form-bar-ef")).toHaveTextContent("50%");
    expect(within(card).getByTestId("player-form-bar-r")).toHaveTextContent("70%");
    expect(within(card).getByTestId("player-form-bar-c")).toHaveTextContent("20%");

    expect(within(card).queryByText("Forma física")).not.toBeInTheDocument();
    expect(within(card).queryByText("Disponibilidad")).not.toBeInTheDocument();
  });

  it("muestra la leyenda consolidada única de Ef/Rodaje/Cansancio en la pantalla", () => {
    render(<SquadStatistics players={[buildPlayer()]} loading={false} />);
    expect(screen.getByLabelText(/Leyenda de Ef, Rodaje y Cansancio/i)).toBeInTheDocument();
  });
});
