import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AttendanceMatchesTab from "../AttendanceMatchesTab";
import type { MatchAttendanceColumn, PlayerMatchSummary } from "../types";

const officialColumn: MatchAttendanceColumn = {
  eventId: "event-1",
  label: "J1",
  date: "2026-01-01T10:00:00Z",
  rival: "Rival A",
  isFriendly: false,
};

const friendlyColumn: MatchAttendanceColumn = {
  eventId: "event-2",
  label: "J2",
  date: "2026-01-08T10:00:00Z",
  rival: "Rival B",
  isFriendly: true,
};

function makeRow(overrides: Partial<PlayerMatchSummary> = {}): PlayerMatchSummary {
  return {
    playerId: "tp-1",
    playerName: "Jugador Uno",
    totalMatches: 2,
    calledMatches: 1,
    startedMatches: 1,
    notCalledMatches: 1,
    seasonMinutesPlayed: 245,
    cells: [
      { eventId: "event-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 78 },
      { eventId: "event-2", state: "notCalled", wasCalled: false, wasStarter: false, minutesPlayed: null },
    ],
    ...overrides,
  };
}

describe("AttendanceMatchesTab — minutos y amistosos", () => {
  it("muestra los minutos jugados en la celda de un jugador titular", () => {
    render(
      <AttendanceMatchesTab
        rows={[makeRow()]}
        columns={[officialColumn, friendlyColumn]}
      />
    );

    expect(screen.getByText("78'")).toBeInTheDocument();
  });

  it("muestra 0' cuando el jugador fue convocado pero no jugó minutos", () => {
    const row = makeRow({
      cells: [
        { eventId: "event-1", state: "called", wasCalled: true, wasStarter: false, minutesPlayed: 0 },
        { eventId: "event-2", state: "notCalled", wasCalled: false, wasStarter: false, minutesPlayed: null },
      ],
    });
    render(<AttendanceMatchesTab rows={[row]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText("0'")).toBeInTheDocument();
  });

  it("no muestra minutos para un jugador no convocado", () => {
    render(
      <AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />
    );

    expect(screen.queryByText("null'")).not.toBeInTheDocument();
    // Only one minutes badge should be rendered (the starter cell), none for the notCalled one.
    expect(screen.getAllByText(/^\d+'$/)).toHaveLength(1);
  });

  it("muestra un chip con los minutos totales de temporada del jugador", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText(/245/)).toBeInTheDocument();
  });

  it("muestra 0 min temporada cuando el total de minutos no llega calculado", () => {
    const row = makeRow({ seasonMinutesPlayed: undefined as unknown as number });
    render(<AttendanceMatchesTab rows={[row]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText("0 min temporada")).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });

  it("muestra la etiqueta Amistoso en la cabecera de una jornada amistosa", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText("Amistoso")).toBeInTheDocument();
  });

  it("no muestra la etiqueta Amistoso en la cabecera de una jornada oficial", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn]} />);

    expect(screen.queryByText("Amistoso")).not.toBeInTheDocument();
  });

  it("el texto informativo indica que también se incluyen los partidos amistosos", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText(/amistosos/i)).toBeInTheDocument();
    expect(screen.queryByText(/solo partidos oficiales/i)).not.toBeInTheDocument();
  });
});
