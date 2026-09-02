import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CardEventDialog from "../CardEventDialog";
import type { SimSlotPlayer } from "../SimulationPlayerSlot";

const players: SimSlotPlayer[] = [
  { teamPlayerId: "p1", displayName: "Jugador Uno", alias: null, photoSrc: null, dorsal: 9, competitiveness: null },
];

describe("CardEventDialog", () => {
  it("selecting an own player + amarilla calls onSubmit with the own-player payload", async () => {
    const onSubmit = vi.fn();
    render(<CardEventDialog open players={players} onClose={vi.fn()} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByText("Jugador Uno"));
    await userEvent.click(screen.getByRole("button", { name: /amarilla/i }));
    await userEvent.click(screen.getByRole("button", { name: /guardar|confirmar/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      teamPlayerId: "p1",
      playerName: "Jugador Uno",
      isRivalPlayer: false,
      rivalDorsal: null,
      cardType: "yellow",
    });
  });

  it("selecting Rival + entering a dorsal + roja calls onSubmit with the rival payload", async () => {
    const onSubmit = vi.fn();
    render(<CardEventDialog open players={players} onClose={vi.fn()} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByText(/rival/i));
    const dorsalInput = screen.getByLabelText(/dorsal/i);
    await userEvent.type(dorsalInput, "4");
    await userEvent.click(screen.getByRole("button", { name: /roja/i }));
    await userEvent.click(screen.getByRole("button", { name: /guardar|confirmar/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      teamPlayerId: null,
      playerName: null,
      isRivalPlayer: true,
      rivalDorsal: 4,
      cardType: "red",
    });
  });
});
