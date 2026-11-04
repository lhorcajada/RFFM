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
    getEventMinuteLimitSanctions: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("../../../../services/liveMatchRealtimeService", async () => {
  const fake = await import("./fakeLiveMatchServer");
  return fake.liveMatchRealtimeMocks();
});

const EVENT_ID = "event-lineup";
const TEAM_ID = "team-abc";

type Hook = { current: ReturnType<typeof useLiveMatch> };

async function play(result: Hook) {
  await step(() => result.current.setPendingAction("startMatch"));
  await step(() => result.current.confirmAction());
  await step(() => {
    vi.advanceTimersByTime(10 * 60 * 1000);
  });
}

async function endMatchAndReadStoredLineup(result: Hook): Promise<Record<string, unknown>> {
  await step(() => result.current.setPendingAction("endFirstHalf"));
  await step(() => result.current.confirmAction());
  await step(() => result.current.setPendingAction("startSecondHalf"));
  await step(() => result.current.confirmAction());
  await step(() => result.current.setPendingAction("endMatch"));
  await act(async () => {
    result.current.confirmAction();
  });
  const stored = getFakeLiveMatchServer().state?.matchData.startingLineupJson ?? null;
  return JSON.parse(stored ?? "null") as Record<string, unknown>;
}

describe("useLiveMatch - alineación inicial", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("al cerrar el partido el servidor conserva el esquema y los huecos iniciales", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await step(() => result.current.initMatch({ 0: "p1", 9: "p2" }, { id: "f1", name: "4-4-2" }));
    await play(result);

    const lineup = await endMatchAndReadStoredLineup(result);

    expect(lineup).toEqual({
      formationId: "f1",
      formationName: "4-4-2",
      slots: { 0: "p1", 9: "p2" },
    });
  });

  it("un cambio de esquema durante el partido no cambia el esquema inicial", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await step(() => result.current.initMatch({ 0: "p1", 9: "p2" }, { id: "f1", name: "4-4-2" }));
    await play(result);
    await step(() => result.current.changeFormation("f2", "4-3-3", { 0: "p1", 10: "p2" }));

    const lineup = await endMatchAndReadStoredLineup(result);

    expect(lineup).toMatchObject({
      formationName: "4-4-2",
      slots: { 0: "p1", 9: "p2" },
    });
  });

  it("tras recargar la pantalla el esquema inicial sigue en el servidor sin copia local", async () => {
    const first = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await step(() => first.result.current.initMatch({ 0: "p1" }, { id: "f1", name: "4-4-2" }));
    await play(first.result);
    first.unmount();

    const stored = getFakeLiveMatchServer().state;
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored?.matchData.startingLineupJson ?? "null")).toMatchObject({ formationName: "4-4-2" });
    expect(localStorage.getItem(`rffm_live:${EVENT_ID}`)).toBeNull();
  });
});
