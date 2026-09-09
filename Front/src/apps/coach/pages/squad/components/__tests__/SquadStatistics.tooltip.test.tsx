import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    readiness: 40,
    readinessBreakdown: null,
    ...overrides,
  };
}

describe("SquadStatistics — tooltip de rodaje", () => {
  it("muestra el motivo de una ausencia reciente al pasar el cursor por la barra de rodaje", async () => {
    render(
      <SquadStatistics
        players={[
          buildPlayer({
            teamPlayerId: "p1",
            displayName: "Jugador Lesionado",
            readiness: 40,
            readinessBreakdown: {
              trainingComponent: 30,
              matchComponent: 60,
              trainingSessionsConsidered: 10,
              trainingSessionsBaseline: 16,
              matchMinutesInWindow: 150,
              matchMinutesExpected: 560,
              recentAbsences: [
                { eventId: "ev-1", date: "2026-08-01T00:00:00Z", reason: "Lesión", pointsImpact: -90 },
              ],
            },
          }),
        ]}
        loading={false}
      />,
    );

    const readinessCell = screen.getByTestId("readiness-cell-p1");

    fireEvent.mouseOver(readinessCell);

    await waitFor(() => {
      expect(screen.getByText(/Lesión/)).toBeInTheDocument();
    });
  });
});
