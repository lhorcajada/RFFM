import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLiveMatch,
  deleteLiveMatch,
  finishLiveMatch,
  getLiveMatch,
  sendLiveMatchAction,
} from "../../../services/liveMatchService";
import {
  connectLiveMatch,
  type LiveMatchConnectionStatus,
  type LiveMatchRealtimeConnection,
  type LiveMatchRealtimeHandlers,
} from "../../../services/liveMatchRealtimeService";
import type {
  LiveMatchActionRequest,
  LiveMatchActionType,
  LiveMatchFinishPlayer,
  LiveMatchServerState,
} from "../components/simulation/liveMatch.types";
import { computeServerOffsetMs } from "../utils/liveMatchClock";

export type UseLiveMatchServerStateReturn = {
  state: LiveMatchServerState | null;
  status: "loading" | "ready" | "offline";
  isOnline: boolean;
  serverOffsetMs: number;
  send: (type: LiveMatchActionType, payload?: Record<string, unknown>) => Promise<{ ok: boolean; conflict: boolean }>;
  finish: (players: LiveMatchFinishPlayer[]) => Promise<{ ok: boolean; conflict: boolean }>;
  ensureCreated: () => Promise<void>;
  remove: () => Promise<void>;
};

const OFFLINE_MESSAGE =
  "Sin conexión con el servidor: la acción no se ha guardado. Repítela cuando vuelva la conexión.";
const CONFLICT_MESSAGE =
  "Otro dispositivo cambió el partido antes que tú. Revisa el estado actual y repite la acción.";

function showWarning(message: string): void {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity: "warning" } }));
}

// Best-effort teardown: the connection is being dropped either way, so a failed leave must not block stop().
async function closeConnection(connection: LiveMatchRealtimeConnection, eventId: string): Promise<void> {
  await connection.leaveMatch(eventId).catch(() => undefined);
  await connection.stop().catch(() => undefined);
}

export function useLiveMatchServerState(eventId: string | undefined): UseLiveMatchServerStateReturn {
  const [state, setState] = useState<LiveMatchServerState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hubStatus, setHubStatus] = useState<LiveMatchConnectionStatus>("connecting");
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  // Refs hold what the callbacks must read at call time (base version, hub status, open event).
  const stateRef = useRef<LiveMatchServerState | null>(null);
  const hubStatusRef = useRef<LiveMatchConnectionStatus>("connecting");
  const eventIdRef = useRef<string | undefined>(undefined);

  const commitState = useCallback((next: LiveMatchServerState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Applies a server state for the open event unless it is older than the one held.
  const applyState = useCallback((next: LiveMatchServerState) => {
    if (next.eventId !== eventIdRef.current) return;
    const current = stateRef.current;
    if (current !== null && next.version < current.version) return;

    stateRef.current = next;
    setState(next);
    setServerOffsetMs(computeServerOffsetMs(next.serverNowUtc, Date.now()));
  }, []);

  const applyFreshRead = useCallback(
    (fresh: LiveMatchServerState | null) => {
      if (fresh === null) commitState(null);
      else applyState(fresh);
    },
    [applyState, commitState],
  );

  useEffect(() => {
    if (eventId === undefined) {
      eventIdRef.current = undefined;
      commitState(null);
      setLoaded(false);
      return undefined;
    }

    const openEventId = eventId;
    eventIdRef.current = openEventId;
    commitState(null);
    setLoaded(false);
    setLoadFailed(false);
    hubStatusRef.current = "connecting";
    setHubStatus("connecting");

    let closed = false;
    let connection: LiveMatchRealtimeConnection | undefined;

    const reread = async (): Promise<void> => {
      const fresh = await getLiveMatch(openEventId);
      if (eventIdRef.current !== openEventId) return;
      applyFreshRead(fresh);
    };

    // A failed background read keeps the last applied state; the next event gap or reconnect retries it.
    const refreshInBackground = () => {
      reread().catch(() => undefined);
    };

    const rejoinAndReread = async (): Promise<void> => {
      if (connection === undefined) return;
      try {
        // Join before reading, so no change between the read and the join is missed.
        await connection.joinMatch(openEventId);
        const fresh = await getLiveMatch(openEventId);
        if (eventIdRef.current !== openEventId) return;
        applyFreshRead(fresh);
        setLoadFailed(false);
      } catch {
        // Keep the last applied state; the next reconnect retries the join and the read.
      }
    };

    const handlers: LiveMatchRealtimeHandlers = {
      onMatchUpdated: (received) => {
        if (eventIdRef.current !== openEventId || received.eventId !== openEventId) return;
        const current = stateRef.current;
        if (current === null) {
          applyState(received);
          return;
        }
        if (received.version <= current.version) return;
        if (received.version > current.version + 1) {
          refreshInBackground();
          return;
        }
        applyState(received);
      },
      onMatchDeleted: (deletedId) => {
        if (eventIdRef.current !== openEventId || deletedId !== openEventId) return;
        commitState(null);
        refreshInBackground();
      },
      onReconnected: () => {
        void rejoinAndReread();
      },
      onStatusChange: (next) => {
        if (eventIdRef.current !== openEventId) return;
        hubStatusRef.current = next;
        setHubStatus(next);
      },
    };

    const open = async (): Promise<void> => {
      const opened = await connectLiveMatch(handlers);
      if (closed) {
        await closeConnection(opened, openEventId);
        return;
      }
      connection = opened;
      // Join before reading: the group membership must exist before the state is taken.
      await opened.joinMatch(openEventId);
      const initial = await getLiveMatch(openEventId);
      if (closed) return;
      applyFreshRead(initial);
      setLoaded(true);
    };

    open().catch(() => {
      if (!closed) setLoadFailed(true);
    });

    return () => {
      closed = true;
      eventIdRef.current = undefined;
      if (connection !== undefined) void closeConnection(connection, openEventId);
    };
  }, [eventId, applyFreshRead, applyState, commitState]);

  const send = useCallback(
    async (type: LiveMatchActionType, payload?: Record<string, unknown>): Promise<{ ok: boolean; conflict: boolean }> => {
      if (hubStatusRef.current !== "connected") {
        showWarning(OFFLINE_MESSAGE);
        return { ok: false, conflict: false };
      }
      const current = stateRef.current;
      if (eventId === undefined || current === null) return { ok: false, conflict: false };

      const request: LiveMatchActionRequest =
        payload === undefined
          ? { type, baseVersion: current.version }
          : { type, baseVersion: current.version, payload };
      const result = await sendLiveMatchAction(eventId, request);
      if (eventIdRef.current !== eventId) return { ok: false, conflict: false };

      // The local action is discarded on conflict; only the server's winning state is applied.
      applyState(result.state);
      if (result.conflict) {
        showWarning(CONFLICT_MESSAGE);
        return { ok: false, conflict: true };
      }
      return { ok: true, conflict: false };
    },
    [eventId, applyState],
  );

  const finish = useCallback(
    async (players: LiveMatchFinishPlayer[]): Promise<{ ok: boolean; conflict: boolean }> => {
      if (hubStatusRef.current !== "connected") {
        showWarning(OFFLINE_MESSAGE);
        return { ok: false, conflict: false };
      }
      const current = stateRef.current;
      if (eventId === undefined || current === null) return { ok: false, conflict: false };

      const result = await finishLiveMatch(eventId, current.version, players);
      if (eventIdRef.current !== eventId) return { ok: false, conflict: false };

      applyState(result.state);
      if (result.conflict) {
        showWarning(CONFLICT_MESSAGE);
        return { ok: false, conflict: true };
      }
      return { ok: true, conflict: false };
    },
    [eventId, applyState],
  );

  const ensureCreated = useCallback(async (): Promise<void> => {
    if (eventId === undefined) return;
    const created = await createLiveMatch(eventId);
    if (eventIdRef.current !== eventId) return;
    applyState(created);
  }, [eventId, applyState]);

  const remove = useCallback(async (): Promise<void> => {
    if (eventId === undefined) return;
    await deleteLiveMatch(eventId);
    if (eventIdRef.current !== eventId) return;
    commitState(null);
  }, [eventId, commitState]);

  const hubIsDown = hubStatus === "disconnected" || hubStatus === "reconnecting";
  const status: UseLiveMatchServerStateReturn["status"] = !loaded && !loadFailed
    ? "loading"
    : hubIsDown || loadFailed
      ? "offline"
      : "ready";

  return {
    state,
    status,
    isOnline: hubStatus === "connected",
    serverOffsetMs,
    send,
    finish,
    ensureCreated,
    remove,
  };
}
