import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerConvocationSummaryCard from "../PlayerConvocationSummaryCard";
import type { PlayerConvocationSummary } from "../../../../services/convocationService";

function buildSummary(overrides: Partial<PlayerConvocationSummary> = {}): PlayerConvocationSummary {
  return {
    totalStarts: 12,
    totalConvocations: 15,
    lastDeconvokedMatch: null,
    lastJustifiedAbsenceMatch: null,
    ...overrides,
  };
}

describe("PlayerConvocationSummaryCard", () => {
  it("muestra las titularidades y convocatorias totales", () => {
    render(<PlayerConvocationSummaryCard summary={buildSummary()} loading={false} />);

    expect(screen.getByText("Titularidades")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Convocatorias")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("muestra el placeholder cuando no hay desconvocaciones ni ausencias registradas", () => {
    render(<PlayerConvocationSummaryCard summary={buildSummary()} loading={false} />);

    expect(screen.getByText("Sin desconvocaciones registradas")).toBeInTheDocument();
    expect(screen.getByText("Sin ausencias registradas")).toBeInTheDocument();
  });

  it("muestra rival, tipo y fecha de la última desconvocación cuando existe", () => {
    render(
      <PlayerConvocationSummaryCard
        summary={buildSummary({
          lastDeconvokedMatch: {
            eventId: "ev-1",
            matchDate: "2026-02-10T10:00:00Z",
            rivalName: "CD Rival",
            eventTypeId: 1,
            eventTypeName: "Partido",
          },
        })}
        loading={false}
      />,
    );

    expect(screen.getByText(/CD Rival/)).toBeInTheDocument();
    expect(screen.getByText(/Partido/)).toBeInTheDocument();
    expect(screen.queryByText("Sin desconvocaciones registradas")).not.toBeInTheDocument();
  });

  it("muestra rival, tipo y fecha de la última ausencia justificada cuando existe", () => {
    render(
      <PlayerConvocationSummaryCard
        summary={buildSummary({
          lastJustifiedAbsenceMatch: {
            eventId: "ev-2",
            matchDate: "2026-03-05T10:00:00Z",
            rivalName: "UD Visitante",
            eventTypeId: 3,
            eventTypeName: "Amistoso",
          },
        })}
        loading={false}
      />,
    );

    expect(screen.getByText(/UD Visitante/)).toBeInTheDocument();
    expect(screen.getByText(/Amistoso/)).toBeInTheDocument();
    expect(screen.queryByText("Sin ausencias registradas")).not.toBeInTheDocument();
  });

  it("no muestra contenido de resumen mientras está cargando y no hay datos", () => {
    render(<PlayerConvocationSummaryCard summary={null} loading={true} />);

    expect(screen.queryByText("Titularidades")).not.toBeInTheDocument();
  });
});
