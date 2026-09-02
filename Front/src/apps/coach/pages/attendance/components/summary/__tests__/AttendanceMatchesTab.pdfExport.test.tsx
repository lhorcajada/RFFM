import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MatchAttendanceColumn, PlayerMatchSummary } from "../types";

const getRolesMock = vi.fn();
vi.mock("../../../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => getRolesMock(),
  },
}));

const exportMatchesSummaryPdfMock = vi.fn();
const exportMatchesFullPdfMock = vi.fn();
vi.mock("../matchAttendancePdfExport", () => ({
  exportMatchesSummaryPdf: (...args: unknown[]) => exportMatchesSummaryPdfMock(...args),
  exportMatchesFullPdf: (...args: unknown[]) => exportMatchesFullPdfMock(...args),
}));

import AttendanceMatchesTab from "../AttendanceMatchesTab";

const columns: MatchAttendanceColumn[] = [
  { eventId: "event-1", label: "J1", date: "2026-01-01T10:00:00Z", rival: "Rival A", isFriendly: false },
];

const rows: PlayerMatchSummary[] = [
  {
    playerId: "tp-1",
    playerName: "Jugador Uno",
    totalMatches: 1,
    calledMatches: 1,
    startedMatches: 1,
    notCalledMatches: 0,
    seasonMinutesPlayed: 90,
    cells: [{ eventId: "event-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 90 }],
  },
];

describe("AttendanceMatchesTab — botones de exportación PDF según rol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportMatchesSummaryPdfMock.mockResolvedValue(undefined);
    exportMatchesFullPdfMock.mockResolvedValue(undefined);
  });

  it("muestra los botones Exportar resumen y Exportar completo para un entrenador", () => {
    getRolesMock.mockReturnValue(["Coach"]);
    render(<AttendanceMatchesTab rows={rows} columns={columns} />);

    expect(screen.getByRole("button", { name: /exportar resumen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /exportar completo/i })).toBeInTheDocument();
  });

  it("no muestra los botones de exportación para un jugador", () => {
    getRolesMock.mockReturnValue(["Player"]);
    render(<AttendanceMatchesTab rows={rows} columns={columns} />);

    expect(screen.queryByRole("button", { name: /exportar resumen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /exportar completo/i })).not.toBeInTheDocument();
  });

  it("no muestra los botones de exportación para un familiar", () => {
    getRolesMock.mockReturnValue(["FamilyPlayer"]);
    render(<AttendanceMatchesTab rows={rows} columns={columns} />);

    expect(screen.queryByRole("button", { name: /exportar resumen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /exportar completo/i })).not.toBeInTheDocument();
  });
});

describe("AttendanceMatchesTab — acción de los botones de exportación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRolesMock.mockReturnValue(["Coach"]);
  });

  it("al pulsar Exportar resumen llama a exportMatchesSummaryPdf con rows y columns en el mismo orden", async () => {
    exportMatchesSummaryPdfMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AttendanceMatchesTab rows={rows} columns={columns} />);

    await user.click(screen.getByRole("button", { name: /exportar resumen/i }));

    await waitFor(() => expect(exportMatchesSummaryPdfMock).toHaveBeenCalledTimes(1));
    expect(exportMatchesSummaryPdfMock.mock.calls[0][0]).toEqual(rows);
    expect(exportMatchesSummaryPdfMock.mock.calls[0][1]).toEqual(columns);
  });

  it("al pulsar Exportar completo llama a exportMatchesFullPdf con rows y columns en el mismo orden", async () => {
    exportMatchesFullPdfMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AttendanceMatchesTab rows={rows} columns={columns} />);

    await user.click(screen.getByRole("button", { name: /exportar completo/i }));

    await waitFor(() => expect(exportMatchesFullPdfMock).toHaveBeenCalledTimes(1));
    expect(exportMatchesFullPdfMock.mock.calls[0][0]).toEqual(rows);
    expect(exportMatchesFullPdfMock.mock.calls[0][1]).toEqual(columns);
  });

  it("deshabilita el botón Exportar resumen mientras se genera y lo reactiva al terminar", async () => {
    let resolveExport!: () => void;
    exportMatchesSummaryPdfMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveExport = resolve;
      })
    );
    const user = userEvent.setup();
    render(<AttendanceMatchesTab rows={rows} columns={columns} />);

    const button = screen.getByRole("button", { name: /exportar resumen/i });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());

    resolveExport();

    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("deshabilita el botón Exportar completo mientras se genera y lo reactiva al terminar", async () => {
    let resolveExport!: () => void;
    exportMatchesFullPdfMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveExport = resolve;
      })
    );
    const user = userEvent.setup();
    render(<AttendanceMatchesTab rows={rows} columns={columns} />);

    const button = screen.getByRole("button", { name: /exportar completo/i });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());

    resolveExport();

    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
