import { describe, it, expect, vi, beforeEach } from "vitest";
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

describe("useLiveMatch - setScore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sets the score directly, independent of the goals list", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    act(() => {
      result.current.initMatch({ 0: "p1" });
    });
    act(() => {
      result.current.setScore(3, 2);
    });

    expect(result.current.scoreLocal).toBe(3);
    expect(result.current.scoreVisitor).toBe(2);
    expect(result.current.goals).toEqual([]);
  });

  it("does not allow a negative score", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    act(() => {
      result.current.initMatch({ 0: "p1" });
    });
    act(() => {
      result.current.setScore(-1, -5);
    });

    expect(result.current.scoreLocal).toBe(0);
    expect(result.current.scoreVisitor).toBe(0);
  });
});
