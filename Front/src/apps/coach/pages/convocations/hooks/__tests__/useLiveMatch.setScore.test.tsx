import { step, renderSettledHook } from "./fakeLiveMatchServer";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { resetFakeLiveMatchServer } from "./fakeLiveMatchServer";

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

describe("useLiveMatch - setScore", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
  });

  it("sets the score directly, independent of the goals list", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await step(() => {
      result.current.initMatch({ 0: "p1" });
    });
    await step(() => {
      result.current.setScore(3, 2);
    });

    expect(result.current.scoreLocal).toBe(3);
    expect(result.current.scoreVisitor).toBe(2);
    expect(result.current.goals).toEqual([]);
  });

  it("does not allow a negative score", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await step(() => {
      result.current.initMatch({ 0: "p1" });
    });
    await step(() => {
      result.current.setScore(-1, -5);
    });

    expect(result.current.scoreLocal).toBe(0);
    expect(result.current.scoreVisitor).toBe(0);
  });
});
