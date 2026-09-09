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
    readiness: 50,
    readinessBreakdown: null,
    ...overrides,
  };
}

describe("SquadStatistics — entrenamientos, partidos y lesión reciente", () => {
  it("muestra entrenamientos asistidos y partidos jugados en la tarjeta", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({ teamPlayerId: "p1", displayName: "Jugador Activo", trainingsAttended: 12, matchesPlayed: 7 }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).getByText("12")).toBeInTheDocument();
    expect(within(card).getByText("7")).toBeInTheDocument();
  });

  it("muestra la línea de lesión reciente con días de baja cuando la lesión ya ha terminado", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Recuperado",
            daysSinceLastInjury: 20,
            lastInjuryDurationDays: 15,
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).getByText(/Lesión: hace 20 días \(15 días de baja\)/)).toBeInTheDocument();
  });

  it("muestra la lesión como 'en curso' cuando no tiene duración todavía", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Lesionado",
            daysSinceLastInjury: 3,
            lastInjuryDurationDays: null,
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).getByText(/Lesión: hace 3 días \(en curso\)/)).toBeInTheDocument();
  });

  it("no muestra la línea de lesión si el jugador nunca se ha lesionado", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({ teamPlayerId: "p1", displayName: "Jugador Sano", daysSinceLastInjury: null }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).queryByText(/Lesión:/)).not.toBeInTheDocument();
  });
});
