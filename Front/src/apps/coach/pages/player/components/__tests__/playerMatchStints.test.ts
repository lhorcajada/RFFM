import { describe, it, expect } from "vitest";
import { derivePlayerStints } from "../playerMatchStints";
import type { PlayerMatchRecord } from "../../../convocations/components/simulation/liveMatch.types";

const TEAM_PLAYER_ID = "tp-1";
const OTHER_PLAYER_ID = "tp-2";

function buildRecord(overrides: Partial<PlayerMatchRecord>): PlayerMatchRecord {
  return {
    eventId: "ev-1",
    minutesPlayed: 0,
    isStarter: false,
    enteredAtMinute: null,
    exitedAtMinute: null,
    goalsScored: 0,
    yellowCards: 0,
    redCards: 0,
    rivalName: null,
    eventTypeId: 1,
    eventTypeName: "Partido",
    substitutionWindows: [],
    scoreLocal: 0,
    scoreVisitor: 0,
    matchDate: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("derivePlayerStints", () => {
  it("titular sustituido: un stint desde el minuto 0 hasta la salida", () => {
    const record = buildRecord({
      isStarter: true,
      substitutionWindows: [
        {
          windowIndex: 1,
          minute: 60,
          half: 2,
          swaps: [{ inPlayerId: OTHER_PLAYER_ID, outPlayerId: TEAM_PLAYER_ID, slotIndex: 3 }],
        },
      ],
    });

    expect(derivePlayerStints(record, TEAM_PLAYER_ID)).toEqual([
      { enteredAtMinute: 0, exitedAtMinute: 60 },
    ]);
  });

  it("suplente que entra y vuelve a salir dos veces", () => {
    const record = buildRecord({
      isStarter: false,
      substitutionWindows: [
        {
          windowIndex: 1,
          minute: 30,
          half: 1,
          swaps: [{ inPlayerId: TEAM_PLAYER_ID, outPlayerId: OTHER_PLAYER_ID, slotIndex: 5 }],
        },
        {
          windowIndex: 2,
          minute: 50,
          half: 2,
          swaps: [{ inPlayerId: OTHER_PLAYER_ID, outPlayerId: TEAM_PLAYER_ID, slotIndex: 5 }],
        },
        {
          windowIndex: 3,
          minute: 70,
          half: 2,
          swaps: [{ inPlayerId: TEAM_PLAYER_ID, outPlayerId: null, slotIndex: 5 }],
        },
        {
          windowIndex: 4,
          minute: 85,
          half: 2,
          swaps: [{ inPlayerId: OTHER_PLAYER_ID, outPlayerId: TEAM_PLAYER_ID, slotIndex: 5 }],
        },
      ],
    });

    expect(derivePlayerStints(record, TEAM_PLAYER_ID)).toEqual([
      { enteredAtMinute: 30, exitedAtMinute: 50 },
      { enteredAtMinute: 70, exitedAtMinute: 85 },
    ]);
  });

  it("jugador que entra y sigue en el campo hasta el final (stint abierto)", () => {
    const record = buildRecord({
      isStarter: false,
      substitutionWindows: [
        {
          windowIndex: 1,
          minute: 75,
          half: 2,
          swaps: [{ inPlayerId: TEAM_PLAYER_ID, outPlayerId: OTHER_PLAYER_ID, slotIndex: 2 }],
        },
      ],
    });

    expect(derivePlayerStints(record, TEAM_PLAYER_ID)).toEqual([
      { enteredAtMinute: 75, exitedAtMinute: null },
    ]);
  });

  it("titular que juega el partido completo sin sustituciones (sin substitutionWindows)", () => {
    const record = buildRecord({ isStarter: true, substitutionWindows: [] });

    expect(derivePlayerStints(record, TEAM_PLAYER_ID)).toEqual([
      { enteredAtMinute: 0, exitedAtMinute: null },
    ]);
  });

  it("jugador que no participa en absoluto (ni titular ni sustituciones) devuelve lista vacía", () => {
    const record = buildRecord({ isStarter: false, substitutionWindows: [] });

    expect(derivePlayerStints(record, TEAM_PLAYER_ID)).toEqual([]);
  });

  it("ignora ventanas de sustitución de otros jugadores", () => {
    const record = buildRecord({
      isStarter: true,
      substitutionWindows: [
        {
          windowIndex: 1,
          minute: 40,
          half: 1,
          swaps: [{ inPlayerId: "tp-3", outPlayerId: OTHER_PLAYER_ID, slotIndex: 9 }],
        },
      ],
    });

    expect(derivePlayerStints(record, TEAM_PLAYER_ID)).toEqual([
      { enteredAtMinute: 0, exitedAtMinute: null },
    ]);
  });

  it("ordena las ventanas por minuto antes de calcular los stints", () => {
    const record = buildRecord({
      isStarter: false,
      substitutionWindows: [
        {
          windowIndex: 2,
          minute: 60,
          half: 2,
          swaps: [{ inPlayerId: OTHER_PLAYER_ID, outPlayerId: TEAM_PLAYER_ID, slotIndex: 5 }],
        },
        {
          windowIndex: 1,
          minute: 20,
          half: 1,
          swaps: [{ inPlayerId: TEAM_PLAYER_ID, outPlayerId: OTHER_PLAYER_ID, slotIndex: 5 }],
        },
      ],
    });

    expect(derivePlayerStints(record, TEAM_PLAYER_ID)).toEqual([
      { enteredAtMinute: 20, exitedAtMinute: 60 },
    ]);
  });
});
