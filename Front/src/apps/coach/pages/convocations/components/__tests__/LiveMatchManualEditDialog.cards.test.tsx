import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LiveMatchManualEditDialog from "../simulation/LiveMatchManualEditDialog";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";
import type { CardEvent } from "../simulation/liveMatch.types";

const lineupPlayers: SquadPlayer[] = [
  { id: "p0", displayName: "Portero Uno", alias: null, dorsal: 1 },
  { id: "p1", displayName: "Defensa Dos", alias: null, dorsal: 2 },
];

const yellowCard: CardEvent = {
  id: "card-1",
  minute: 30,
  half: 1,
  cardType: "yellow",
  teamPlayerId: "p1",
  playerName: "Defensa Dos",
  isRivalPlayer: false,
  rivalDorsal: null,
};

function renderDialog(cards: CardEvent[] = [yellowCard]) {
  const onAddCard = vi.fn();
  const onUpdateCard = vi.fn();
  render(
    <LiveMatchManualEditDialog
      open
      onClose={vi.fn()}
      lineupPlayers={lineupPlayers}
      currentMinutes={{ p0: 90, p1: 90 }}
      onSaveMinutes={vi.fn()}
      localTeamName="Local FC"
      visitorTeamName="Visitor FC"
      scoreLocal={0}
      scoreVisitor={0}
      onSetScore={vi.fn()}
      matchDurationMinutes={90}
      defaultMatchDurationMinutes={90}
      onSetMatchDuration={vi.fn()}
      goals={[]}
      onAddGoal={vi.fn()}
      onUpdateGoal={vi.fn()}
      onRemoveGoal={vi.fn()}
      cards={cards}
      onAddCard={onAddCard}
      onUpdateCard={onUpdateCard}
      onRemoveCard={vi.fn()}
    />,
  );
  return { onAddCard, onUpdateCard };
}

function cardDialog() {
  const dialog = screen.getByText("Registrar tarjeta").closest('[role="dialog"]');
  if (!(dialog instanceof HTMLElement)) throw new Error("El diálogo de tarjeta no está abierto");
  return within(dialog);
}

describe("LiveMatchManualEditDialog - minuto de las tarjetas", () => {
  it("muestra el minuto de la tarjeta al editarla", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Editar tarjeta" }));

    expect(cardDialog().getByLabelText("Minuto")).toHaveValue(30);
  });

  it("guarda el minuto corregido de una tarjeta", async () => {
    const user = userEvent.setup();
    const { onUpdateCard } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Editar tarjeta" }));
    await user.clear(cardDialog().getByLabelText("Minuto"));
    await user.type(cardDialog().getByLabelText("Minuto"), "55");
    await user.click(cardDialog().getByRole("button", { name: "Guardar" }));

    expect(onUpdateCard).toHaveBeenCalledWith(
      "card-1",
      expect.objectContaining({ teamPlayerId: "p1", cardType: "yellow" }),
      55,
      1,
    );
  });

  it("permite indicar el minuto al añadir una tarjeta", async () => {
    const user = userEvent.setup();
    const { onAddCard } = renderDialog([]);

    await user.click(screen.getByRole("button", { name: "Añadir tarjeta" }));
    await user.click(cardDialog().getByText("Portero Uno"));
    await user.click(cardDialog().getByRole("button", { name: "Roja" }));
    await user.clear(cardDialog().getByLabelText("Minuto"));
    await user.type(cardDialog().getByLabelText("Minuto"), "12");
    await user.click(cardDialog().getByRole("button", { name: "Guardar" }));

    expect(onAddCard).toHaveBeenCalledWith(expect.objectContaining({ teamPlayerId: "p0", cardType: "red" }), 12, 1);
  });

  it("no deja guardar una tarjeta sin minuto", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Editar tarjeta" }));
    await user.clear(cardDialog().getByLabelText("Minuto"));

    expect(cardDialog().getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});
