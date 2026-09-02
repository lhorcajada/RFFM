import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";

vi.mock("../../../../services/liveMatchService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/liveMatchService")>(
    "../../../../services/liveMatchService",
  );
  return {
    ...actual,
    saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getMatchParticipation: vi.fn().mockResolvedValue(null),
    deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
  };
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";
const BACKUP_KEY = `rffm_live:${EVENT_ID}`;

function readBackup(): Record<string, unknown> | null {
  const raw = localStorage.getItem(BACKUP_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe("useLiveMatch - persistencia del cronómetro en localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("guarda un timestamp real de inicio en localStorage al confirmar el inicio del partido", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    act(() => {
      result.current.initMatch({ 0: "p1", 1: "p2" });
    });
    act(() => {
      result.current.setPendingAction("startMatch");
    });
    act(() => {
      result.current.confirmAction();
    });

    const backup = readBackup();
    expect(backup).not.toBeNull();
    expect(backup?.matchPhase).toBe("firstHalf");
    expect(backup?.teamId).toBe(TEAM_ID);
    expect(typeof backup?.savedAt).toBe("string");
    // savedAt must be a real, parseable timestamp close to "now"
    const savedAtMs = new Date(backup?.savedAt as string).getTime();
    expect(Math.abs(Date.now() - savedAtMs)).toBeLessThan(1000);
  });

  it("sigue persistiendo el avance del cronómetro mientras el partido está en curso, sin depender de beforeunload", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    act(() => {
      result.current.initMatch({ 0: "p1" });
    });
    act(() => {
      result.current.setPendingAction("startMatch");
    });
    act(() => {
      result.current.confirmAction();
    });

    // Advance real running time without firing beforeunload/visibilitychange
    act(() => {
      vi.advanceTimersByTime(12000);
    });

    const backup = readBackup();
    expect(backup).not.toBeNull();
    expect((backup?.totalSeconds as number)).toBeGreaterThanOrEqual(10);
  });

  it("recalcula el tiempo transcurrido a partir del timestamp guardado en vez de reiniciar a cero", () => {
    const savedAt = new Date(Date.now() - 65_000).toISOString(); // 65s ago
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({
        eventId: EVENT_ID,
        teamId: TEAM_ID,
        savedAt,
        matchPhase: "firstHalf",
        totalSeconds: 100,
        half: 1,
        isHalftime: false,
        halfDuration: 45,
        slots: { 0: "p1" },
        initialSlots: { 0: "p1" },
        playerStates: {
          p1: { playerId: "p1", slotIndex: 0, minuteEntered: 0, accumulatedMinutes: 0, isOnField: true },
        },
        windows: [],
        goals: [],
        ratingSnapshots: [],
        scoreLocal: 0,
        scoreVisitor: 0,
      }),
    );

    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    expect(result.current.backup).not.toBeNull();

    act(() => {
      result.current.acceptBackup();
    });

    // 100s stored + ~65s elapsed = ~165s => 2min 45s, never back to 0
    const totalSeconds = result.current.currentMinute * 60 + result.current.currentSecond;
    expect(totalSeconds).toBeGreaterThanOrEqual(160);
    expect(result.current.matchPhase).toBe("firstHalf");
  });

  it("persiste el estado al desmontar el componente aunque no se dispare beforeunload/visibilitychange (navegación interna de la SPA)", () => {
    const { result, unmount } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    act(() => {
      result.current.initMatch({ 0: "p1" });
    });
    act(() => {
      result.current.setPendingAction("startMatch");
    });
    act(() => {
      result.current.confirmAction();
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    unmount();

    const backup = readBackup();
    expect(backup).not.toBeNull();
    expect(backup?.matchPhase).toBe("firstHalf");
  });

  it("limpia el estado persistido cuando el usuario finaliza el partido manualmente (sin dejar un timer fantasma)", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    act(() => {
      result.current.initMatch({ 0: "p1" });
    });
    act(() => {
      result.current.setPendingAction("startMatch");
    });
    act(() => {
      result.current.confirmAction();
    });
    expect(readBackup()).not.toBeNull();

    act(() => {
      result.current.setPendingAction("endMatch");
    });
    act(() => {
      result.current.confirmAction();
    });

    expect(readBackup()).toBeNull();
  });

  it("no detiene el cronómetro automáticamente al llegar a la duración configurada del partido", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    act(() => {
      result.current.initMatch({ 0: "p1" });
      result.current.setHalfDuration(1); // 1-minute halves for a fast test
    });
    act(() => {
      result.current.setPendingAction("startMatch");
    });
    act(() => {
      result.current.confirmAction();
    });
    act(() => {
      result.current.setPendingAction("endFirstHalf");
    });
    act(() => {
      result.current.confirmAction();
    });
    act(() => {
      result.current.setPendingAction("startSecondHalf");
    });
    act(() => {
      result.current.confirmAction();
    });

    // Advance past the configured 2x1min = 120s duration
    act(() => {
      vi.advanceTimersByTime(130_000);
    });

    expect(result.current.matchPhase).toBe("secondHalf");
    expect(result.current.currentMinute * 60 + result.current.currentSecond).toBeGreaterThanOrEqual(130);
  });
});
