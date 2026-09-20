import { StrictMode, type ReactNode } from "react";
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

const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

const setup = (wrapper?: typeof strict) => {
  const utils = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true), wrapper ? { wrapper } : undefined);
  act(() => {
    utils.result.current.initMatch({ 0: "p1" });
  });
  return utils.result;
};

const partials = (r: ReturnType<typeof setup>) =>
  r.current.goals.map((g) => `${g.minute}:${g.scoreAtMoment.local}-${g.scoreAtMoment.visitor}`);

describe.each([
  ["normal", undefined],
  ["StrictMode", strict],
])("useLiveMatch - goals ordering and partial scores (%s)", (_n, wrapper) => {
  beforeEach(() => localStorage.clear());

  it("reproduce el partido 5-1 con parciales coherentes tras eliminar y volver a añadir", () => {
    const r = setup(wrapper);
    act(() => r.current.addGoal(null, "RIVAL", null, false, null, null, 30));
    act(() => r.current.addGoal("a", "PABLO", 1, true, null, null, 32));
    act(() => r.current.addGoal("b", "HUGUITO", 2, true, null, null, 48));
    act(() => r.current.addGoal("a", "PABLO", 1, true, null, null, 52));
    act(() => r.current.addGoal("b", "HUGUITO", 2, true, null, null, 25));
    act(() => r.current.addGoal("c", "SERGIO", 3, true, null, null, 62));
    const removeId = r.current.goals.find((g) => g.minute === 48)!.id;
    act(() => r.current.removeGoal(removeId));
    act(() => r.current.addGoal("b", "HUGUITO", 2, true, null, null, 48));

    expect(partials(r)).toEqual(["25:1-0", "30:1-1", "32:2-1", "48:3-1", "52:4-1", "62:5-1"]);
    expect(r.current.scoreLocal).toBe(5);
    expect(r.current.scoreVisitor).toBe(1);
  });

  it("coloca ordenado un gol con minuto anterior y recalcula parciales", () => {
    const r = setup(wrapper);
    act(() => r.current.addGoal("a", "A", 1, true, null, null, 40));
    act(() => r.current.addGoal(null, "R", null, false, null, null, 10));
    expect(partials(r)).toEqual(["10:0-1", "40:1-1"]);
  });

  it("updateGoal cambia isOwnTeam y recalcula marcador y parciales", () => {
    const r = setup(wrapper);
    act(() => r.current.addGoal("a", "A", 1, true, null, null, 10));
    act(() => r.current.addGoal("a", "A", 1, true, null, null, 20));
    const id = r.current.goals[0].id;
    act(() => r.current.updateGoal(id, { isOwnTeam: false }));
    expect(partials(r)).toEqual(["10:0-1", "20:1-1"]);
    expect(r.current.scoreLocal).toBe(1);
    expect(r.current.scoreVisitor).toBe(1);
  });

  it("updateGoal cambia el minuto y reordena", () => {
    const r = setup(wrapper);
    act(() => r.current.addGoal("a", "A", 1, true, null, null, 10));
    act(() => r.current.addGoal(null, "R", null, false, null, null, 20));
    const id = r.current.goals[0].id;
    act(() => r.current.updateGoal(id, { minute: 50 }));
    expect(partials(r)).toEqual(["20:0-1", "50:1-1"]);
    expect(r.current.scoreLocal).toBe(1);
    expect(r.current.scoreVisitor).toBe(1);
  });

  it("eliminar un gol no deriva el marcador fijado manualmente", () => {
    const r = setup(wrapper);
    act(() => r.current.addGoal("a", "A", 1, true, null, null, 10));
    act(() => r.current.setScore(5, 1));
    act(() => r.current.removeGoal(r.current.goals[0].id));
    expect(r.current.scoreLocal).toBe(4);
    expect(r.current.scoreVisitor).toBe(1);
  });
});
