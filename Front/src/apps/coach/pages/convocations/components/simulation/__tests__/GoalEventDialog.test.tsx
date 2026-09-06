import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GoalEventDialog from "../GoalEventDialog";
import type { SimSlotPlayer } from "../SimulationPlayerSlot";

const mockPlayers: SimSlotPlayer[] = [
  { teamPlayerId: "p1", displayName: "Player One", alias: null, dorsal: 9 },
  { teamPlayerId: "p2", displayName: "Player Two", alias: null, dorsal: 10 },
];

describe("GoalEventDialog", () => {
  it("renders player list for own team goals", () => {
    const onSubmit = vi.fn();
    render(
      <GoalEventDialog
        open
        players={mockPlayers}
        isOwnTeam={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText(/Player One/i)).toBeInTheDocument();
    expect(screen.getByText(/Player Two/i)).toBeInTheDocument();
    expect(screen.getByText(/propia puerta/i)).toBeInTheDocument();
  });

  it("submits correct payload when selecting a scorer for own team", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <GoalEventDialog
        open
        players={mockPlayers}
        isOwnTeam={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    // Click on first player to select them
    await user.click(screen.getByText(/Player One/i));

    // Now should see the details form and confirm button
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirmar/i })).toBeInTheDocument();
    });

    // Click confirm
    await user.click(screen.getByRole("button", { name: /Confirmar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        scorerId: "p1",
        scorerName: "Player One",
        scorerDorsal: 9,
        isOwnTeam: true,
      })
    );
  });

  it("submits own-goal payload when selecting 'propia puerta'", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <GoalEventDialog
        open
        players={mockPlayers}
        isOwnTeam={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByText(/propia puerta/i));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        scorerId: null,
        scorerName: "Gol en propia puerta",
        scorerDorsal: null,
        isOwnTeam: false,
      })
    );
  });

  it("renders with isOwnTeam=false (rival scorer) and requires dorsal input", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <GoalEventDialog
        open
        players={mockPlayers}
        isOwnTeam={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    // Should show "Gol del rival" title
    expect(screen.getByText(/Gol del rival/i)).toBeInTheDocument();

    // Should show dorsal input field
    const dorsalInput = screen.getByLabelText(/Dorsal/i);
    expect(dorsalInput).toBeInTheDocument();

    // Fill in dorsal
    await user.clear(dorsalInput);
    await user.type(dorsalInput, "7");

    // Click confirm
    await user.click(screen.getByRole("button", { name: /Confirmar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        scorerId: null,
        scorerName: null,
        scorerDorsal: 7,
        isOwnTeam: false,
      })
    );
  });

  it("pre-fills from initialValue when provided (edit mode)", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <GoalEventDialog
        open
        players={mockPlayers}
        isOwnTeam={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initialValue={{
          scorerId: "p1",
          scorerName: "Player One",
          scorerDorsal: 9,
          isOwnTeam: true,
          pitchZone: { col: 1, row: 2 },
          bodyPart: "head",
        }}
      />
    );

    // Initial value should pre-fill the form
    // The body part should already be selected
    const headButton = screen.getByRole("button", { name: /Cabeza/i });
    expect(headButton).toHaveAttribute("aria-pressed", "true");

    // Click confirm to submit (values should be preserved from initialValue)
    await user.click(screen.getByRole("button", { name: /Confirmar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        scorerId: "p1",
        scorerName: "Player One",
        scorerDorsal: 9,
        bodyPart: "head",
        pitchZone: { col: 1, row: 2 },
      })
    );
  });

  it("closes when close is called", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <GoalEventDialog
        open
        players={mockPlayers}
        isOwnTeam={true}
        onClose={onClose}
        onSubmit={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
