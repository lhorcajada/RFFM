import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AttendanceDashboardTab from "../AttendanceDashboardTab";
import type { DashboardData, EventAttendancePoint, Summary } from "../types";

function buildSummary(overrides: Partial<Summary> = {}): Summary {
  return { events: 2, attend: 3, absent: 1, ...overrides };
}

function buildEvents(count: number, prefix: string): EventAttendancePoint[] {
  return Array.from({ length: count }, (_, i) => ({
    eventId: `${prefix}-${i + 1}`,
    label: `${prefix}${i + 1}`,
    date: `2026-01-0${i + 1}T10:00:00Z`,
    title: `${prefix} evento ${i + 1}`,
    total: 4,
    attend: 3,
    absent: 1,
  }));
}

function buildData(overrides: Partial<DashboardData> = {}): DashboardData {
  const summary = buildSummary();
  return {
    total: summary,
    training: { summary, events: buildEvents(2, "Entreno") },
    match: { summary, events: buildEvents(2, "Partido") },
    other: { summary, events: buildEvents(2, "Otro") },
    ...overrides,
  };
}

describe("AttendanceDashboardTab — sin cálculo de pendientes", () => {
  it("no muestra la métrica 'Pendientes' en ninguna tarjeta", () => {
    render(<AttendanceDashboardTab data={buildData()} />);

    expect(screen.queryByText("Pendientes")).not.toBeInTheDocument();
  });

  it("Resumen global calcula la tasa de asistencia solo con asisten/no asisten (sin pendientes)", () => {
    // attend: 3, absent: 1 -> rate = 3/(3+1) = 75%
    const summary = buildSummary({ attend: 3, absent: 1 });
    render(<AttendanceDashboardTab data={buildData({ total: summary })} />);

    const globalCard = screen.getByText("Resumen global").closest("article") as HTMLElement;
    expect(within(globalCard).getByText("75%")).toBeInTheDocument();
  });
});

describe("AttendanceDashboardTab — Resumen global sin cambios", () => {
  it("sigue mostrando un único porcentaje y los tres totales (Eventos/Asisten/No asisten)", () => {
    render(<AttendanceDashboardTab data={buildData()} />);

    const globalCard = screen.getByText("Resumen global").closest("article") as HTMLElement;
    expect(within(globalCard).getByText("Eventos")).toBeInTheDocument();
    expect(within(globalCard).getByText("Asisten")).toBeInTheDocument();
    expect(within(globalCard).getByText("No asisten")).toBeInTheDocument();
  });
});

describe("AttendanceDashboardTab — tarjetas de categoría usan AttendanceEventChart", () => {
  it("Entrenamientos/Partidos/Otros muestran su propio slice de events/aggregate de DashboardData", () => {
    const data = buildData();
    render(<AttendanceDashboardTab data={data} />);

    const trainingCard = screen.getByText("Entrenamientos").closest("article") as HTMLElement;
    const matchCard = screen.getByText("Partidos").closest("article") as HTMLElement;
    const otherCard = screen.getByText("Otros eventos").closest("article") as HTMLElement;

    expect(within(trainingCard).getByRole("button", { name: /entreno evento 1/i })).toBeInTheDocument();
    expect(within(matchCard).getByRole("button", { name: /partido evento 1/i })).toBeInTheDocument();
    expect(within(otherCard).getByRole("button", { name: /otro evento 1/i })).toBeInTheDocument();

    // Each card's header aggregate % reflects its own `summary`, not the others'.
    expect(within(trainingCard).getByText("75%")).toBeInTheDocument();
    expect(within(matchCard).getByText("75%")).toBeInTheDocument();
    expect(within(otherCard).getByText("75%")).toBeInTheDocument();
  });

  it("una categoría sin eventos finalizados muestra el estado vacío en vez de un gráfico", () => {
    const data = buildData({ other: { summary: buildSummary({ events: 0, attend: 0, absent: 0 }), events: [] } });
    render(<AttendanceDashboardTab data={data} />);

    const otherCard = screen.getByText("Otros eventos").closest("article") as HTMLElement;
    expect(within(otherCard).getByText(/sin datos de otros eventos/i)).toBeInTheDocument();
  });
});
