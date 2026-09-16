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
    trainings: { attended: 0, possible: 0, calledButAbsent: 0 },
    friendlies: { attended: 0, possible: 0, calledButAbsent: 0 },
    league: { attended: 0, possible: 0, calledButAbsent: 0 },
    daysSinceLastInjury: null,
    lastInjuryDurationDays: null,
    fatigue: 20,
    readiness: 50,
    readinessBreakdown: null,
    matchesAbsentAttributableToPlayer: 0,
    minutesPlayedPercentOfSeasonTotal: null,
    attributableAbsentMinutesPercentOfSeasonTotal: null,
    ...overrides,
  };
}

describe("SquadStatistics — ausencias imputables y objetivo de minutos de temporada", () => {
  it("muestra el stat de Ausencias con el número de partidos imputables al jugador", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Ausente",
            matchesAbsentAttributableToPlayer: 3,
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).getByText("3")).toBeInTheDocument();
    expect(within(card).getByText("Ausencias")).toBeInTheDocument();
  });

  it("muestra el bloque de objetivo de minutos cuando minutesPlayedPercentOfSeasonTotal no es null", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador F11",
            minutesPlayedPercentOfSeasonTotal: 42.6,
            attributableAbsentMinutesPercentOfSeasonTotal: 12.4,
            matchesAbsentAttributableToPlayer: 2,
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    const block = within(card).getByTestId("squad-stat-minutes-target");
    expect(block).toBeInTheDocument();
    expect(within(block).getByText("% minutos jugados")).toBeInTheDocument();
    expect(within(block).getByText(/objetivo mínimo: 30%/i)).toBeInTheDocument();
    expect(within(block).getByText("43%")).toBeInTheDocument();
    expect(within(block).getByText("Partidos no asistidos: 2")).toBeInTheDocument();
  });

  it("muestra un mensaje positivo cuando no hay ausencias propias del jugador", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Sin Ausencias",
            minutesPlayedPercentOfSeasonTotal: 55,
            attributableAbsentMinutesPercentOfSeasonTotal: 0,
            matchesAbsentAttributableToPlayer: 0,
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    const block = within(card).getByTestId("squad-stat-minutes-target");
    expect(within(block).getByText("Partidos no asistidos: 0")).toBeInTheDocument();
  });

  it("no muestra el bloque de objetivo de minutos cuando minutesPlayedPercentOfSeasonTotal es null (equipo no F11)", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador No F11",
            minutesPlayedPercentOfSeasonTotal: null,
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).queryByTestId("squad-stat-minutes-target")).not.toBeInTheDocument();
  });
});
