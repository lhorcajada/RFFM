import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MetricInfoDialog from "../MetricInfoDialog";
import type { PlayerStatistics } from "../../../services/teamPlayerStatisticsService";
import {
  buildFatigueBreakdown,
  buildFormStatusBreakdown,
  buildReadinessBreakdown,
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
    readinessBreakdown: buildReadinessBreakdown({
      recentAbsences: [{ eventId: "e1", date: "2026-08-01T00:00:00Z", reason: "Lesión", pointsImpact: -90 }],
    }),
    matchesAbsentAttributableToPlayer: 0,
    minutesPlayedPercentOfSeasonTotal: null,
    attributableAbsentMinutesPercentOfSeasonTotal: null,
    formStatus: 72,
    formStatusBreakdown: buildFormStatusBreakdown(),
    ...overrides,
  };
}

describe("MetricInfoDialog", () => {
  it("no muestra nada cuando está cerrado", () => {
    render(<MetricInfoDialog metric="formStatus" player={buildPlayer()} open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("estado de forma: muestra título y las cifras reales del jugador", () => {
    render(<MetricInfoDialog metric="formStatus" player={buildPlayer({ formStatusBreakdown: buildFormStatusBreakdown({ matchMinutesPlayedTotal: 134, matchMinutesPossibleTotal: 160, matchesConsidered: 2 }) })} open onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Estado de forma")).toBeInTheDocument();
    expect(within(dialog).getByText(/Sesiones: 2 de 12/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Minutos de partido: 134 de 160 posibles \(2 partidos\)/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Cansancio: 35%/)).toBeInTheDocument();
  });

  it("estado de forma: avisa cuando el equipo no ha jugado partidos", () => {
    render(
      <MetricInfoDialog
        metric="formStatus"
        player={buildPlayer({ formStatusBreakdown: buildFormStatusBreakdown({ matchComponent: null }) })}
        open
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/todavía no ha jugado partidos/i)).toBeInTheDocument();
  });

  it("rodaje: muestra sesiones y minutos de las últimas 8 semanas", () => {
    render(<MetricInfoDialog metric="readiness" player={buildPlayer()} open onClose={() => {}} />);
    expect(screen.getByText(/Sesiones: 10 de 16/)).toBeInTheDocument();
    expect(screen.getByText(/Minutos de partido: 150 de 560/)).toBeInTheDocument();
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
