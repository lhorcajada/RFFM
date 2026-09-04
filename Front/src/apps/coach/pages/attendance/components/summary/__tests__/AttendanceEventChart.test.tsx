import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AttendanceEventChart from "../AttendanceEventChart";
import type { EventAttendancePoint, Summary } from "../types";

function makeEvent(overrides: Partial<EventAttendancePoint> = {}): EventAttendancePoint {
  return {
    eventId: "event-1",
    label: "E1",
    date: "2026-01-05T10:00:00Z",
    title: "Entrenamiento 1",
    total: 10,
    attend: 8,
    absent: 2,
    ...overrides,
  };
}

function makeEvents(count: number): EventAttendancePoint[] {
  return Array.from({ length: count }, (_, i) =>
    makeEvent({
      eventId: `event-${i + 1}`,
      label: `E${i + 1}`,
      title: `Entrenamiento ${i + 1}`,
      date: `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      attend: i + 1,
      absent: 1,
      total: i + 2,
    })
  );
}

const AGGREGATE: Summary = { events: 20, attend: 40, absent: 10 };

function renderChart(events: EventAttendancePoint[], aggregate: Summary = AGGREGATE) {
  return render(
    <AttendanceEventChart
      title="Entrenamientos"
      icon={<span data-testid="icon">icon</span>}
      color="#3987e5"
      aggregate={aggregate}
      events={events}
    />
  );
}

describe("AttendanceEventChart", () => {
  it("renderiza una barra por evento visible en la ventana (últimos 5 por defecto)", () => {
    renderChart(makeEvents(8));

    // Window shows the last 5 (events 4..8)
    expect(screen.getByRole("button", { name: /entrenamiento 4/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrenamiento 8/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entrenamiento 3/i })).not.toBeInTheDocument();
  });

  it("muestra todas las barras cuando hay menos de 5 eventos", () => {
    renderChart(makeEvents(3));

    expect(screen.getByRole("button", { name: /entrenamiento 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrenamiento 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrenamiento 3/i })).toBeInTheDocument();
  });

  it("muestra el % agregado del prop aggregate en la cabecera, no derivado de la ventana visible", () => {
    // aggregate: 40/(40+10) = 80%, deliberately different from any per-event rate below.
    renderChart(makeEvents(8), AGGREGATE);

    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("deshabilita '<' cuando la ventana ya está al principio y '>' cuando ya está al final", () => {
    renderChart(makeEvents(8));

    const prevButton = screen.getByRole("button", { name: /eventos anteriores/i });
    const nextButton = screen.getByRole("button", { name: /eventos siguientes/i });

    // Default window is the most recent 5 (4..8) -> next is already at the end.
    expect(nextButton).toBeDisabled();
    expect(prevButton).not.toBeDisabled();

    fireEvent.click(prevButton);
    // Now window is 1..5 (start clamped to 0) -> prev is at the beginning.
    expect(screen.getByRole("button", { name: /entrenamiento 1/i })).toBeInTheDocument();
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it("volver a hacer clic en '>' tras '<' devuelve a la ventana original", () => {
    renderChart(makeEvents(8));

    const prevButton = screen.getByRole("button", { name: /eventos anteriores/i });
    const nextButton = screen.getByRole("button", { name: /eventos siguientes/i });

    fireEvent.click(prevButton);
    expect(screen.queryByRole("button", { name: /entrenamiento 8/i })).not.toBeInTheDocument();

    fireEvent.click(nextButton);
    expect(screen.getByRole("button", { name: /entrenamiento 4/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrenamiento 8/i })).toBeInTheDocument();
    expect(nextButton).toBeDisabled();
  });

  it("muestra un tooltip con título, fecha, asisten, no asisten y % al pasar el ratón o al enfocar una barra", () => {
    renderChart([
      makeEvent({
        eventId: "event-1",
        title: "Entrenamiento 1",
        date: "2026-01-05T10:00:00Z",
        attend: 8,
        absent: 2,
        total: 10,
      }),
    ]);

    const bar = screen.getByRole("button", { name: /entrenamiento 1/i });
    fireEvent.mouseEnter(bar);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Entrenamiento 1");
    expect(tooltip).toHaveTextContent("8");
    expect(tooltip).toHaveTextContent("2");
    expect(tooltip).toHaveTextContent("80%");

    fireEvent.mouseLeave(bar);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(bar);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(bar);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("'Ver como tabla' muestra una tabla con TODOS los eventos (no solo la ventana) y cambia el texto del botón", () => {
    renderChart(makeEvents(8));

    const toggle = screen.getByRole("button", { name: /ver como tabla/i });
    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: /ocultar tabla/i })).toBeInTheDocument();
    const table = screen.getByRole("table");
    // All 8 events must be listed, including ones outside the default window (1..3).
    expect(within(table).getByText("Entrenamiento 1")).toBeInTheDocument();
    expect(within(table).getByText("Entrenamiento 8")).toBeInTheDocument();
    const rows = within(table).getAllByRole("row");
    expect(rows.length).toBe(8 + 1); // header + 8 data rows

    // Regression: the table must scroll horizontally inside its own container
    // instead of overflowing the page on narrow (mobile) viewports.
    expect(table.parentElement?.className).toMatch(/chartTableScroll/);
  });

  it("renderiza el patrón EmptyState (no un gráfico vacío) cuando no hay eventos", () => {
    renderChart([]);

    expect(screen.getByText(/sin datos de entrenamientos/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /gráfico/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver como tabla/i })).not.toBeInTheDocument();
  });
});
