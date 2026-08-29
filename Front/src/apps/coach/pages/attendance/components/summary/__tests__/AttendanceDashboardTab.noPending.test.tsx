import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AttendanceDashboardTab from "../AttendanceDashboardTab";
import type { SummaryByType } from "../types";

function buildSummary(overrides: Partial<SummaryByType["total"]> = {}): SummaryByType {
  const base = { events: 2, attend: 3, absent: 1, ...overrides };
  return {
    total: base,
    training: base,
    match: base,
    other: base,
  };
}

describe("AttendanceDashboardTab — sin cálculo de pendientes", () => {
  it("no muestra la métrica 'Pendientes' en ninguna tarjeta", () => {
    render(<AttendanceDashboardTab summary={buildSummary()} />);

    expect(screen.queryByText("Pendientes")).not.toBeInTheDocument();
  });

  it("calcula la tasa de asistencia solo con asisten/no asisten (sin pendientes)", () => {
    // attend: 3, absent: 1 -> rate = 3/(3+1) = 75%
    render(<AttendanceDashboardTab summary={buildSummary({ attend: 3, absent: 1 })} />);

    expect(screen.getAllByText("75%").length).toBeGreaterThan(0);
  });
});
