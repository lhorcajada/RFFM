import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerConvocationSummaryCard from "../PlayerConvocationSummaryCard";
import type { PlayerConvocationSummary } from "../../../../services/convocationService";

function buildSummary(overrides: Partial<PlayerConvocationSummary> = {}): PlayerConvocationSummary {
  return {
    totalStarts: 12,
    trainings: { attended: 8, possible: 9, calledButAbsent: 0 },
    friendlies: { attended: 3, possible: 4, calledButAbsent: 0 },
    league: { attended: 4, possible: 5, calledButAbsent: 0 },
    lastDeconvokedMatch: null,
    lastAbsenceMatch: null,
    ...overrides,
  };
}

describe("PlayerConvocationSummaryCard", () => {
  it("muestra las titularidades y el ratio de asistidos/finalizados por tipo de evento", () => {
    render(<PlayerConvocationSummaryCard summary={buildSummary()} loading={false} />);

    expect(screen.getByText("Titularidades")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    expect(screen.getByText("Entrenamientos")).toBeInTheDocument();
    expect(screen.getByText("8 de 9")).toBeInTheDocument();
    expect(screen.getByText("Amistosos")).toBeInTheDocument();
    expect(screen.getByText("3 de 4")).toBeInTheDocument();
    expect(screen.getByText("Liga")).toBeInTheDocument();
    expect(screen.getByText("4 de 5")).toBeInTheDocument();
  });

  it("muestra la nota de convocado-no-asistió en Amistosos y Liga, pero no en Entrenamientos", () => {
    render(
      <PlayerConvocationSummaryCard
        summary={buildSummary({
          trainings: { attended: 5, possible: 9, calledButAbsent: 2 },
          friendlies: { attended: 2, possible: 4, calledButAbsent: 1 },
          league: { attended: 3, possible: 5, calledButAbsent: 2 },
        })}
        loading={false}
      />,
    );

    expect(screen.getByText("No asistió a 1 partido al que fue convocado")).toBeInTheDocument();
    expect(screen.getByText("No asistió a 2 partidos a los que fue convocado")).toBeInTheDocument();
    // Trainings tile also has calledButAbsent=2, but its note must not be rendered.
    expect(screen.getAllByText(/No asistió a \d+/)).toHaveLength(2);
  });

  it("muestra el placeholder cuando no hay desconvocatorias ni ausencias registradas", () => {
    render(<PlayerConvocationSummaryCard summary={buildSummary()} loading={false} />);

    expect(screen.getByText("Sin desconvocatorias registradas")).toBeInTheDocument();
    expect(screen.getByText("Sin ausencias registradas")).toBeInTheDocument();
  });

  it("muestra rival, tipo, fecha y motivo de la última desconvocatoria cuando existe", () => {
    render(
      <PlayerConvocationSummaryCard
        summary={buildSummary({
          lastDeconvokedMatch: {
            eventId: "ev-1",
            matchDate: "2026-02-10T10:00:00Z",
            rivalName: "CD Rival",
            eventTypeId: 1,
            eventTypeName: "Partido",
            reason: "Decisión técnica",
          },
        })}
        loading={false}
      />,
    );

    expect(screen.getByText("Última desconvocatoria")).toBeInTheDocument();
    expect(screen.getByText(/CD Rival/)).toBeInTheDocument();
    expect(screen.getByText(/Partido/)).toBeInTheDocument();
    expect(screen.getByText(/Motivo: Decisión técnica/)).toBeInTheDocument();
    expect(screen.queryByText("Sin desconvocatorias registradas")).not.toBeInTheDocument();
  });

  it("muestra rival, tipo, fecha y motivo de la última ausencia cuando existe", () => {
    render(
      <PlayerConvocationSummaryCard
        summary={buildSummary({
          lastAbsenceMatch: {
            eventId: "ev-2",
            matchDate: "2026-03-05T10:00:00Z",
            rivalName: "UD Visitante",
            eventTypeId: 4,
            eventTypeName: "Amistoso",
            reason: "Enfermedad",
          },
        })}
        loading={false}
      />,
    );

    expect(screen.getByText(/UD Visitante · Amistoso ·/)).toBeInTheDocument();
    expect(screen.getByText(/Motivo: Enfermedad/)).toBeInTheDocument();
    expect(screen.queryByText("Sin ausencias registradas")).not.toBeInTheDocument();
  });

  it("no muestra motivo cuando la ausencia no tiene motivo registrado", () => {
    render(
      <PlayerConvocationSummaryCard
        summary={buildSummary({
          lastAbsenceMatch: {
            eventId: "ev-3",
            matchDate: "2026-03-06T10:00:00Z",
            rivalName: "UD Sin Motivo",
            eventTypeId: 4,
            eventTypeName: "Amistoso",
            reason: null,
          },
        })}
        loading={false}
      />,
    );

    expect(screen.getByText(/UD Sin Motivo/)).toBeInTheDocument();
    expect(screen.queryByText(/Motivo:/)).not.toBeInTheDocument();
  });

  it("no muestra contenido de resumen mientras está cargando y no hay datos", () => {
    render(<PlayerConvocationSummaryCard summary={null} loading={true} />);

    expect(screen.queryByText("Titularidades")).not.toBeInTheDocument();
  });
});
