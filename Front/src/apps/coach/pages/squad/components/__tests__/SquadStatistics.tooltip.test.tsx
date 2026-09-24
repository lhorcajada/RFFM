import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SquadStatistics from "../SquadStatistics";
import type { PlayerStatistics } from "../../../../services/teamPlayerStatisticsService";
import { buildDailyLoadBreakdown, buildFatigueBreakdown } from "../../../../components/MetricBreakdown/__tests__/breakdownFixtures";

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
    readiness: 40,
    readinessBreakdown: null,
    matchesAbsentAttributableToPlayer: 0,
    minutesPlayedPercentOfSeasonTotal: null,
    attributableAbsentMinutesPercentOfSeasonTotal: null,
    formStatus: null,
    formStatusBreakdown: null,
    ...overrides,
  };
}

describe("SquadStatistics — detalle expandible de rodaje", () => {
  it("muestra el motivo de un día sin actividad al abrir el diálogo de rodaje y pulsar Ver el detalle", () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Lesionado",
            readiness: 40,
            readinessBreakdown: buildDailyLoadBreakdown({
              missedEvents: [{ eventId: "ev-1", date: "2026-08-01T00:00:00Z", eventTypeId: 2, reason: "Lesión" }],
            }),
          }),
        ]}
        loading={false}
      />,
    );

    expect(screen.queryByText(/Lesión/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("player-form-bar-r-toggle"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver el detalle/i }));

    expect(screen.getByText(/Lesión/)).toBeInTheDocument();
  });
});
