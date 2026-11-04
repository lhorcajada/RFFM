import { step, renderSettledHook, waitForAsync } from "./fakeLiveMatchServer";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import type { LiveMatchServerState } from "../../components/simulation/liveMatch.types";
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
  };
});

vi.mock("../../../../services/liveMatchRealtimeService", async () => {
  const fake = await import("./fakeLiveMatchServer");
  return fake.liveMatchRealtimeMocks();
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";
const BACKUP_KEY = `rffm_live:${EVENT_ID}`;

function serverState(partial: Partial<LiveMatchServerState>): LiveMatchServerState {
  return {
    eventId: EVENT_ID,
    teamId: TEAM_ID,
    version: 3,
    phase: "firstHalf",
    clock: { baseSeconds: 0, referenceUtc: new Date().toISOString() },
    matchDurationMinutes: 90,
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
    serverNowUtc: new Date().toISOString(),
    ...partial,
  };
}

describe("useLiveMatch - cronómetro y estado en el servidor", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("al confirmar el inicio el servidor pasa a la primera parte y no se escribe copia en localStorage", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await step(() => {
      result.current.initMatch({ 0: "p1", 1: "p2" });
    });
    await step(() => {
      result.current.setPendingAction("startMatch");
    });
    await step(() => {
      result.current.confirmAction();
    });

    expect(getFakeLiveMatchServer().state?.phase).toBe("firstHalf");
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });

  it("el cronómetro avanza con el reloj del servidor sin depender de beforeunload", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await step(() => {
      result.current.initMatch({ 0: "p1" });
    });
    await step(() => {
      result.current.setPendingAction("startMatch");
    });
    await step(() => {
      result.current.confirmAction();
    });

    await step(() => {
      vi.advanceTimersByTime(12000);
    });

    expect(result.current.currentMinute * 60 + result.current.currentSecond).toBeGreaterThanOrEqual(10);
    expect(getFakeLiveMatchServer().state?.clock.referenceUtc).not.toBeNull();
  });

  it("recalcula el tiempo transcurrido desde la referencia del servidor al volver a la pantalla", async () => {
    getFakeLiveMatchServer().setServerState(
      serverState({
        clock: { baseSeconds: 100, referenceUtc: new Date(Date.now() - 65_000).toISOString() },
        phase: "firstHalf",
      }),
    );

    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await waitForAsync(() => expect(result.current.matchPhase).toBe("firstHalf"));
    // 100s stored + ~65s elapsed = ~165s => 2min 45s, never back to 0
    const totalSeconds = result.current.currentMinute * 60 + result.current.currentSecond;
    expect(totalSeconds).toBeGreaterThanOrEqual(160);
  });

  it("al desmontar la pantalla el partido sigue en el servidor sin copia local", async () => {
    const { result, unmount } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await step(() => {
      result.current.initMatch({ 0: "p1" });
    });
    await step(() => {
      result.current.setPendingAction("startMatch");
    });
    await step(() => {
      result.current.confirmAction();
    });
    await step(() => {
      vi.advanceTimersByTime(3000);
    });

    unmount();

    expect(getFakeLiveMatchServer().state?.phase).toBe("firstHalf");
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });

  it("al finalizar manualmente el servidor cierra el partido y no queda copia local", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await step(() => {
      result.current.initMatch({ 0: "p1" });
    });
    await step(() => {
      result.current.setPendingAction("startMatch");
    });
    await step(() => {
      result.current.confirmAction();
    });
    expect(getFakeLiveMatchServer().state?.phase).toBe("firstHalf");

    await step(() => {
      result.current.setPendingAction("endFirstHalf");
    });
    await step(() => {
      result.current.confirmAction();
    });
    await step(() => {
      result.current.setPendingAction("startSecondHalf");
    });
    await step(() => {
      result.current.confirmAction();
    });
    await step(() => {
      result.current.setPendingAction("endMatch");
    });
    await step(() => {
      result.current.confirmAction();
    });

    expect(getFakeLiveMatchServer().state?.phase).toBe("finished");
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });

  it("no detiene el cronómetro automáticamente al llegar a la duración configurada del partido", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await step(() => {
      result.current.initMatch({ 0: "p1" });
      result.current.setHalfDuration(1); // 1-minute halves for a fast test
    });
    await step(() => {
      result.current.setPendingAction("startMatch");
    });
    await step(() => {
      result.current.confirmAction();
    });
    await step(() => {
      result.current.setPendingAction("endFirstHalf");
    });
    await step(() => {
      result.current.confirmAction();
    });
    await step(() => {
      result.current.setPendingAction("startSecondHalf");
    });
    await step(() => {
      result.current.confirmAction();
    });

    // Advance past the configured 2x1min = 120s duration
    await step(() => {
      vi.advanceTimersByTime(130_000);
    });

    expect(result.current.matchPhase).toBe("secondHalf");
    expect(result.current.currentMinute * 60 + result.current.currentSecond).toBeGreaterThanOrEqual(130);
  });

  it("al recuperar una segunda parte que ya superó la duración configurada no fuerza su fin y el reloj sigue corriendo", async () => {
    // Server state of a second half that started 40 minutes ago (device was backgrounded).
    getFakeLiveMatchServer().setServerState(
      serverState({
        phase: "secondHalf",
        version: 9,
        clock: { baseSeconds: 50 * 60, referenceUtc: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
        matchDurationMinutes: 90,
      }),
    );

    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await waitForAsync(() => expect(result.current.matchPhase).toBe("secondHalf"));

    // The match must remain in progress — only the coach can end it explicitly.
    const totalSecondsBefore = result.current.currentMinute * 60 + result.current.currentSecond;
    await step(() => {
      vi.advanceTimersByTime(5000);
    });
    const totalSecondsAfter = result.current.currentMinute * 60 + result.current.currentSecond;
    expect(totalSecondsAfter).toBeGreaterThan(totalSecondsBefore);
  });
});
