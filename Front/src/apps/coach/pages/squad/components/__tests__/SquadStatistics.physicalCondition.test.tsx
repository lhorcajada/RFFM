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

describe("SquadStatistics — Forma física, Cansancio y Disponibilidad", () => {
  it("muestra las filas de Forma física, Cansancio y Disponibilidad con sus valores", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Uno",
            physicalFitness: 64,
            fatigue: 37,
            availability: 27,
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).getByText("Forma física")).toBeInTheDocument();
    expect(within(card).getByText("64%")).toBeInTheDocument();
    expect(within(card).getByText("Cansancio")).toBeInTheDocument();
    expect(within(card).getByText("37%")).toBeInTheDocument();
    expect(within(card).getByText("Disponibilidad")).toBeInTheDocument();
    expect(within(card).getByText("27%")).toBeInTheDocument();
  });

  it("son estadísticas independientes de Rodaje: ambas conviven en la misma tarjeta", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Uno",
            readiness: 82,
            physicalFitness: 64,
            fatigue: 37,
            availability: 27,
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).getByText("82%")).toBeInTheDocument();
    expect(within(card).getByText("64%")).toBeInTheDocument();
    expect(within(card).getByText("37%")).toBeInTheDocument();
    expect(within(card).getByText("27%")).toBeInTheDocument();
  });
});
