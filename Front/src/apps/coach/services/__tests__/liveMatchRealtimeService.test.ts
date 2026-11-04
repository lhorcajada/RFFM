import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const hub = vi.hoisted(() => {
  const connection = {
    on: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    invoke: vi.fn(),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
  };
  const builder = {
    withUrl: vi.fn(),
    withAutomaticReconnect: vi.fn(),
    build: vi.fn(),
  };
  connection.start.mockResolvedValue(undefined);
  connection.stop.mockResolvedValue(undefined);
  connection.invoke.mockResolvedValue(undefined);
  builder.withUrl.mockReturnValue(builder);
  builder.withAutomaticReconnect.mockReturnValue(builder);
  builder.build.mockReturnValue(connection);
  return { connection, builder };
});

vi.mock("@microsoft/signalr", () => ({
  HubConnectionBuilder: vi.fn(function HubConnectionBuilderMock() {
    return hub.builder;
  }),
}));

import { connectLiveMatch, type LiveMatchRealtimeHandlers } from "../liveMatchRealtimeService";
import type { LiveMatchServerState } from "../../pages/convocations/components/simulation/liveMatch.types";

const state: LiveMatchServerState = {
  eventId: "e1",
  teamId: "t1",
  version: 5,
  phase: "firstHalf",
  clock: { baseSeconds: 0, referenceUtc: "2026-11-04T10:00:00.000Z" },
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
  isClosed: false,
  serverNowUtc: "2026-11-04T10:00:03.000Z",
};

function makeHandlers(): LiveMatchRealtimeHandlers {
  return {
    onMatchUpdated: vi.fn(),
    onMatchDeleted: vi.fn(),
    onReconnected: vi.fn(),
    onStatusChange: vi.fn(),
  };
}

function registeredCallback(eventName: string): ((...args: unknown[]) => void) | undefined {
  const call = hub.connection.on.mock.calls.find((c) => c[0] === eventName);
  return call?.[1] as ((...args: unknown[]) => void) | undefined;
}

function lifecycleCallback(name: "onreconnecting" | "onreconnected" | "onclose"): (() => void) | undefined {
  const call = hub.connection[name].mock.calls[0];
  return call?.[0] as (() => void) | undefined;
}

describe("liveMatchRealtimeService.connectLiveMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("construye la conexión a la ruta del hub con el token guardado en coachAuthToken", async () => {
    localStorage.setItem("coachAuthToken", "token-coach-1");

    await connectLiveMatch(makeHandlers());

    expect(hub.builder.withUrl).toHaveBeenCalledWith(
      expect.stringMatching(/\/hubs\/live-match$/),
      expect.objectContaining({ accessTokenFactory: expect.any(Function) }),
    );
    const options = hub.builder.withUrl.mock.calls[0][1] as { accessTokenFactory: () => string };
    expect(options.accessTokenFactory()).toBe("token-coach-1");
  });

  it("activa la reconexión automática", async () => {
    await connectLiveMatch(makeHandlers());

    expect(hub.builder.withAutomaticReconnect).toHaveBeenCalledTimes(1);
  });

  it("informa de estado connecting y después connected alrededor del arranque", async () => {
    const handlers = makeHandlers();

    await connectLiveMatch(handlers);

    expect(hub.connection.start).toHaveBeenCalledTimes(1);
    expect(handlers.onStatusChange).toHaveBeenNthCalledWith(1, "connecting");
    expect(handlers.onStatusChange).toHaveBeenLastCalledWith("connected");
  });

  it("invoca onMatchUpdated una vez con el estado recibido del servidor", async () => {
    const handlers = makeHandlers();
    await connectLiveMatch(handlers);

    const callback = registeredCallback("MatchUpdated");
    expect(callback).toBeTypeOf("function");
    callback?.(state);

    expect(handlers.onMatchUpdated).toHaveBeenCalledTimes(1);
    expect(handlers.onMatchUpdated).toHaveBeenCalledWith(state);
  });

  it("invoca onMatchDeleted con el id del evento cuando llega MatchDeleted", async () => {
    const handlers = makeHandlers();
    await connectLiveMatch(handlers);

    const callback = registeredCallback("MatchDeleted");
    expect(callback).toBeTypeOf("function");
    callback?.("e1");

    expect(handlers.onMatchDeleted).toHaveBeenCalledWith("e1");
  });

  it("tras reconectar invoca onReconnected y el estado pasa de reconnecting a connected", async () => {
    const handlers = makeHandlers();
    await connectLiveMatch(handlers);
    vi.mocked(handlers.onStatusChange).mockClear();
    const reconnecting = lifecycleCallback("onreconnecting");
    const reconnected = lifecycleCallback("onreconnected");
    expect(reconnecting).toBeTypeOf("function");
    expect(reconnected).toBeTypeOf("function");

    reconnecting?.();
    reconnected?.();

    expect(handlers.onStatusChange).toHaveBeenNthCalledWith(1, "reconnecting");
    expect(handlers.onStatusChange).toHaveBeenNthCalledWith(2, "connected");
    expect(handlers.onReconnected).toHaveBeenCalledTimes(1);
  });

  it("informa de estado disconnected cuando la conexión se cierra", async () => {
    const handlers = makeHandlers();
    await connectLiveMatch(handlers);

    const closed = lifecycleCallback("onclose");
    expect(closed).toBeTypeOf("function");
    closed?.();

    expect(handlers.onStatusChange).toHaveBeenLastCalledWith("disconnected");
  });

  it("joinMatch invoca el método del hub JoinMatch con el id del evento", async () => {
    const connection = await connectLiveMatch(makeHandlers());

    await connection.joinMatch("e1");

    expect(hub.connection.invoke).toHaveBeenCalledWith("JoinMatch", "e1");
  });

  it("leaveMatch invoca el método del hub LeaveMatch con el id del evento", async () => {
    const connection = await connectLiveMatch(makeHandlers());

    await connection.leaveMatch("e1");

    expect(hub.connection.invoke).toHaveBeenCalledWith("LeaveMatch", "e1");
  });

  it("stop detiene la conexión subyacente", async () => {
    const connection = await connectLiveMatch(makeHandlers());

    await connection.stop();

    expect(hub.connection.stop).toHaveBeenCalledTimes(1);
  });
});
