import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlayerMatchHistoryCards from "../PlayerMatchHistoryCards";
import type { PlayerMatchRecord } from "../../../convocations/components/simulation/liveMatch.types";

const TEAM_PLAYER_ID = "tp-1";
const OTHER_PLAYER_ID = "tp-2";

function buildRecord(overrides: Partial<PlayerMatchRecord> = {}): PlayerMatchRecord {
  return {
    eventId: "ev-1",
    minutesPlayed: 60,
    isStarter: true,
    enteredAtMinute: null,
    exitedAtMinute: null,
    goalsScored: 1,
    yellowCards: 1,
    redCards: 0,
    rivalName: "CD Rival",
    eventTypeId: 1,
    eventTypeName: "Partido",
    substitutionWindows: [
      {
        windowIndex: 1,
        minute: 60,
        half: 2,
        swaps: [{ inPlayerId: OTHER_PLAYER_ID, outPlayerId: TEAM_PLAYER_ID, slotIndex: 3 }],
      },
    ],
    scoreLocal: 2,
    scoreVisitor: 1,
    matchDate: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

describe("PlayerMatchHistoryCards", () => {
  it("renderiza una tarjeta por partido con rival, tipo, resultado, minutos y etiqueta Titular", () => {
    render(
      <PlayerMatchHistoryCards matchHistory={[buildRecord()]} teamPlayerId={TEAM_PLAYER_ID} />,
    );

    expect(screen.getByText("CD Rival")).toBeInTheDocument();
    expect(screen.getByText("Partido")).toBeInTheDocument();
    expect(screen.getByText("2:1")).toBeInTheDocument();
    expect(screen.getByText(/60/)).toBeInTheDocument();
    expect(screen.getByText("Titular")).toBeInTheDocument();
  });

  it("muestra la etiqueta Convocado cuando el jugador no fue titular", () => {
    render(
      <PlayerMatchHistoryCards
        matchHistory={[buildRecord({ isStarter: false })]}
        teamPlayerId={TEAM_PLAYER_ID}
      />,
    );

    expect(screen.getByText("Convocado")).toBeInTheDocument();
    expect(screen.queryByText("Titular")).not.toBeInTheDocument();
  });

  it("muestra goles y tarjetas cuando el jugador anotó o fue amonestado", () => {
    render(
      <PlayerMatchHistoryCards
        matchHistory={[buildRecord({ goalsScored: 2, yellowCards: 1, redCards: 1 })]}
        teamPlayerId={TEAM_PLAYER_ID}
      />,
    );

    expect(screen.getByText("🟨1")).toBeInTheDocument();
    expect(screen.getByText("🟥1")).toBeInTheDocument();
  });

  it("al expandir una tarjeta muestra los stints calculados por derivePlayerStints", async () => {
    render(
      <PlayerMatchHistoryCards matchHistory={[buildRecord()]} teamPlayerId={TEAM_PLAYER_ID} />,
    );

    expect(screen.queryByText(/0'.*60'/)).not.toBeInTheDocument();

    const expandButton = screen.getByRole("button", { name: /expandir|detalle/i });
    await userEvent.click(expandButton);

    expect(await screen.findByText("0' — 60'")).toBeInTheDocument();
  });

  it("no renderiza ninguna tabla (tarjetas, no tablas)", () => {
    render(
      <PlayerMatchHistoryCards matchHistory={[buildRecord()]} teamPlayerId={TEAM_PLAYER_ID} />,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
