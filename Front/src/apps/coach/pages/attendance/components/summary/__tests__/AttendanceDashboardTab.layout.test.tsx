import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AttendanceDashboardTab from "../AttendanceDashboardTab";
import type { DashboardData, EventAttendancePoint, Summary } from "../types";

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

function buildData(total: Summary, otherEvents = 2): DashboardData {
  const summary: Summary = { events: 2, attend: 3, absent: 1 };
  return {
    total,
    training: { summary, events: buildEvents(2, "Entreno") },
    match: { summary, events: buildEvents(2, "Partido") },
    other: {
      summary: otherEvents === 0 ? { events: 0, attend: 0, absent: 0 } : summary,
      events: buildEvents(otherEvents, "Otro"),
    },
  };
}

const TOTAL: Summary = { events: 20, attend: 648, absent: 142 };

describe("AttendanceDashboardTab — maquetación del Panel", () => {
  it("muestra el anillo global etiquetado con la tasa redondeada", () => {
    render(<AttendanceDashboardTab data={buildData(TOTAL)} />);

    expect(screen.getByRole("img", { name: /asistencia global: 82%/i })).toBeInTheDocument();
  });

  it("muestra los totales de eventos, asisten y no asisten en la tarjeta global", () => {
    render(<AttendanceDashboardTab data={buildData(TOTAL)} />);

    const globalCard = screen.getByText("Resumen global").closest("article") as HTMLElement;
    expect(within(globalCard).getByText("20")).toBeInTheDocument();
    expect(within(globalCard).getByText("648")).toBeInTheDocument();
    expect(within(globalCard).getByText("142")).toBeInTheDocument();
  });

  it("muestra una tarjeta por categoría además de la global", () => {
    render(<AttendanceDashboardTab data={buildData(TOTAL)} />);

    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByText("Entrenamientos")).toBeInTheDocument();
    expect(screen.getByText("Partidos")).toBeInTheDocument();
    expect(screen.getByText("Otros eventos")).toBeInTheDocument();
  });

  it("muestra los chips de totales en cada tarjeta de categoría", () => {
    render(<AttendanceDashboardTab data={buildData(TOTAL)} />);

    const card = screen.getByText("Entrenamientos").closest("article") as HTMLElement;
    expect(within(card).getByText("Eventos")).toBeInTheDocument();
    expect(within(card).getByText("Asisten")).toBeInTheDocument();
    expect(within(card).getByText("No asisten")).toBeInTheDocument();
  });

  it("una categoría sin eventos muestra el estado vacío", () => {
    render(<AttendanceDashboardTab data={buildData(TOTAL, 0)} />);

    const card = screen.getByText("Otros eventos").closest("article") as HTMLElement;
    expect(within(card).getByText(/sin datos de otros eventos/i)).toBeInTheDocument();
  });

  it("no renderiza ninguna tabla", () => {
    const { container } = render(<AttendanceDashboardTab data={buildData(TOTAL)} />);

    expect(container.querySelector("table")).toBeNull();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
