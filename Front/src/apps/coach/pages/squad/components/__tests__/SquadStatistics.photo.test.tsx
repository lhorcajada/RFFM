import React from "react";
import { render, screen } from "@testing-library/react";
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
    readiness: 40,
    readinessBreakdown: null,
    matchesAbsentAttributableToPlayer: 0,
    minutesPlayedPercentOfSeasonTotal: null,
    attributableAbsentMinutesPercentOfSeasonTotal: null,
    minutesPlayedPercentOfAvailable: null,
    minutesTargetStatus: null,
    attributableAbsences: [],
    formStatus: null,
    formStatusBreakdown: null,
    ...overrides,
  };
}

describe("SquadStatistics — foto del jugador", () => {
  it("muestra la foto del jugador cuando hay una URL disponible", () => {
    render(
      <SquadStatistics
        players={[buildPlayer({ teamPlayerId: "p1", displayName: "Jugador Con Foto" })]}
        loading={false}
        photoUrls={{ p1: "blob:fake-photo-url" }}
      />,
    );

    const photo = screen.getByAltText("Jugador Con Foto") as HTMLImageElement;
    expect(photo).toBeInTheDocument();
    expect(photo.src).toContain("blob:fake-photo-url");
  });

  it("muestra un avatar de respaldo cuando no hay foto disponible", () => {
    render(
      <SquadStatistics
        players={[buildPlayer({ teamPlayerId: "p2", displayName: "Jugador Sin Foto" })]}
        loading={false}
        photoUrls={{}}
      />,
    );

    const photo = screen.getByAltText("Jugador Sin Foto") as HTMLImageElement;
    expect(photo).toBeInTheDocument();
    expect(photo.src).not.toContain("blob:");
  });
});
