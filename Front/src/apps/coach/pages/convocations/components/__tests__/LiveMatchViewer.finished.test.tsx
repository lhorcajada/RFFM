import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { LiveMatchServerState } from "../simulation/liveMatch.types";
import type { MatchReport } from "../../../../services/matchReportService";

let hookResult: {
  state: LiveMatchServerState | null;
  status: "loading" | "ready" | "offline";
  serverOffsetMs: number;
};

vi.mock("../../hooks/useLiveMatchServerState", () => ({
  useLiveMatchServerState: () => hookResult,
}));

const getMatchReportMock = vi.fn();
vi.mock("../../../../services/matchReportService", () => ({
  getMatchReport: (eventId: string) => getMatchReportMock(eventId),
}));

import LiveMatchViewer from "../LiveMatchViewer";

const finishedState = (): LiveMatchServerState => ({
  eventId: "event-1",
  teamId: "team-1",
  version: 9,
  phase: "finished",
  clock: { baseSeconds: 263 * 60 + 31, referenceUtc: null },
  matchDurationMinutes: 60,
  scoreLocal: 0,
  scoreVisitor: 0,
  formation: null,
  matchData: {
    startingLineupJson: null,
    playersJson: null,
    substitutionWindowsJson: null,
    ratingSnapshotsJson: null,
    goalsJson: null,
    cardsJson: null,
    formationChangesJson: null,
  },
  isClosed: true,
  serverNowUtc: "2026-11-16T10:00:00Z",
});

const report = (): MatchReport => ({
  eventId: "event-1",
  teamName: "Local FC",
  teamPhotoUrl: null,
  rivalName: "Visitante FC",
  rivalPhotoUrl: null,
  isHomeMatch: true,
  date: null,
  localGoals: "3",
  visitorGoals: "2",
  matchCategory: "League",
  hasLiveReport: true,
  hasFederationReport: false,
  live: {
    formationName: null,
    matchDurationMinutes: 60,
    starters: [],
    bench: [],
    goals: [
      { minute: 5, scorerName: "Ana Uno", scorerDorsal: 9, isOwnTeam: true, scoreLocal: 1, scoreVisitor: 0 },
      { minute: 20, scorerName: null, scorerDorsal: null, isOwnTeam: false, scoreLocal: 1, scoreVisitor: 1 },
      { minute: 30, scorerName: "Cris Tres", scorerDorsal: 7, isOwnTeam: true, scoreLocal: 2, scoreVisitor: 1 },
      { minute: 40, scorerName: null, scorerDorsal: null, isOwnTeam: false, scoreLocal: 2, scoreVisitor: 2 },
      { minute: 55, scorerName: "Ana Uno", scorerDorsal: 9, isOwnTeam: true, scoreLocal: 3, scoreVisitor: 2 },
    ],
    cards: [{ minute: 22, half: 1, cardType: "yellow", playerName: "Bea Dos", rivalDorsal: null, isRivalPlayer: false }],
    substitutionWindows: [
      { windowIndex: 1, isHalftime: false, minute: 35, half: 1, swaps: [{ inPlayerName: "Eva Cinco", outPlayerName: "Dani Cuatro" }] },
    ],
  },
});

function renderViewer() {
  render(<LiveMatchViewer eventId="event-1" localTeamName="Local FC" visitorTeamName="Visitante FC" />);
}

describe("LiveMatchViewer - partido finalizado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookResult = { state: finishedState(), status: "ready", serverOffsetMs: 0 };
    getMatchReportMock.mockResolvedValue(report());
  });

  it("muestra el resultado final del informe aunque el estado en directo esté a 0-0", async () => {
    renderViewer();

    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(getMatchReportMock).toHaveBeenCalledWith("event-1");
  });

  it("muestra los goles, las tarjetas y los cambios del informe", async () => {
    renderViewer();

    expect((await screen.findAllByText(/Ana Uno/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Bea Dos/)).toBeInTheDocument();
    expect(screen.getByText(/Eva Cinco/)).toBeInTheDocument();
    expect(screen.getByText(/Dani Cuatro/)).toBeInTheDocument();
  });

  it("no muestra el reloj desbordado en un partido finalizado", async () => {
    renderViewer();

    await screen.findByText(/Eva Cinco/);
    expect(screen.getByText("FIN")).toBeInTheDocument();
    expect(screen.queryByText(/263:31/)).not.toBeInTheDocument();
  });

  it("muestra un error en español si falla la carga del informe", async () => {
    getMatchReportMock.mockRejectedValue(new Error("403"));
    renderViewer();

    expect(await screen.findByText(/No se pudo cargar el informe del partido/i)).toBeInTheDocument();
    expect(screen.getByText("FIN")).toBeInTheDocument();
  });

  it("no pide el informe mientras el partido sigue en juego", () => {
    hookResult = { state: { ...finishedState(), phase: "firstHalf", isClosed: false }, status: "ready", serverOffsetMs: 0 };
    renderViewer();

    expect(getMatchReportMock).not.toHaveBeenCalled();
  });
});
