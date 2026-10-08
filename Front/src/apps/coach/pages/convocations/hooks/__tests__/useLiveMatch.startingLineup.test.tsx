import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { saveMatchParticipation } from "../../../../services/liveMatchService";
import type { LiveMatchParticipationPayload } from "../../components/simulation/liveMatch.types";

vi.mock("../../../../services/liveMatchService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/liveMatchService")>(
    "../../../../services/liveMatchService",
  );
  return {
    ...actual,
    saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getMatchParticipation: vi.fn().mockResolvedValue(null),
    deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getEventMinuteLimitSanctions: vi.fn().mockResolvedValue([]),
  };
});

const EVENT_ID = "event-lineup";
const TEAM_ID = "team-abc";

type Hook = { current: ReturnType<typeof useLiveMatch> };

function play(result: Hook) {
  act(() => result.current.setPendingAction("startMatch"));
  act(() => result.current.confirmAction());
  act(() => {
    vi.advanceTimersByTime(10 * 60 * 1000);
  });
}

async function endAndSave(result: Hook): Promise<LiveMatchParticipationPayload> {
  act(() => result.current.setPendingAction("endMatch"));
  act(() => result.current.confirmAction());
  await act(async () => {
    result.current.confirmSave();
  });
  return vi.mocked(saveMatchParticipation).mock.calls[0][1];
}

describe("useLiveMatch - alineación inicial", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("al guardar envía el esquema y los huecos iniciales", async () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    act(() => result.current.initMatch({ 0: "p1", 9: "p2" }, { id: "f1", name: "4-4-2" }));
    play(result);

    const payload = await endAndSave(result);

    expect(JSON.parse(payload.startingLineupJson ?? "null")).toEqual({
      formationId: "f1",
      formationName: "4-4-2",
      slots: { 0: "p1", 9: "p2" },
    });
  });

  it("un cambio de esquema durante el partido no cambia el esquema inicial", async () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    act(() => result.current.initMatch({ 0: "p1", 9: "p2" }, { id: "f1", name: "4-4-2" }));
    play(result);
    act(() => result.current.changeFormation("f2", "4-3-3", { 0: "p1", 10: "p2" }));

    const payload = await endAndSave(result);

    expect(JSON.parse(payload.startingLineupJson ?? "null")).toMatchObject({
      formationName: "4-4-2",
      slots: { 0: "p1", 9: "p2" },
    });
  });

  it("al restaurar una copia de seguridad conserva el esquema inicial", async () => {
    const first = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    act(() => first.result.current.initMatch({ 0: "p1" }, { id: "f1", name: "4-4-2" }));
    play(first.result);
    first.unmount();

    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    act(() => result.current.acceptBackup());

    const payload = await endAndSave(result);

    expect(JSON.parse(payload.startingLineupJson ?? "null")).toMatchObject({ formationName: "4-4-2" });
  });
});
