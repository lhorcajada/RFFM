import { step, renderSettledHook } from "./fakeLiveMatchServer";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
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
  };
});

vi.mock("../../../../services/liveMatchRealtimeService", async () => {
  const fake = await import("./fakeLiveMatchServer");
  return fake.liveMatchRealtimeMocks();
});

async function startedMatch() {
  const hook = await renderSettledHook(() => useLiveMatch("event-1", "team-1", true));
  await step(() => {
    hook.result.current.initMatch({ 0: "p1" });
  });
  await step(() => {
    hook.result.current.setPendingAction("startMatch");
  });
  await step(() => {
    hook.result.current.confirmAction();
  });
  return hook;
}

const seconds = (r: { currentMinute: number; currentSecond: number }) =>
  r.currentMinute * 60 + r.currentSecond;

describe("useLiveMatch - ajuste manual del reloj", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFakeLiveMatchServer();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adelanta el reloj los minutos indicados mientras el partido está en juego", async () => {
    const { result } = await startedMatch();

    await step(() => result.current.adjustClock(5));

    expect(result.current.currentMinute).toBe(5);
  });

  it("retrasa el reloj los minutos indicados", async () => {
    const { result } = await startedMatch();
    await step(() => result.current.adjustClock(10));

    await step(() => result.current.adjustClock(-3));

    expect(result.current.currentMinute).toBe(7);
  });

  it("no baja de 00:00 al retrasar", async () => {
    const { result } = await startedMatch();
    await step(() => result.current.adjustClock(2));

    await step(() => result.current.adjustClock(-10));

    expect(seconds(result.current)).toBe(0);
  });

  it("el reloj sigue corriendo desde el nuevo valor tras ajustarlo", async () => {
    const { result } = await startedMatch();
    await step(() => result.current.adjustClock(5));

    await step(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(seconds(result.current)).toBe(5 * 60 + 10);
  });

  it("no ajusta el reloj antes de iniciar el partido", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch("event-1", "team-1", true));
    await step(() => {
      result.current.initMatch({ 0: "p1" });
    });

    await step(() => result.current.adjustClock(5));

    expect(seconds(result.current)).toBe(0);
  });

  it("envía la acción adjustClock al servidor con deltaSeconds 120 al adelantar dos minutos", async () => {
    const server = getFakeLiveMatchServer();
    const { result } = await startedMatch();

    await step(() => result.current.adjustClock(2));

    expect(server.sendLiveMatchAction).toHaveBeenLastCalledWith(
      "event-1",
      expect.objectContaining({
        type: "adjustClock",
        payload: expect.objectContaining({ deltaSeconds: 120 }),
      }),
    );
  });

  it("no guarda una copia local del partido en localStorage mientras tiene estado en el servidor", async () => {
    await startedMatch();

    await step(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(localStorage.getItem("rffm_live:event-1")).toBeNull();
  });

  it("sin conexión no envía el ajuste de reloj y avisa al coach", async () => {
    const server = getFakeLiveMatchServer();
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const { result } = await startedMatch();
    await step(() => {
      server.setOffline(true);
    });
    server.sendLiveMatchAction.mockClear();

    await step(() => result.current.adjustClock(2));

    expect(server.sendLiveMatchAction).not.toHaveBeenCalled();
    const notices = dispatchSpy.mock.calls
      .map(([event]) => event as CustomEvent)
      .filter((event) => event.type === "rffm.show_snackbar");
    expect(notices.length).toBeGreaterThan(0);
    dispatchSpy.mockRestore();
  });
});
