import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AttendanceMatchesTab from "../AttendanceMatchesTab";
import type { MatchAttendanceColumn, PlayerMatchSummary } from "../types";

const columns: MatchAttendanceColumn[] = Array.from({ length: 7 }, (_, index) => ({
  eventId: `event-${index}`,
  label: `J${index + 1}`,
  date: `2026-01-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
  rival: `Rival ${index + 1}`,
  isFriendly: index === 6,
}));

function makeRow(overrides: Partial<PlayerMatchSummary> = {}): PlayerMatchSummary {
  return {
    playerId: "tp-1",
    playerName: "Jugador Uno",
    position: "Defensa",
    totalMatches: 7,
    calledMatches: 7,
    startedMatches: 4,
    notCalledMatches: 0,
    technicalDecisionMatches: 2,
    unavailableMatches: 0,
    injuryMatches: 0,
    illnessMatches: 0,
    seasonMinutesPlayed: 312,
    cells: columns.map((column) => ({
      eventId: column.eventId,
      state: "starter",
      wasCalled: true,
      wasStarter: true,
      minutesPlayed: 45,
    })),
    ...overrides,
  };
}

describe("AttendanceMatchesTab — maquetación rediseñada", () => {
  it("muestra los minutos de temporada como dato destacado de la tarjeta", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={columns} />);

    const minutes = screen.getByLabelText("312 minutos de temporada");
    expect(minutes).toHaveTextContent("312");
    expect(minutes).toHaveTextContent("min temporada");
  });

  it("agrupa los contadores en una lista y omite los que valen cero", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={columns} />);

    const counters = screen.getByRole("list", { name: "Contadores de temporada" });
    expect(within(counters).getByText("7 partidos")).toBeInTheDocument();
    expect(within(counters).getByText("4 tit.")).toBeInTheDocument();
    expect(within(counters).getByText("2 técnica")).toBeInTheDocument();
    expect(within(counters).queryByText(/lesión|enferm\.|no disp\./)).not.toBeInTheDocument();
  });

  it("muestra la posición del jugador bajo su nombre", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={columns} />);

    expect(screen.getByText("Defensa")).toBeInTheDocument();
  });

  it("la tira de forma etiquetada contiene solo los últimos 5 partidos jugados", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={columns} />);

    const strip = screen.getByRole("list", { name: "Forma: últimos 5 partidos" });
    expect(within(strip).getAllByRole("listitem")).toHaveLength(5);
  });

  it("la leyenda es una lista con una entrada por estado", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={columns} />);

    const legend = screen.getByRole("list", { name: "Leyenda de estados de convocatoria" });
    expect(within(legend).getAllByRole("listitem").length).toBeGreaterThanOrEqual(6);
  });

  it("el detalle expandido lista cada partido con fecha, estado, minutos y la etiqueta Amistoso", async () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={columns} />);

    await userEvent.setup().click(screen.getByRole("button", { name: /Jugador Uno/i }));

    const detail = screen.getByRole("list", { name: "Detalle de partidos de Jugador Uno" });
    const items = within(detail).getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(within(items[6]).getByText("Amistoso")).toBeInTheDocument();
    expect(within(items[0]).queryByText("Amistoso")).not.toBeInTheDocument();
    expect(within(items[0]).getByText("45'")).toBeInTheDocument();
    expect(within(items[0]).getByText("Titular")).toBeInTheDocument();
  });

  it("no usa tablas", () => {
    const { container } = render(<AttendanceMatchesTab rows={[makeRow()]} columns={columns} />);

    expect(container.querySelectorAll("table")).toHaveLength(0);
  });
});
