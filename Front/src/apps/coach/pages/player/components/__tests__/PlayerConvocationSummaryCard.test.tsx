import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerConvocationSummaryCard from "../PlayerConvocationSummaryCard";
import type { PlayerConvocationSummary } from "../../../../services/convocationService";

function buildSummary(overrides: Partial<PlayerConvocationSummary> = {}): PlayerConvocationSummary {
  return {
    totalStarts: 12,
    totalConvocations: 15,
    totalTrainingConvocations: 8,
    totalFriendlyConvocations: 3,
    totalLeagueConvocations: 4,
    lastDeconvokedMatch: null,
    lastAbsenceMatch: null,
    ...overrides,
  };
}

describe("PlayerConvocationSummaryCard", () => {
  it("muestra las titularidades y el desglose de convocatorias por tipo de evento", () => {
    render(<PlayerConvocationSummaryCard summary={buildSummary()} loading={false} />);

    expect(screen.getByText("Titularidades")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    expect(screen.getByText("Entrenamientos")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Amistosos")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Liga")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
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
