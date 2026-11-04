import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import {
  getLiveMatch,
  createLiveMatch,
  sendLiveMatchAction,
  finishLiveMatch,
  deleteLiveMatch,
} from "../liveMatchService";
import type {
  LiveMatchServerState,
  LiveMatchFinishPlayer,
} from "../../pages/convocations/components/simulation/liveMatch.types";

const EVENT_ID = "e1";

const state: LiveMatchServerState = {
  eventId: EVENT_ID,
  teamId: "t1",
  version: 8,
  phase: "firstHalf",
  clock: { baseSeconds: 0, referenceUtc: "2026-11-04T10:00:00.000Z" },
  matchDurationMinutes: 60,
  scoreLocal: 1,
  scoreVisitor: 0,
  formation: "4-4-2",
  matchData: {
    startingLineupJson: null,
    playersJson: null,
    substitutionWindowsJson: null,
    ratingSnapshotsJson: null,
    goalsJson: null,
    cardsJson: null,
    formationChangesJson: null,
  },
  isClosed: false,
  serverNowUtc: "2026-11-04T10:12:03.000Z",
};

function httpError(status: number, data?: unknown): Error {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

describe("liveMatchService.getLiveMatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("hace GET al recurso live-match del evento y devuelve el estado del servidor", async () => {
    (client.get as any).mockResolvedValue({ data: state });

    const result = await getLiveMatch(EVENT_ID);

    expect(client.get).toHaveBeenCalledWith(`/api/events/${EVENT_ID}/live-match`);
    expect(result).toEqual(state);
  });

  it("devuelve null cuando el servidor responde 404 (sin estado en directo)", async () => {
    (client.get as any).mockRejectedValue(httpError(404));

    const result = await getLiveMatch(EVENT_ID);

    expect(client.get).toHaveBeenCalledWith(`/api/events/${EVENT_ID}/live-match`);
    expect(result).toBeNull();
  });

  it("relanza los errores distintos de 404", async () => {
    (client.get as any).mockRejectedValue(httpError(500));

    await expect(getLiveMatch(EVENT_ID)).rejects.toThrow("HTTP 500");
  });
});

describe("liveMatchService.createLiveMatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("hace POST al recurso live-match del evento y devuelve el estado creado", async () => {
    (client.post as any).mockResolvedValue({ data: state });

    const result = await createLiveMatch(EVENT_ID);

    expect(client.post).toHaveBeenCalledWith(`/api/events/${EVENT_ID}/live-match`);
    expect(result).toEqual(state);
  });
});

describe("liveMatchService.sendLiveMatchAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("envía la acción con su baseVersion y devuelve el estado sin conflicto", async () => {
    (client.post as any).mockResolvedValue({ data: state });
    const request = { type: "goal" as const, baseVersion: 7, payload: { scoreLocal: 1, scoreVisitor: 0 } };

    const result = await sendLiveMatchAction(EVENT_ID, request);

    expect(client.post).toHaveBeenCalledWith(`/api/events/${EVENT_ID}/live-match/actions`, request);
    expect(result).toEqual({ conflict: false, state });
  });

  it("ante un 409 devuelve conflict true con el estado ganador de currentState", async () => {
    (client.post as any).mockRejectedValue(httpError(409, { currentState: state }));

    const result = await sendLiveMatchAction(EVENT_ID, { type: "goal", baseVersion: 7 });

    expect(result).toEqual({ conflict: true, state });
  });

  it("relanza los errores distintos de 409", async () => {
    (client.post as any).mockRejectedValue(httpError(500));

    await expect(sendLiveMatchAction(EVENT_ID, { type: "goal", baseVersion: 7 })).rejects.toThrow("HTTP 500");
  });
});

describe("liveMatchService.finishLiveMatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("envía baseVersion y los jugadores al endpoint finish y devuelve el estado cerrado", async () => {
    const closed = { ...state, phase: "finished" as const, isClosed: true };
    (client.post as any).mockResolvedValue({ data: closed });
    const players: LiveMatchFinishPlayer[] = [
      { teamPlayerId: "tp-1", minutesPlayed: 90, isStarter: true, enteredAtMinute: 0, exitedAtMinute: null },
    ];

    const result = await finishLiveMatch(EVENT_ID, 8, players);

    expect(client.post).toHaveBeenCalledWith(`/api/events/${EVENT_ID}/live-match/finish`, {
      baseVersion: 8,
      players,
    });
    expect(result).toEqual({ conflict: false, state: closed });
  });

  it("ante un 409 devuelve conflict true con el estado ganador de currentState", async () => {
    (client.post as any).mockRejectedValue(httpError(409, { currentState: state }));

    const result = await finishLiveMatch(EVENT_ID, 7, []);

    expect(result).toEqual({ conflict: true, state });
  });
});

describe("liveMatchService.deleteLiveMatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("hace DELETE al recurso live-match del evento", async () => {
    (client.delete as any).mockResolvedValue({});

    await deleteLiveMatch(EVENT_ID);

    expect(client.delete).toHaveBeenCalledWith(`/api/events/${EVENT_ID}/live-match`);
  });
});
