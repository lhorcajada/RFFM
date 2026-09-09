import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlayerMatchHistoryTable from "../PlayerMatchHistoryTable";
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

describe("PlayerMatchHistoryTable", () => {
  it("muestra las columnas Rival, Tipo y Tarjetas, sin columnas fijas 'Entró'/'Salió'", () => {
    render(
      <PlayerMatchHistoryTable matchHistory={[buildRecord()]} teamPlayerId={TEAM_PLAYER_ID} />
    );

    expect(screen.getByText("Rival")).toBeInTheDocument();
    expect(screen.getByText("Tipo")).toBeInTheDocument();
    expect(screen.getByText("Tarjetas")).toBeInTheDocument();
    expect(screen.getByText("CD Rival")).toBeInTheDocument();
    expect(screen.getByText("Partido")).toBeInTheDocument();

    expect(screen.queryByText("Entró")).not.toBeInTheDocument();
    expect(screen.queryByText("Salió")).not.toBeInTheDocument();
  });

  it("al hacer click en la fila expandible muestra los stints calculados por derivePlayerStints", async () => {
    render(
      <PlayerMatchHistoryTable matchHistory={[buildRecord()]} teamPlayerId={TEAM_PLAYER_ID} />
    );

    expect(screen.queryByText(/0'.*60'/)).not.toBeInTheDocument();

    const expandButton = screen.getByRole("button", { name: /expandir|detalle/i });
    await userEvent.click(expandButton);

    expect(await screen.findByText(/0'/)).toBeInTheDocument();
    expect(await screen.findByText(/60'/)).toBeInTheDocument();
  });
});
