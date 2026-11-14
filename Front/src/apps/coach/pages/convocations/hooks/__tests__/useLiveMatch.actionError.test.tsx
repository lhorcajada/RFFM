import { step, renderSettledHook } from "./fakeLiveMatchServer";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { getFakeLiveMatchServer, resetFakeLiveMatchServer } from "./fakeLiveMatchServer";

vi.mock("../../../../services/liveMatchService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/liveMatchService")>(
    "../../../../services/liveMatchService",
  );
  const fake = await import("./fakeLiveMatchServer");
  return {
    ...actual,
    ...fake.liveMatchServiceMocks(),
    saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getMatchParticipation: vi.fn().mockResolvedValue(null),
    deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getEventMinuteLimitSanctions: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("../../../../services/liveMatchRealtimeService", async () => {
  const fake = await import("./fakeLiveMatchServer");
  return fake.liveMatchRealtimeMocks();
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";
const ACTION_ERROR = "No se ha podido guardar la última acción en el servidor. Revisa el partido.";

type Snackbar = { message: string; severity: string };

async function startMatch(result: { current: ReturnType<typeof useLiveMatch> }) {
  await step(() => {
    result.current.initMatch({ 0: "p0", 1: "p1" }, { id: "f1", name: "4-4-2" });
  });
  await step(() => {
    result.current.setPendingAction("startMatch");
  });
  await step(() => {
    result.current.confirmAction();
  });
}

describe("useLiveMatch — error al guardar una acción en el servidor", () => {
  const messages: Snackbar[] = [];
  const listener = (event: Event) => messages.push((event as CustomEvent<Snackbar>).detail);

  beforeEach(() => {
    localStorage.clear();
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
    messages.length = 0;
    window.addEventListener("rffm.show_snackbar", listener);
  });

  afterEach(() => {
    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("si el servidor rechaza una acción con un motivo, el aviso lo muestra junto al código HTTP", async () => {
    const server = getFakeLiveMatchServer();
    server.sendLiveMatchAction.mockRejectedValueOnce({
      response: { status: 400, data: { detail: "El partido no está en juego." } },
    });
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await startMatch(result);

    await waitFor(() =>
      expect(messages.map((m) => m.message)).toContain(`${ACTION_ERROR} (400: El partido no está en juego.)`),
    );
  });

  it("si el servidor falla sin motivo, el aviso muestra solo el código HTTP", async () => {
    const server = getFakeLiveMatchServer();
    server.sendLiveMatchAction.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await startMatch(result);

    await waitFor(() => expect(messages.map((m) => m.message)).toContain(`${ACTION_ERROR} (500)`));
  });

  it("si el fallo no viene del servidor, el aviso es el genérico", async () => {
    const server = getFakeLiveMatchServer();
    server.sendLiveMatchAction.mockRejectedValueOnce(new Error("network"));
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await startMatch(result);

    await waitFor(() => expect(messages.map((m) => m.message)).toContain(ACTION_ERROR));
  });
});
