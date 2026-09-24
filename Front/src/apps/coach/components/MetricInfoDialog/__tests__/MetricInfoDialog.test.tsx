import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MetricInfoDialog from "../MetricInfoDialog";
import type { PlayerStatistics } from "../../../services/teamPlayerStatisticsService";
import {
  buildDailyLoadBreakdown,
  buildFatigueBreakdown,
} from "../../MetricBreakdown/__tests__/breakdownFixtures";

function buildPlayer(overrides: Partial<PlayerStatistics> = {}): PlayerStatistics {
  return {
    teamPlayerId: "tp-1",
    displayName: "Jugador",
    position: null,
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
    fatigue: 35,
    fatigueBreakdown: buildFatigueBreakdown(),
    readiness: 60,
    readinessBreakdown: buildDailyLoadBreakdown({
      gainRate: 0.1,
      graceRestDays: 21,
      trainingsAttended: 10,
      matchesPlayed: 3,
      matchMinutesPlayed: 150,
      missedEvents: [{ eventId: "e1", date: "2026-08-01T00:00:00Z", eventTypeId: 2, reason: "Lesión" }],
    }),
    matchesAbsentAttributableToPlayer: 0,
    minutesPlayedPercentOfSeasonTotal: null,
    attributableAbsentMinutesPercentOfSeasonTotal: null,
    minutesPlayedPercentOfAvailable: null,
    minutesTargetStatus: null,
    attributableAbsences: [],
    formStatus: 72,
    formStatusBreakdown: buildDailyLoadBreakdown(),
    ...overrides,
  };
}

describe("MetricInfoDialog", () => {
  it("no muestra nada cuando está cerrado", () => {
    render(<MetricInfoDialog metric="formStatus" player={buildPlayer()} open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("estado de forma: muestra título y las cifras reales del jugador", () => {
    render(
      <MetricInfoDialog
        metric="formStatus"
        player={buildPlayer({
          formStatusBreakdown: buildDailyLoadBreakdown({
            trainingsAttended: 9,
            matchesPlayed: 2,
            matchMinutesPlayed: 134,
            currentRestStreakDays: 2,
          }),
        })}
        open
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Estado de forma")).toBeInTheDocument();
    expect(within(dialog).getByText("Entrenos: 9")).toBeInTheDocument();
    expect(within(dialog).getByText("Partidos jugados: 2 (134')")).toBeInTheDocument();
    expect(within(dialog).getByText("Días seguidos sin actividad: 2")).toBeInTheDocument();
  });

  it("estado de forma: ya no muestra el cansancio porque no le resta", () => {
    render(<MetricInfoDialog metric="formStatus" player={buildPlayer()} open onClose={() => {}} />);
    expect(screen.queryByText(/Cansancio: /)).not.toBeInTheDocument();
    expect(screen.queryByText(/cansado/i)).not.toBeInTheDocument();
  });

  it("estado de forma: explica que baja a partir del 5º día sin actividad", () => {
    render(<MetricInfoDialog metric="formStatus" player={buildPlayer()} open onClose={() => {}} />);
    expect(screen.getByText(/a partir del 5º/)).toBeInTheDocument();
  });

  it("rodaje: muestra entrenos y partidos de las últimas 12 semanas", () => {
    render(<MetricInfoDialog metric="readiness" player={buildPlayer()} open onClose={() => {}} />);
    expect(screen.getByText("Tus números (últimas 12 semanas)")).toBeInTheDocument();
    expect(screen.getByText("Entrenos: 10")).toBeInTheDocument();
    expect(screen.getByText("Partidos jugados: 3 (150')")).toBeInTheDocument();
  });

  it("cansancio: muestra entrenos y partidos con carga de los últimos 14 días", () => {
    render(
      <MetricInfoDialog
        metric="fatigue"
        player={buildPlayer({
          fatigueBreakdown: buildFatigueBreakdown({
            consideredTrainings: [
              { eventId: "a", eventDate: null, trainingTypes: [], daysAgo: 1, decay: 1, typeWeight: 1, contribution: 1 },
            ],
            consideredMatches: [],
          }),
        })}
        open
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Entrenos con carga: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Partidos con carga: 0/)).toBeInTheDocument();
  });

  it("'Ver el detalle' muestra la vista técnica dentro del diálogo", () => {
    render(<MetricInfoDialog metric="readiness" player={buildPlayer()} open onClose={() => {}} />);
    expect(screen.queryByText(/Lesión/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver el detalle/i }));
    expect(screen.getByText(/Lesión/)).toBeInTheDocument();
  });

  it("llama a onClose al pulsar el botón de cerrar", () => {
    const onClose = vi.fn();
    render(<MetricInfoDialog metric="fatigue" player={buildPlayer()} open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("el diálogo está etiquetado con el título de la métrica", () => {
    render(<MetricInfoDialog metric="fatigue" player={buildPlayer()} open onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Cansancio" })).toBeInTheDocument();
  });
});
