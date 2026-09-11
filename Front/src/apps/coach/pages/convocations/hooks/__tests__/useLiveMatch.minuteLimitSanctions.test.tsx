import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";

const getEventMinuteLimitSanctionsMock = vi.fn();

vi.mock("../../../../services/liveMatchService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/liveMatchService")>(
    "../../../../services/liveMatchService",
  );
  return {
    ...actual,
    saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getMatchParticipation: vi.fn().mockResolvedValue(null),
    deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getEventMinuteLimitSanctions: (...args: unknown[]) => getEventMinuteLimitSanctionsMock(...args),
  };
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";

describe("useLiveMatch - aviso de límite de minutos por sanción", () => {
  beforeEach(() => {
    localStorage.clear();
    getEventMinuteLimitSanctionsMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hace fetch de los límites de minutos por sanción del evento al montar", async () => {
    getEventMinuteLimitSanctionsMock.mockResolvedValue([]);

    renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(getEventMinuteLimitSanctionsMock).toHaveBeenCalledWith(EVENT_ID);
  });

  it("avisa vía rffm.show_snackbar exactamente una vez cuando un jugador sancionado alcanza su límite de minutos", async () => {
    getEventMinuteLimitSanctionsMock.mockResolvedValue([
      { teamPlayerId: "p1", sanctionId: "s1", minutesLimit: 1 },
    ]);

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const { result } = renderHook(() =>
      useLiveMatch(EVENT_ID, TEAM_ID, true, {
        players: [{ id: "p1", displayName: "Juan Pérez" }],
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.initMatch({ 0: "p1" });
    });
    act(() => {
      result.current.setPendingAction("startMatch");
    });
    act(() => {
      result.current.confirmAction();
    });

    // Advance past the 1-minute cap
    act(() => {
      vi.advanceTimersByTime(65_000);
    });

    const snackbarCalls = dispatchSpy.mock.calls.filter(
      ([evt]) => (evt as CustomEvent).type === "rffm.show_snackbar",
    );
    expect(snackbarCalls.length).toBe(1);
    const detail = (snackbarCalls[0][0] as CustomEvent).detail;
    expect(detail.severity).toBe("warning");
    expect(detail.message).toContain("Juan Pérez");

    // Advance further — must not fire again
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    const snackbarCallsAfter = dispatchSpy.mock.calls.filter(
      ([evt]) => (evt as CustomEvent).type === "rffm.show_snackbar",
    );
    expect(snackbarCallsAfter.length).toBe(1);

    dispatchSpy.mockRestore();
  });

  it("no avisa mientras el jugador no ha alcanzado el límite de minutos", async () => {
    getEventMinuteLimitSanctionsMock.mockResolvedValue([
      { teamPlayerId: "p1", sanctionId: "s1", minutesLimit: 30 },
    ]);

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await act(async () => {
      await Promise.resolve();
    });

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
      vi.advanceTimersByTime(5_000);
    });

    const snackbarCalls = dispatchSpy.mock.calls.filter(
      ([evt]) => (evt as CustomEvent).type === "rffm.show_snackbar",
    );
    expect(snackbarCalls.length).toBe(0);

    dispatchSpy.mockRestore();
  });
});
