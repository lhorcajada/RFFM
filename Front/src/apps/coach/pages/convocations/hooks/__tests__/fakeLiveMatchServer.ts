import { vi } from "vitest";
import { act, renderHook, type RenderHookOptions } from "@testing-library/react";
import type {
  LiveMatchActionRequest,
  LiveMatchActionResult,
  LiveMatchFinishPlayer,
  LiveMatchServerState,
} from "../../components/simulation/liveMatch.types";
import type {
  LiveMatchRealtimeConnection,
  LiveMatchRealtimeHandlers,
} from "../../../../services/liveMatchRealtimeService";

// In-memory stand-in for the backend live match (state version, server clock, 409 on stale
// base version, closed state after finish). Time comes from Date.now(), so tests that use
// vi.useFakeTimers() control the server clock too.

type MatchDocumentKey =
  | "startingLineupJson"
  | "playersJson"
  | "substitutionWindowsJson"
  | "ratingSnapshotsJson"
  | "goalsJson"
  | "cardsJson"
  | "formationChangesJson";

const DOCUMENT_KEYS: MatchDocumentKey[] = [
  "startingLineupJson",
  "playersJson",
  "substitutionWindowsJson",
  "ratingSnapshotsJson",
  "goalsJson",
  "cardsJson",
  "formationChangesJson",
];

export type FakeLiveMatchServerOptions = {
  eventId?: string;
  teamId?: string;
  matchDurationMinutes?: number;
  initialState?: LiveMatchServerState | null;
};

export function createFakeLiveMatchServer(options: FakeLiveMatchServerOptions = {}) {
  const eventId = options.eventId ?? "event-1";
  const teamId = options.teamId ?? "team-1";
  const defaultDuration = options.matchDurationMinutes ?? 60;

  let state: LiveMatchServerState | null = options.initialState ? structuredClone(options.initialState) : null;
  let offline = false;
  let handlers: LiveMatchRealtimeHandlers | null = null;
  const finishCalls: Array<{ baseVersion: number; players: LiveMatchFinishPlayer[] }> = [];

  const nowMs = () => Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  const snapshot = (): LiveMatchServerState | null => (state ? structuredClone(state) : null);

  const elapsedAt = (s: LiveMatchServerState, atMs: number): number =>
    s.clock.referenceUtc === null
      ? s.clock.baseSeconds
      : s.clock.baseSeconds + Math.floor((atMs - Date.parse(s.clock.referenceUtc)) / 1000);

  const isRunning = (s: LiveMatchServerState) => s.phase === "firstHalf" || s.phase === "secondHalf";

  const preMatchState = (): LiveMatchServerState => {
    const at = nowMs();
    return {
      eventId,
      teamId,
      version: 1,
      phase: "preMatch",
      clock: { baseSeconds: 0, referenceUtc: null },
      matchDurationMinutes: defaultDuration,
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
      serverNowUtc: iso(at),
    };
  };

  const ensureOnline = () => {
    if (offline) throw new Error("offline");
  };

  const mergeDocuments = (target: LiveMatchServerState, documents: unknown) => {
    if (!documents || typeof documents !== "object") return;
    for (const key of DOCUMENT_KEYS) {
      const value = (documents as Record<string, unknown>)[key];
      if (value !== undefined) target.matchData[key] = value as string | null;
    }
  };

  const applyAction = (current: LiveMatchServerState, request: LiveMatchActionRequest): LiveMatchServerState => {
    const at = nowMs();
    const payload = (request.payload ?? {}) as Record<string, unknown>;
    const next = structuredClone(current);

    switch (request.type) {
      case "setDuration":
        if (current.phase !== "preMatch") throw new Error("phase");
        next.matchDurationMinutes = Number(payload.durationMinutes);
        break;
      case "setLineup":
        if (current.phase !== "preMatch") throw new Error("phase");
        if (typeof payload.formation === "string") next.formation = payload.formation;
        mergeDocuments(next, payload.documents);
        break;
      case "kickOff":
        if (current.phase !== "preMatch") throw new Error("phase");
        next.phase = "firstHalf";
        next.clock = { baseSeconds: 0, referenceUtc: iso(at) };
        break;
      case "endHalf":
        if (current.phase !== "firstHalf") throw new Error("phase");
        next.phase = "halftime";
        next.clock = { baseSeconds: elapsedAt(current, at), referenceUtc: null };
        break;
      case "startSecondHalf":
        if (current.phase !== "halftime") throw new Error("phase");
        next.phase = "secondHalf";
        next.clock = { baseSeconds: current.clock.baseSeconds, referenceUtc: iso(at) };
        break;
      case "adjustClock": {
        const delta = Number(payload.deltaSeconds ?? 0);
        next.clock = {
          baseSeconds: Math.max(0, elapsedAt(current, at) + delta),
          referenceUtc: isRunning(current) ? iso(at) : null,
        };
        break;
      }
      case "goal":
      case "card":
      case "substitution":
      case "formationChange":
        if (!isRunning(current) && current.phase !== "halftime") throw new Error("phase");
        if (typeof payload.scoreLocal === "number") next.scoreLocal = payload.scoreLocal;
        if (typeof payload.scoreVisitor === "number") next.scoreVisitor = payload.scoreVisitor;
        if (typeof payload.formation === "string") next.formation = payload.formation;
        mergeDocuments(next, payload.documents);
        break;
    }

    next.version = current.version + 1;
    next.serverNowUtc = iso(at);
    return next;
  };

  const connection: LiveMatchRealtimeConnection = {
    joinMatch: vi.fn(async (_eventId: string) => undefined),
    leaveMatch: vi.fn(async (_eventId: string) => undefined),
    stop: vi.fn(async () => undefined),
  };

  return {
    eventId,
    teamId,
    connection,

    /** Copy of the stored server state (null when the event has no live state). */
    get state(): LiveMatchServerState | null {
      return snapshot();
    },

    /** Replaces the stored state, as if another device or the server had changed it. */
    setServerState(next: LiveMatchServerState | null) {
      state = next ? structuredClone(next) : null;
    },

    getLiveMatch: vi.fn(async (requestedEventId: string): Promise<LiveMatchServerState | null> => {
      ensureOnline();
      return requestedEventId === eventId ? snapshot() : null;
    }),

    createLiveMatch: vi.fn(async (requestedEventId: string): Promise<LiveMatchServerState> => {
      ensureOnline();
      if (requestedEventId !== eventId) throw new Error("unknown event");
      if (state === null) state = preMatchState();
      return snapshot() as LiveMatchServerState;
    }),

    sendLiveMatchAction: vi.fn(
      async (requestedEventId: string, request: LiveMatchActionRequest): Promise<LiveMatchActionResult> => {
        ensureOnline();
        if (requestedEventId !== eventId || state === null) throw new Error("not found");
        if (request.baseVersion !== state.version) {
          return { conflict: true, state: snapshot() as LiveMatchServerState };
        }
        if (state.isClosed) return { conflict: true, state: snapshot() as LiveMatchServerState };
        state = applyAction(state, request);
        return { conflict: false, state: snapshot() as LiveMatchServerState };
      },
    ),

    finishLiveMatch: vi.fn(
      async (requestedEventId: string, baseVersion: number, players: LiveMatchFinishPlayer[]): Promise<LiveMatchActionResult> => {
        ensureOnline();
        if (requestedEventId !== eventId || state === null) throw new Error("not found");
        finishCalls.push({ baseVersion, players });
        if (baseVersion !== state.version || state.isClosed) {
          return { conflict: true, state: snapshot() as LiveMatchServerState };
        }
        if (state.phase !== "secondHalf") throw new Error("phase");
        const at = nowMs();
        const closed: LiveMatchServerState = {
          ...structuredClone(state),
          phase: "finished",
          clock: { baseSeconds: elapsedAt(state, at), referenceUtc: null },
          isClosed: true,
          version: state.version + 1,
          serverNowUtc: iso(at),
        };
        state = closed;
        return { conflict: false, state: snapshot() as LiveMatchServerState };
      },
    ),

    deleteLiveMatch: vi.fn(async (requestedEventId: string): Promise<void> => {
      ensureOnline();
      if (requestedEventId !== eventId) return;
      state = null;
      handlers?.onMatchDeleted(eventId);
    }),

    connectLiveMatch: vi.fn(async (incoming: LiveMatchRealtimeHandlers): Promise<LiveMatchRealtimeConnection> => {
      handlers = incoming;
      incoming.onStatusChange("connecting");
      if (!offline) incoming.onStatusChange("connected");
      return connection;
    }),

    /** Simulates a MatchUpdated message from the hub. */
    emitUpdate(next: LiveMatchServerState) {
      handlers?.onMatchUpdated(structuredClone(next));
    },

    /** Simulates a MatchDeleted message from the hub for the given event. */
    emitDeleted(deletedEventId: string) {
      handlers?.onMatchDeleted(deletedEventId);
    },

    /** Simulates a dropped connection (offline = true) or its recovery (offline = false). */
    setOffline(value: boolean) {
      offline = value;
      if (!handlers) return;
      if (value) {
        handlers.onStatusChange("disconnected");
      } else {
        handlers.onStatusChange("connected");
        handlers.onReconnected();
      }
    },

    /** Players sent with each finish call, in order. */
    get finishCalls() {
      return finishCalls.slice();
    },
  };
}

export type FakeLiveMatchServer = ReturnType<typeof createFakeLiveMatchServer>;

// Singleton used by vi.mock factories: the mock functions delegate to the current instance,
// so a test can reset the server in beforeEach without re-declaring the mocks.
let current: FakeLiveMatchServer = createFakeLiveMatchServer();

export function resetFakeLiveMatchServer(options: FakeLiveMatchServerOptions = {}): FakeLiveMatchServer {
  current = createFakeLiveMatchServer(options);
  return current;
}

export function getFakeLiveMatchServer(): FakeLiveMatchServer {
  return current;
}

/** Mock implementations for `services/liveMatchService` (REST wrappers) backed by the fake server. */
export function liveMatchServiceMocks() {
  return {
    getLiveMatch: (eventId: string) => current.getLiveMatch(eventId),
    createLiveMatch: (eventId: string) => current.createLiveMatch(eventId),
    sendLiveMatchAction: (eventId: string, request: LiveMatchActionRequest) =>
      current.sendLiveMatchAction(eventId, request),
    finishLiveMatch: (eventId: string, baseVersion: number, players: LiveMatchFinishPlayer[]) =>
      current.finishLiveMatch(eventId, baseVersion, players),
    deleteLiveMatch: (eventId: string) => current.deleteLiveMatch(eventId),
  };
}

/** Mock implementations for `services/liveMatchRealtimeService` (hub) backed by the fake server. */
export function liveMatchRealtimeMocks() {
  return {
    connectLiveMatch: (handlers: LiveMatchRealtimeHandlers) => current.connectLiveMatch(handlers),
  };
}

// ─── Async-driving helpers for suites ────────────────────────────────────────
// The hook loads the server state and creates it lazily, so every action must wait for the
// previous server round-trip. These helpers flush pending promises inside React's act scope.

/** Lets pending fake-server promises (load, create, action responses) settle. */
export async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

/** Runs one synchronous hook action, then waits for the server round-trip it may trigger. */
export async function step(action: () => unknown): Promise<void> {
  act(() => {
    action();
  });
  await flush();
}

/** Mounts a hook and waits for its initial server load before the first action. */
export async function renderSettledHook<T>(callback: () => T, options?: RenderHookOptions<unknown>) {
  const hook = renderHook(callback, options);
  await flush();
  return hook;
}

/**
 * Polls an assertion while flushing fake-server promises. Use instead of testing-library's
 * waitFor in suites that run with vi.useFakeTimers(), where waitFor cannot advance.
 */
export async function waitForAsync(assertion: () => void, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    await flush();
    try {
      assertion();
      return;
    } catch (error) {
      if (i === attempts - 1) throw error;
    }
  }
}
