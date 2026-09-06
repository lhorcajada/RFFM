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

  it("pre-fills from initialValue when provided (edit mode for own player)", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <CardEventDialog
        open
        players={players}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initialValue={{
          teamPlayerId: "p1",
          playerName: "Jugador Uno",
          isRivalPlayer: false,
          rivalDorsal: null,
          cardType: "yellow",
        }}
      />
    );

    // The card type should be pre-selected (amarilla button should be active)
    const amarillaButton = screen.getByRole("button", { name: /amarilla/i });
    expect(amarillaButton).toHaveAttribute("aria-pressed", "true");

    // Submit should work with pre-filled values
    await user.click(screen.getByRole("button", { name: /guardar|confirmar/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      teamPlayerId: "p1",
      playerName: "Jugador Uno",
      isRivalPlayer: false,
      rivalDorsal: null,
      cardType: "yellow",
    });
  });

  it("pre-fills from initialValue when provided (edit mode for rival)", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <CardEventDialog
        open
        players={players}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initialValue={{
          teamPlayerId: null,
          playerName: null,
          isRivalPlayer: true,
          rivalDorsal: 5,
          cardType: "red",
        }}
      />
    );

    // The dorsal should be pre-filled
    const dorsalInput = screen.getByLabelText(/dorsal/i) as HTMLInputElement;
    expect(dorsalInput.value).toBe("5");

    // The card type should be pre-selected (roja button should be active)
    const rojaButton = screen.getByRole("button", { name: /roja/i });
    expect(rojaButton).toHaveAttribute("aria-pressed", "true");

    // Submit should work with pre-filled values
    await user.click(screen.getByRole("button", { name: /guardar|confirmar/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      teamPlayerId: null,
      playerName: null,
      isRivalPlayer: true,
      rivalDorsal: 5,
      cardType: "red",
    });
  });
});
