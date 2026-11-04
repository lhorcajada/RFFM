import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const svc = vi.hoisted(() => ({
  getLiveMatch: vi.fn(),
  createLiveMatch: vi.fn(),
  sendLiveMatchAction: vi.fn(),
  finishLiveMatch: vi.fn(),
  deleteLiveMatch: vi.fn(),
}));

const rt = vi.hoisted(() => {
  const connection = {
    joinMatch: vi.fn(),
    leaveMatch: vi.fn(),
    stop: vi.fn(),
  };
  return { connection, connectLiveMatch: vi.fn() };
});

vi.mock("../../../../services/liveMatchService", () => ({
  getLiveMatch: svc.getLiveMatch,
  createLiveMatch: svc.createLiveMatch,
  sendLiveMatchAction: svc.sendLiveMatchAction,
  finishLiveMatch: svc.finishLiveMatch,
  deleteLiveMatch: svc.deleteLiveMatch,
}));

vi.mock("../../../../services/liveMatchRealtimeService", () => ({
  connectLiveMatch: rt.connectLiveMatch,
}));

import { act, renderHook, waitFor } from "@testing-library/react";
import { useLiveMatchServerState } from "../useLiveMatchServerState";
import type { LiveMatchRealtimeHandlers } from "../../../../services/liveMatchRealtimeService";
import type { LiveMatchServerState } from "../../components/simulation/liveMatch.types";

const EVENT_ID = "e1";
const SERVER_NOW = "2026-11-04T10:12:03.000Z";

function makeState(version: number, overrides: Partial<LiveMatchServerState> = {}): LiveMatchServerState {
  return {
    eventId: EVENT_ID,
    teamId: "t1",
    version,
    phase: "firstHalf",
    clock: { baseSeconds: 0, referenceUtc: "2026-11-04T10:00:00.000Z" },
    matchDurationMinutes: 60,
    scoreLocal: 0,
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
    serverNowUtc: SERVER_NOW,
    ...overrides,
  };
}

function handlers(): LiveMatchRealtimeHandlers {
  const call = rt.connectLiveMatch.mock.calls[0];
  expect(call).toBeDefined();
  return call[0] as LiveMatchRealtimeHandlers;
}

function snackbarDetails(dispatchSpy: { mock: { calls: unknown[][] } }): Array<{ message: string; severity: string }> {
  return dispatchSpy.mock.calls
    .map(([event]) => event as CustomEvent<{ message: string; severity: string }>)
    .filter((event) => event instanceof CustomEvent && event.type === "rffm.show_snackbar")
    .map((event) => event.detail);
}

describe("useLiveMatchServerState", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    svc.getLiveMatch.mockResolvedValue(makeState(5));
    svc.createLiveMatch.mockResolvedValue(makeState(1, { phase: "preMatch" }));
    rt.connection.joinMatch.mockResolvedValue(undefined);
    rt.connection.leaveMatch.mockResolvedValue(undefined);
    rt.connection.stop.mockResolvedValue(undefined);
    rt.connectLiveMatch.mockResolvedValue(rt.connection);
    dispatchSpy = vi.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("al montar carga el estado del evento, se une al grupo del hub y queda listo", async () => {
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(svc.getLiveMatch).toHaveBeenCalledWith(EVENT_ID);
    expect(result.current.state?.version).toBe(5);
    expect(rt.connection.joinMatch).toHaveBeenCalledWith(EVENT_ID);
  });

  it("con un 404 deja el estado en null hasta que ensureCreated crea el estado", async () => {
    svc.getLiveMatch.mockResolvedValue(null);
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.state).toBeNull();

    await act(async () => {
      await result.current.ensureCreated();
    });

    expect(svc.createLiveMatch).toHaveBeenCalledWith(EVENT_ID);
    expect(result.current.state?.version).toBe(1);
  });

  it("al reconectar vuelve a leer el estado y se une de nuevo al grupo", async () => {
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      handlers().onReconnected();
    });

    await waitFor(() => expect(svc.getLiveMatch).toHaveBeenCalledTimes(2));
    expect(rt.connection.joinMatch).toHaveBeenCalledTimes(2);
  });

  it("con la versión 5 al recibir la versión 8 vuelve a leer el estado y no aplica el evento", async () => {
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      handlers().onMatchUpdated(makeState(8, { scoreLocal: 4 }));
    });

    await waitFor(() => expect(svc.getLiveMatch).toHaveBeenCalledTimes(2));
    expect(result.current.state?.scoreLocal).toBe(0);
    expect(result.current.state?.version).toBe(5);
  });

  it("con la versión 5 al recibir la versión 6 la aplica directamente sin volver a leer", async () => {
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      handlers().onMatchUpdated(makeState(6, { scoreLocal: 1 }));
    });

    await waitFor(() => expect(result.current.state?.version).toBe(6));
    expect(result.current.state?.scoreLocal).toBe(1);
    expect(svc.getLiveMatch).toHaveBeenCalledTimes(1);
  });

  it("un cambio hecho desde otro dispositivo sustituye el estado local", async () => {
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      handlers().onMatchUpdated(makeState(6, { scoreLocal: 2, phase: "halftime" }));
    });

    await waitFor(() => expect(result.current.state?.phase).toBe("halftime"));
    expect(result.current.state?.scoreLocal).toBe(2);
  });

  it("send('goal') en la versión 4 llama a sendLiveMatchAction con baseVersion 4 y aplica el estado devuelto", async () => {
    svc.getLiveMatch.mockResolvedValue(makeState(4));
    svc.sendLiveMatchAction.mockResolvedValue({ conflict: false, state: makeState(5, { scoreLocal: 1 }) });
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => {
      handlers().onStatusChange("connected");
    });

    let outcome: { ok: boolean; conflict: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.send("goal", { scoreLocal: 1, scoreVisitor: 0 });
    });

    expect(svc.sendLiveMatchAction).toHaveBeenCalledWith(EVENT_ID, {
      type: "goal",
      baseVersion: 4,
      payload: { scoreLocal: 1, scoreVisitor: 0 },
    });
    expect(outcome).toEqual({ ok: true, conflict: false });
    expect(result.current.state?.version).toBe(5);
    expect(result.current.state?.scoreLocal).toBe(1);
  });

  it("ante un conflicto aplica el estado ganador, no aplica la acción local y avisa al coach", async () => {
    svc.getLiveMatch.mockResolvedValue(makeState(5));
    svc.sendLiveMatchAction.mockResolvedValue({ conflict: true, state: makeState(6, { scoreLocal: 3 }) });
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => {
      handlers().onStatusChange("connected");
    });

    let outcome: { ok: boolean; conflict: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.send("goal", { scoreLocal: 1, scoreVisitor: 0 });
    });

    expect(outcome).toEqual({ ok: false, conflict: true });
    expect(result.current.state?.version).toBe(6);
    expect(result.current.state?.scoreLocal).toBe(3);
    const warnings = snackbarDetails(dispatchSpy).filter((detail) => detail.severity === "warning");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("sin conexión queda offline, send no llama al servicio y avisa sin cambiar serverOffsetMs", async () => {
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const offsetBefore = result.current.serverOffsetMs;
    act(() => {
      handlers().onStatusChange("disconnected");
    });

    expect(result.current.status).toBe("offline");
    expect(result.current.isOnline).toBe(false);

    let outcome: { ok: boolean; conflict: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.send("goal", { scoreLocal: 1, scoreVisitor: 0 });
    });

    expect(outcome).toEqual({ ok: false, conflict: false });
    expect(svc.sendLiveMatchAction).not.toHaveBeenCalled();
    expect(snackbarDetails(dispatchSpy).length).toBeGreaterThan(0);
    expect(result.current.serverOffsetMs).toBe(offsetBefore);
  });

  it("al desmontar sale del grupo y cierra la conexión", async () => {
    const { result, unmount } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    unmount();

    await waitFor(() => expect(rt.connection.leaveMatch).toHaveBeenCalledWith(EVENT_ID));
    expect(rt.connection.stop).toHaveBeenCalledTimes(1);
  });

  it("un MatchDeleted del evento abierto pone el estado a null y vuelve a leerlo", async () => {
    svc.getLiveMatch.mockResolvedValueOnce(makeState(5)).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      handlers().onMatchDeleted(EVENT_ID);
    });

    await waitFor(() => expect(result.current.state).toBeNull());
    expect(svc.getLiveMatch).toHaveBeenCalledTimes(2);
  });

  it("un MatchDeleted de otro evento no cambia el estado abierto", async () => {
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      handlers().onMatchDeleted("otro-evento");
    });

    expect(result.current.state?.version).toBe(5);
    expect(svc.getLiveMatch).toHaveBeenCalledTimes(1);
  });

  it("serverOffsetMs se calcula con el serverNowUtc recibido del servidor", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(SERVER_NOW) + 20_000);
    const { result } = renderHook(() => useLiveMatchServerState(EVENT_ID));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.serverOffsetMs).toBe(-20_000);
  });
});
