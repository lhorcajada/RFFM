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

function startedMatch() {
  const hook = renderHook(() => useLiveMatch("event-1", "team-1", true));
  act(() => {
    hook.result.current.initMatch({ 0: "p1" });
  });
  act(() => {
    hook.result.current.setPendingAction("startMatch");
  });
  act(() => {
    hook.result.current.confirmAction();
  });
  return hook;
}

const seconds = (r: { currentMinute: number; currentSecond: number }) =>
  r.currentMinute * 60 + r.currentSecond;

describe("useLiveMatch - ajuste manual del reloj", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adelanta el reloj los minutos indicados mientras el partido está en juego", () => {
    const { result } = startedMatch();

    act(() => result.current.adjustClock(5));

    expect(result.current.currentMinute).toBe(5);
  });

  it("retrasa el reloj los minutos indicados", () => {
    const { result } = startedMatch();
    act(() => result.current.adjustClock(10));

    act(() => result.current.adjustClock(-3));

    expect(result.current.currentMinute).toBe(7);
  });

  it("no baja de 00:00 al retrasar", () => {
    const { result } = startedMatch();
    act(() => result.current.adjustClock(2));

    act(() => result.current.adjustClock(-10));

    expect(seconds(result.current)).toBe(0);
  });

  it("el reloj sigue corriendo desde el nuevo valor tras ajustarlo", () => {
    const { result } = startedMatch();
    act(() => result.current.adjustClock(5));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(seconds(result.current)).toBe(5 * 60 + 10);
  });

  it("no ajusta el reloj antes de iniciar el partido", () => {
    const { result } = renderHook(() => useLiveMatch("event-1", "team-1", true));
    act(() => {
      result.current.initMatch({ 0: "p1" });
    });

    act(() => result.current.adjustClock(5));

    expect(seconds(result.current)).toBe(0);
  });
});
