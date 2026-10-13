import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SquadStatistics from "../SquadStatistics";
import type { AttributableAbsence, PlayerStatistics } from "../../../../services/teamPlayerStatisticsService";
import { buildFatigueBreakdown } from "../../../../components/MetricBreakdown/__tests__/breakdownFixtures";

const absences: AttributableAbsence[] = [
  { eventId: "m2", date: "2026-10-12T17:00:00Z", eventTypeId: 1, opponent: "CD Rival", matchMinutes: 80, kind: "Declined", reason: "Lesión" },
  { eventId: "m1", date: "2026-10-05T17:00:00Z", eventTypeId: 4, opponent: "UD Vecina", matchMinutes: 70, kind: "NoShow", reason: null },
];

function buildPlayer(overrides: Partial<PlayerStatistics> = {}): PlayerStatistics {
  return {
    teamPlayerId: "p1",
    displayName: "Jugador",
    position: "Delantero",
    dorsal: 1,
    goals: 0,
    yellowCards: 0,
    redCards: 0,
    minutesPlayed: 100,
    trainings: { attended: 0, possible: 0, calledButAbsent: 0 },
    friendlies: { attended: 0, possible: 0, calledButAbsent: 0 },
    league: { attended: 0, possible: 0, calledButAbsent: 0 },
    daysSinceLastInjury: null,
    lastInjuryDurationDays: null,
    fatigue: 20,
    fatigueBreakdown: buildFatigueBreakdown(),
    readiness: 50,
    readinessBreakdown: null,
    matchesAbsentAttributableToPlayer: 2,
    minutesPlayedPercentOfSeasonTotal: 25,
    attributableAbsentMinutesPercentOfSeasonTotal: 37.5,
    minutesPlayedPercentOfAvailable: 41.7,
    minutesTargetStatus: "NotMetByOwnAbsences",
    attributableAbsences: absences,
    leagueAbsences: [],
    formStatus: null,
    formStatusBreakdown: null,
    ...overrides,
  };
}

function renderBlock(overrides: Partial<PlayerStatistics> = {}) {
  render(<SquadStatistics players={[buildPlayer(overrides)]} loading={false} />);
  return within(screen.getByTestId("squad-stat-card-p1")).getByTestId("squad-stat-minutes-target");
}

describe("SquadStatistics — veredicto del objetivo de minutos", () => {
  it("muestra el veredicto con el % sobre sus minutos disponibles", () => {
    const block = renderBlock();
    expect(within(block).getByText("No llega por sus ausencias: 42% de sus minutos disponibles")).toBeInTheDocument();
  });

  it("muestra que cumple el objetivo", () => {
    const block = renderBlock({ minutesTargetStatus: "Met", minutesPlayedPercentOfSeasonTotal: 35 });
    expect(within(block).getByText("Cumple el objetivo")).toBeInTheDocument();
  });

  it("dibuja el tramo de minutos perdidos por sus ausencias", () => {
    const block = renderBlock();
    expect(within(block).getByTestId("minutes-target-absent-segment")).toBeInTheDocument();
  });

  it("no dibuja el tramo de ausencias si no ha perdido minutos por ellas", () => {
    const block = renderBlock({ attributableAbsentMinutesPercentOfSeasonTotal: 0, matchesAbsentAttributableToPlayer: 0, attributableAbsences: [] });
    expect(within(block).queryByTestId("minutes-target-absent-segment")).not.toBeInTheDocument();
  });

  it("ya no muestra 'Partidos no asistidos'", () => {
    const block = renderBlock();
    expect(within(block).queryByText(/Partidos no asistidos/)).not.toBeInTheDocument();
    expect(within(block).queryByRole("button")).not.toBeInTheDocument();
  });

  it("no usa tablas", () => {
    const block = renderBlock();
    expect(block.querySelector("table")).toBeNull();
  });
});
