import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LiveMatchScoreboard from "../LiveMatchScoreboard";
import type { SimSlotPlayer } from "../SimulationPlayerSlot";

const fieldPlayers: SimSlotPlayer[] = [
  { teamPlayerId: "p1", displayName: "Jugador Uno", alias: null, photoSrc: null, dorsal: 9, competitiveness: null },
];

function renderScoreboard(onAddGoal = vi.fn(), isHomeTeam = true) {
  render(
    <LiveMatchScoreboard
      localTeamName="Local FC"
      visitorTeamName="Visitor FC"
      scoreLocal={0}
      scoreVisitor={0}
      matchPhase="firstHalf"
      fieldPlayers={fieldPlayers}
      isHomeTeam={isHomeTeam}
      onAddGoal={onAddGoal}
    />,
  );
  return onAddGoal;
}

describe("LiveMatchScoreboard - goal dialog rework", () => {
  it("opens the dialog (does not call onAddGoal immediately) when clicking 'Gol rival'", async () => {
    const onAddGoal = renderScoreboard();
    await userEvent.click(screen.getByRole("button", { name: /gol rival/i }));
    expect(onAddGoal).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("collects dorsal, pitch zone and body part for rival goals", async () => {
    const onAddGoal = renderScoreboard();
    await userEvent.click(screen.getByRole("button", { name: /gol rival/i }));

    const dorsalInput = screen.getByLabelText(/dorsal/i);
    await userEvent.type(dorsalInput, "9");

    const cells = screen.getAllByRole("button", { name: "" });
    await userEvent.click(cells[0]);

    await userEvent.click(screen.getByRole("button", { name: /cabeza/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(onAddGoal).toHaveBeenCalledWith(
      null,
      null,
      9,
      false,
      { col: 0, row: 0 },
      "head",
    );
  });

  it("own-team flow lists fieldPlayers and also collects pitch zone + body part", async () => {
    const onAddGoal = renderScoreboard();
    await userEvent.click(screen.getByRole("button", { name: /^gol$/i }));

    expect(screen.getByText("Jugador Uno")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Jugador Uno"));

    const cells = screen.getAllByRole("button", { name: "" });
    await userEvent.click(cells[3]);
    await userEvent.click(screen.getByRole("button", { name: /pie/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(onAddGoal).toHaveBeenCalledWith(
      "p1",
      "Jugador Uno",
      9,
      true,
      { col: 3, row: 0 },
      "foot",
    );
  });
});
