import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LiveReportTab from "../LiveReportTab";
import type { LiveMatchReport } from "../../../../services/matchReportService";

const report: LiveMatchReport = {
  formationName: "4-4-2",
  matchDurationMinutes: 92,
  starters: [
    { teamPlayerId: "p1", name: "Portero Uno", dorsal: 1, photoUrl: null, slotIndex: 0, minutesPlayed: 92 },
    { teamPlayerId: "p2", name: "Delantero Nueve", dorsal: 9, photoUrl: null, slotIndex: 9, minutesPlayed: 60 },
  ],
  bench: [
    { teamPlayerId: "p3", name: "Suplente Catorce", dorsal: 14, photoUrl: null, slotIndex: null, minutesPlayed: 32 },
    { teamPlayerId: "p4", name: "Reserva Veinte", dorsal: 20, photoUrl: null, slotIndex: null, minutesPlayed: 0 },
  ],
  goals: [
    { minute: 10, scorerName: "Delantero Nueve", scorerDorsal: 9, isOwnTeam: true, scoreLocal: 1, scoreVisitor: 0 },
    { minute: 31, scorerName: null, scorerDorsal: null, isOwnTeam: false, scoreLocal: 1, scoreVisitor: 1 },
  ],
  cards: [
    { minute: 20, half: 1, cardType: "yellow", playerName: "Portero Uno", rivalDorsal: null, isRivalPlayer: false },
    { minute: 70, half: 2, cardType: "red", playerName: null, rivalDorsal: 7, isRivalPlayer: true },
  ],
  substitutionWindows: [
    { windowIndex: 0, isHalftime: true, minute: 46, half: 1, swaps: [{ inPlayerName: "Reserva Veinte", outPlayerName: null }] },
    { windowIndex: 1, isHalftime: false, minute: 60, half: 2, swaps: [{ inPlayerName: "Suplente Catorce", outPlayerName: "Delantero Nueve" }] },
  ],
};

describe("LiveReportTab", () => {
  it("lista los goles en orden con su minuto y el marcador parcial", () => {
    render(<LiveReportTab report={report} />);

    const goals = within(screen.getByRole("region", { name: "Goles" })).getAllByRole("listitem");
    expect(goals).toHaveLength(2);
    expect(goals[0]).toHaveTextContent("10'");
    expect(goals[0]).toHaveTextContent("Delantero Nueve");
    expect(goals[0]).toHaveTextContent("1 - 0");
    expect(goals[1]).toHaveTextContent("31'");
    expect(goals[1]).toHaveTextContent("Gol del rival");
  });

  it("muestra los titulares en el campo y los minutos de cada jugador", () => {
    render(<LiveReportTab report={report} />);

    const starters = within(screen.getByRole("region", { name: "Titulares" }));
    expect(starters.getByText("Portero Uno")).toBeInTheDocument();
    expect(starters.getByText("92'")).toBeInTheDocument();
    expect(screen.getByLabelText("Campo con la alineación inicial (4-4-2)")).toBeInTheDocument();
  });

  it("muestra el banquillo incluyendo a quien no jugó con 0 minutos", () => {
    render(<LiveReportTab report={report} />);

    const bench = within(screen.getByRole("region", { name: "Banquillo" }));
    const reserve = bench.getByText("Reserva Veinte").closest("li")!;
    expect(reserve).toHaveTextContent("0'");
  });

  it("muestra las tarjetas propias y del rival", () => {
    render(<LiveReportTab report={report} />);

    const cards = within(screen.getByRole("region", { name: "Tarjetas" })).getAllByRole("listitem");
    expect(cards[0]).toHaveTextContent("20'");
    expect(cards[0]).toHaveTextContent("Portero Uno");
    expect(cards[1]).toHaveTextContent("Rival #7");
  });

  it("muestra la ventana del descanso y las ventanas de cambios numeradas", () => {
    render(<LiveReportTab report={report} />);

    const windows = within(screen.getByRole("region", { name: "Cambios" })).getAllByRole("article");
    expect(windows[0]).toHaveTextContent("Descanso");
    expect(windows[0]).toHaveTextContent("Entra Reserva Veinte");
    expect(windows[1]).toHaveTextContent("Ventana 1");
    expect(windows[1]).toHaveTextContent("60'");
    expect(windows[1]).toHaveTextContent("Sale Delantero Nueve");
  });

  it("indica cuando no hubo goles, tarjetas ni cambios", () => {
    render(
      <LiveReportTab report={{ ...report, goals: [], cards: [], substitutionWindows: [] }} />,
    );

    expect(screen.getByText("Sin goles")).toBeInTheDocument();
    expect(screen.getByText("Sin tarjetas")).toBeInTheDocument();
    expect(screen.getByText("Sin cambios")).toBeInTheDocument();
  });
});
