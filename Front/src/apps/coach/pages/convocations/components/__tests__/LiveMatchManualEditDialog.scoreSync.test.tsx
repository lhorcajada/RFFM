import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LiveMatchManualEditDialog from "../simulation/LiveMatchManualEditDialog";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";

const lineupPlayers: SquadPlayer[] = [{ id: "p1", displayName: "Player One", alias: null, dorsal: 9 }];

function renderDialog(scoreLocal: number, scoreVisitor: number) {
  return (
    <LiveMatchManualEditDialog
      open
      onClose={vi.fn()}
      lineupPlayers={lineupPlayers}
      currentMinutes={{ p1: 60 }}
      onSaveMinutes={vi.fn()}
      localTeamName="Local FC"
      visitorTeamName="Visitor FC"
      scoreLocal={scoreLocal}
      scoreVisitor={scoreVisitor}
      onSetScore={vi.fn()}
      matchDurationMinutes={null}
      defaultMatchDurationMinutes={60}
      onSetMatchDuration={vi.fn()}
      goals={[]}
      onAddGoal={vi.fn()}
      onUpdateGoal={vi.fn()}
      onRemoveGoal={vi.fn()}
      cards={[]}
      onAddCard={vi.fn()}
      onUpdateCard={vi.fn()}
      onRemoveCard={vi.fn()}
    />
  );
}

describe("LiveMatchManualEditDialog - marcador sincronizado con los goles", () => {
  it("actualiza el marcador del formulario cuando los goles cambian el resultado con el diálogo abierto", () => {
    const { rerender } = render(renderDialog(0, 0));

    rerender(renderDialog(1, 2));

    const [local, visitor] = screen.getAllByRole("spinbutton").slice(0, 2);
    expect(local).toHaveValue(1);
    expect(visitor).toHaveValue(2);
  });
});
