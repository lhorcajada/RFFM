import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

describe("SquadStatistics — enlace a la evolución del jugador", () => {
  it("abre la ficha del jugador al pulsar «Ver evolución» en su tarjeta", async () => {
    const onOpenPlayer = vi.fn();
    render(
      <SquadStatistics
        players={[buildPlayer(), buildPlayer({ teamPlayerId: "tp-2", displayName: "Otro" })]}
        loading={false}
        onOpenPlayer={onOpenPlayer}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Ver evolución de Otro" }));

    expect(onOpenPlayer).toHaveBeenCalledWith("tp-2");
  });

  it("no muestra el enlace si no se puede abrir la ficha", () => {
    render(<SquadStatistics players={[buildPlayer()]} loading={false} />);

    expect(screen.queryByRole("button", { name: /ver evolución/i })).not.toBeInTheDocument();
  });
});
