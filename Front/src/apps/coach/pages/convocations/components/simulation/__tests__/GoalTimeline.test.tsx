import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GoalTimeline from "../GoalTimeline";
import type { GoalEvent } from "../liveMatch.types";

function makeGoal(overrides: Partial<GoalEvent> = {}): GoalEvent {
  return {
    id: "g1",
    minute: 10,
    scorerId: "p1",
    scorerName: "Jugador Uno",
    scorerDorsal: 9,
    isOwnTeam: true,
    scoreAtMoment: { local: 1, visitor: 0 },
    pitchZone: null,
    bodyPart: null,
    ...overrides,
  };
}

describe("GoalTimeline - zone / body-part indicator", () => {
  it("renders extra indicator when both pitchZone and bodyPart are set", () => {
    const goal = makeGoal({ pitchZone: { col: 2, row: 7 }, bodyPart: "head" });
    render(<GoalTimeline goals={[goal]} onRemoveGoal={vi.fn()} />);
    expect(screen.getByTitle(/cabeza/i)).toBeInTheDocument();
    expect(screen.getByText(/2.*7|7.*2/)).toBeInTheDocument();
  });

  it("renders exactly as before for a legacy goal (pitchZone null)", () => {
    const goal = makeGoal({ pitchZone: null, bodyPart: null });
    render(<GoalTimeline goals={[goal]} onRemoveGoal={vi.fn()} />);
    expect(screen.queryByTitle(/cabeza/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/pie/i)).not.toBeInTheDocument();
  });
});
