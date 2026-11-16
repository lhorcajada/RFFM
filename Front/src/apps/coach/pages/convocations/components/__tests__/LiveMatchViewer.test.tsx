import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { LiveMatchServerState } from "../simulation/liveMatch.types";

let hookResult: {
  state: LiveMatchServerState | null;
  status: "loading" | "ready" | "offline";
  serverOffsetMs: number;
};

vi.mock("../../hooks/useLiveMatchServerState", () => ({
  useLiveMatchServerState: () => hookResult,
}));

import LiveMatchViewer from "../LiveMatchViewer";

const baseState = (over: Partial<LiveMatchServerState> = {}): LiveMatchServerState => ({
  eventId: "event-1",
  teamId: "team-1",
  version: 3,
  phase: "firstHalf",
  clock: { baseSeconds: 125, referenceUtc: null },
  matchDurationMinutes: 60,
  scoreLocal: 2,
  scoreVisitor: 1,
  formation: null,
  matchData: {
    startingLineupJson: null,
    playersJson: null,
    substitutionWindowsJson: null,
    ratingSnapshotsJson: null,
    goalsJson: JSON.stringify([
      {
        id: "g1",
        minute: 12,
        scorerId: "p1",
        scorerName: "Ana Uno",
        scorerDorsal: 9,
        isOwnTeam: true,
        scoreAtMoment: { local: 1, visitor: 0 },
        pitchZone: null,
        bodyPart: null,
      },
    ]),
    cardsJson: JSON.stringify([
      { id: "c1", minute: 20, half: 1, cardType: "yellow", teamPlayerId: "p2", playerName: "Bea Dos", isRivalPlayer: false, rivalDorsal: null },
    ]),
    formationChangesJson: null,
  },
  isClosed: false,
  serverNowUtc: "2026-11-16T10:00:00Z",
  ...over,
});

function renderViewer() {
  render(
    <LiveMatchViewer
      eventId="event-1"
      localTeamName="Local FC"
      visitorTeamName="Visitante FC"
    />,
  );
}

describe("LiveMatchViewer - partido en directo de solo lectura", () => {
  beforeEach(() => {
    hookResult = { state: baseState(), status: "ready", serverOffsetMs: 0 };
  });

  it("muestra el marcador y los nombres de los equipos", () => {
    renderViewer();

    expect(screen.getByText("Local FC")).toBeInTheDocument();
    expect(screen.getByText("Visitante FC")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("muestra la fase y el reloj del partido", () => {
    renderViewer();

    expect(screen.getByText("1ª")).toBeInTheDocument();
    expect(screen.getByText(/02:05/)).toBeInTheDocument();
  });

  it("muestra los goles y las tarjetas registrados", () => {
    renderViewer();

    expect(screen.getByText(/Ana Uno/)).toBeInTheDocument();
    expect(screen.getByText(/Bea Dos/)).toBeInTheDocument();
  });

  it("no ofrece ningún control para registrar acciones", () => {
    renderViewer();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("avisa de que el partido no ha empezado cuando el coach aún no lo ha iniciado", () => {
    hookResult = { state: null, status: "ready", serverOffsetMs: 0 };
    renderViewer();

    expect(screen.getByText(/todavía no ha empezado/i)).toBeInTheDocument();
  });

  it("indica el descanso", () => {
    hookResult = { state: baseState({ phase: "halftime" }), status: "ready", serverOffsetMs: 0 };
    renderViewer();

    expect(screen.getByText("DESCANSO")).toBeInTheDocument();
  });

  it("avisa cuando no hay conexión con el servidor", () => {
    hookResult = { state: null, status: "offline", serverOffsetMs: 0 };
    renderViewer();

    expect(screen.getByText(/sin conexión/i)).toBeInTheDocument();
  });
});
