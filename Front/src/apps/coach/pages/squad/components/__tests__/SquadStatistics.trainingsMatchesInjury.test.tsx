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
    physicalFitness: 60,
    fatigue: 20,
    availability: 40,
    readiness: 50,
    readinessBreakdown: null,
    ...overrides,
  };
}

describe("SquadStatistics — entrenamientos, partidos y lesión reciente", () => {
  it("muestra el ratio de entrenamientos/amistosos/liga asistidos vs posibles en la tarjeta", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Activo",
            trainings: { attended: 12, possible: 14, calledButAbsent: 0 },
            friendlies: { attended: 2, possible: 3, calledButAbsent: 0 },
            league: { attended: 7, possible: 8, calledButAbsent: 0 },
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).getByText("12 de 14")).toBeInTheDocument();
    expect(within(card).getByText("2 de 3")).toBeInTheDocument();
    expect(within(card).getByText("7 de 8")).toBeInTheDocument();
  });

  it("muestra una línea indicando cuántas veces fue convocado pero no asistió, solo en amistosos y liga (no en entrenamientos)", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Ausente",
            trainings: { attended: 3, possible: 5, calledButAbsent: 1 },
            friendlies: { attended: 0, possible: 2, calledButAbsent: 1 },
            league: { attended: 4, possible: 4, calledButAbsent: 0 },
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    const notAttendedTexts = within(card).getAllByText((_, el) => el?.textContent === "1 convocado, no asistió");
    // Only the "Amistosos" tile shows the note here — trainings never shows it, league's
    // calledButAbsent is 0 in this fixture so it shows nothing either.
    expect(notAttendedTexts).toHaveLength(1);
  });

  it("no muestra la línea de 'no asistió' en entrenamientos aunque calledButAbsent sea > 0", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Ausente En Entreno",
            trainings: { attended: 3, possible: 5, calledButAbsent: 2 },
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).queryByText(/convocado.*no asisti/)).not.toBeInTheDocument();
  });

  it("no muestra la línea de 'no asistió' cuando calledButAbsent es 0", () => {
    render(
      <SquadStatistics
        players={[buildPlayer({ teamPlayerId: "p1", displayName: "Jugador Sin Ausencias" })]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).queryByText(/convocado, no asisti/)).not.toBeInTheDocument();
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
