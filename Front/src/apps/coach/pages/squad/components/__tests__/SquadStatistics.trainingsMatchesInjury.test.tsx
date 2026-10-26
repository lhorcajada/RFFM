import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SquadStatistics from "../SquadStatistics";
import type { PlayerStatistics } from "../../../../services/teamPlayerStatisticsService";
import { buildFatigueBreakdown } from "../../../../components/MetricBreakdown/__tests__/breakdownFixtures";

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
    fatigueBreakdown: buildFatigueBreakdown({ trainingComponent: 15, matchComponent: 25, decayedMatchMinutes: 40 }),
    readiness: 50,
    readinessBreakdown: null,
    matchesAbsentAttributableToPlayer: 0,
    minutesPlayedPercentOfSeasonTotal: null,
    attributableAbsentMinutesPercentOfSeasonTotal: null,
    minutesPlayedPercentOfAvailable: null,
    minutesTargetStatus: null,
    attributableAbsences: [],
    leagueAbsences: [],
    formStatus: null,
    formStatusBreakdown: null,
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

  it("no repite en la tarjeta que fue convocado a un amistoso y no asistió: el detalle va en el desplegable", () => {
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
    expect(within(card).queryByText(/No asistió a/)).not.toBeInTheDocument();
  });

  it("en liga no dice que fue convocado: explica cada ausencia con su motivo", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador No Disponible",
            league: { attended: 0, possible: 2, calledButAbsent: 1 },
            leagueAbsences: [
              { eventId: "l2", date: "2026-10-12T17:00:00Z", opponent: "CD Rival", kind: "TechnicalDecision", reason: "Decisión técnica" },
              { eventId: "l1", date: "2026-10-05T17:00:00Z", opponent: "UD Vecina", kind: "Unavailable", reason: "Lesión" },
            ],
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).queryByText(/al que fue convocado/)).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Ver ausencias (2)" }));
    const items = within(within(card).getByRole("list", { name: "Ausencias en partidos" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("12/10 · Liga vs CD Rival · No asistió por decisión técnica");
    expect(items[1]).toHaveTextContent("05/10 · Liga vs UD Vecina · No asistió porque no estaba disponible por lesión");
  });

  it("lista también las ausencias imputables de amistosos, sin tablas", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            friendlies: { attended: 0, possible: 1, calledButAbsent: 1 },
            attributableAbsences: [
              { eventId: "f1", date: "2026-10-05T17:00:00Z", eventTypeId: 4, opponent: "UD Vecina", matchMinutes: 70, kind: "NoShow", reason: null },
            ],
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    fireEvent.click(within(card).getByRole("button", { name: "Ver ausencias (1)" }));
    const list = within(card).getByRole("list", { name: "Ausencias en partidos" });
    expect(within(list).getByRole("listitem")).toHaveTextContent("05/10 · Amistoso vs UD Vecina · 70' · No se presentó");
    expect(card.querySelector("table")).toBeNull();
  });

  it("la lista de ausencias está plegada hasta que se pulsa 'Ver ausencias'", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            leagueAbsences: [
              { eventId: "l1", date: "2026-10-05T17:00:00Z", opponent: "UD Vecina", kind: "Unavailable", reason: "Lesión" },
            ],
          }),
        ]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    const toggle = within(card).getByRole("button", { name: "Ver ausencias (1)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(card).queryByRole("list", { name: "Ausencias en partidos" })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(card).getByRole("list", { name: "Ausencias en partidos" })).toBeInTheDocument();
  });

  it("no muestra ni el botón ni la lista de ausencias si no ha faltado a ningún partido", () => {
    render(<SquadStatistics players={[buildPlayer({ teamPlayerId: "p1" })]} loading={false} />);

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).queryByRole("button", { name: /Ver ausencias/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("list", { name: "Ausencias en partidos" })).not.toBeInTheDocument();
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
    expect(within(card).queryByText(/No asistió a/)).not.toBeInTheDocument();
  });

  it("no muestra la línea de 'no asistió' cuando calledButAbsent es 0", () => {
    render(
      <SquadStatistics
        players={[buildPlayer({ teamPlayerId: "p1", displayName: "Jugador Sin Ausencias" })]}
        loading={false}
      />,
    );

    const card = screen.getByTestId("squad-stat-card-p1");
    expect(within(card).queryByText(/No asistió a/)).not.toBeInTheDocument();
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
