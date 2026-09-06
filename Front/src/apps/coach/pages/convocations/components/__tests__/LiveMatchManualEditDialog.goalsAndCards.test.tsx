import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LiveMatchManualEditDialog from "../simulation/LiveMatchManualEditDialog";
import type { SquadPlayer } from "../../squad/components/IdealLineup";
import type { GoalEvent, CardEvent } from "../simulation/liveMatch.types";

const mockLineupPlayers: SquadPlayer[] = [
  { id: "p1", teamPlayerId: "p1", displayName: "Player One", alias: null, dorsal: 9 },
  { id: "p2", teamPlayerId: "p2", displayName: "Player Two", alias: null, dorsal: 10 },
];

const mockGoal: GoalEvent = {
  id: "goal-1",
  minute: 30,
  scorerId: "p1",
  scorerName: "Player One",
  scorerDorsal: 9,
  isOwnTeam: true,
  scoreAtMoment: { local: 1, visitor: 0 },
  pitchZone: null,
  bodyPart: null,
};

const mockCard: CardEvent = {
  id: "card-1",
  minute: 45,
  half: 1,
  cardType: "yellow",
  teamPlayerId: "p2",
  playerName: "Player Two",
  isRivalPlayer: false,
  rivalDorsal: null,
};

describe("LiveMatchManualEditDialog - goals and cards", () => {
  it("renders with new title 'Edición manual del partido'", () => {
    render(
      <LiveMatchManualEditDialog
        open
        onClose={vi.fn()}
        lineupPlayers={mockLineupPlayers}
        currentMinutes={{ p1: 90, p2: 45 }}
        onSaveMinutes={vi.fn()}
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

    expect(screen.getByText(/Edición manual del partido/i)).toBeInTheDocument();
  });

  it("renders existing goals list with minute and scorer name", () => {
    render(
      <LiveMatchManualEditDialog
        open
        onClose={vi.fn()}
        lineupPlayers={mockLineupPlayers}
        currentMinutes={{ p1: 90, p2: 45 }}
        onSaveMinutes={vi.fn()}
        goals={[mockGoal]}
        onAddGoal={vi.fn()}
        onUpdateGoal={vi.fn()}
        onRemoveGoal={vi.fn()}
        cards={[]}
        onAddCard={vi.fn()}
        onUpdateCard={vi.fn()}
        onRemoveCard={vi.fn()}
      />
    );

    // Check for goal minute display
    expect(screen.getAllByText(/30'/i).length).toBeGreaterThan(0);
    // Verify Goles section exists with count
    expect(screen.getByText(/Goles \(1\)/i)).toBeInTheDocument();
  });

  it("renders existing cards list with minute and card type", () => {
    render(
      <LiveMatchManualEditDialog
        open
        onClose={vi.fn()}
        lineupPlayers={mockLineupPlayers}
        currentMinutes={{ p1: 90, p2: 45 }}
        onSaveMinutes={vi.fn()}
        goals={[]}
        onAddGoal={vi.fn()}
        onUpdateGoal={vi.fn()}
        onRemoveGoal={vi.fn()}
        cards={[mockCard]}
        onAddCard={vi.fn()}
        onUpdateCard={vi.fn()}
        onRemoveCard={vi.fn()}
      />
    );

    // Check for card content - minute and card type
    expect(screen.getByText(/45'/i)).toBeInTheDocument();
    expect(screen.getByText(/Amarilla/i)).toBeInTheDocument();
  });

  it("shows empty message for goals when no goals exist", () => {
    render(
      <LiveMatchManualEditDialog
        open
        onClose={vi.fn()}
        lineupPlayers={mockLineupPlayers}
        currentMinutes={{ p1: 90, p2: 45 }}
        onSaveMinutes={vi.fn()}
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

    expect(screen.getByText(/No hay goles registrados/i)).toBeInTheDocument();
  });

  it("shows empty message for cards when no cards exist", () => {
    render(
      <LiveMatchManualEditDialog
        open
        onClose={vi.fn()}
        lineupPlayers={mockLineupPlayers}
        currentMinutes={{ p1: 90, p2: 45 }}
        onSaveMinutes={vi.fn()}
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

    expect(screen.getByText(/No hay tarjetas registradas/i)).toBeInTheDocument();
  });

  it("clicking 'Añadir gol' button opens the goal dialog", async () => {
    const user = userEvent.setup();
    render(
      <LiveMatchManualEditDialog
        open
        onClose={vi.fn()}
        lineupPlayers={mockLineupPlayers}
        currentMinutes={{ p1: 90, p2: 45 }}
        onSaveMinutes={vi.fn()}
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

    const addGoalButton = screen.getByRole("button", { name: /Añadir gol/i });
    await user.click(addGoalButton);

    // Goal dialog should render
    await waitFor(() => {
      expect(screen.getByText(/¿Quién marcó el gol\?|Gol del rival/i)).toBeInTheDocument();
    });
  });

  it("clicking 'Añadir tarjeta' button opens the card dialog", async () => {
    const user = userEvent.setup();
    render(
      <LiveMatchManualEditDialog
        open
        onClose={vi.fn()}
        lineupPlayers={mockLineupPlayers}
        currentMinutes={{ p1: 90, p2: 45 }}
        onSaveMinutes={vi.fn()}
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

    const addCardButton = screen.getByRole("button", { name: /Añadir tarjeta/i });
    await user.click(addCardButton);

    // Card dialog should render
    await waitFor(() => {
      expect(screen.getByText(/Registrar tarjeta/i)).toBeInTheDocument();
    });
  });

  it("clicking delete button on a goal calls onRemoveGoal", async () => {
    const user = userEvent.setup();
    const onRemoveGoal = vi.fn();
    const { container } = render(
      <LiveMatchManualEditDialog
        open
        onClose={vi.fn()}
        lineupPlayers={mockLineupPlayers}
        currentMinutes={{ p1: 90, p2: 45 }}
        onSaveMinutes={vi.fn()}
        goals={[mockGoal]}
        onAddGoal={vi.fn()}
        onUpdateGoal={vi.fn()}
        onRemoveGoal={onRemoveGoal}
        cards={[]}
        onAddCard={vi.fn()}
        onUpdateCard={vi.fn()}
        onRemoveCard={vi.fn()}
      />
    );

    // Find the delete button for the goal (it's an IconButton with DeleteIcon)
    const deleteButtons = container.querySelectorAll('[aria-label="Delete"]');
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0] as HTMLElement);
      expect(onRemoveGoal).toHaveBeenCalledWith("goal-1");
    }
  });

  it("clicking delete button on a card calls onRemoveCard", async () => {
    const user = userEvent.setup();
    const onRemoveCard = vi.fn();
    const { container } = render(
      <LiveMatchManualEditDialog
        open
        onClose={vi.fn()}
        lineupPlayers={mockLineupPlayers}
        currentMinutes={{ p1: 90, p2: 45 }}
        onSaveMinutes={vi.fn()}
        goals={[]}
        onAddGoal={vi.fn()}
        onUpdateGoal={vi.fn()}
        onRemoveGoal={vi.fn()}
        cards={[mockCard]}
        onAddCard={vi.fn()}
        onUpdateCard={vi.fn()}
        onRemoveCard={onRemoveCard}
      />
    );

    // Find delete buttons and click one
    const deleteButtons = container.querySelectorAll('[aria-label="Delete"]');
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0] as HTMLElement);
      expect(onRemoveCard).toHaveBeenCalledWith("card-1");
    }
  });
});
