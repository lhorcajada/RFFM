import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LiveMatchManualEditDialog from "../simulation/LiveMatchManualEditDialog";
import type { SquadPlayer } from "../../squad/components/IdealLineup";

const lineupPlayers: SquadPlayer[] = [
  { id: "p1", teamPlayerId: "p1", displayName: "Player One", alias: null, dorsal: 9 },
];

function renderDialog(overrides: Partial<Parameters<typeof LiveMatchManualEditDialog>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    lineupPlayers,
    currentMinutes: { p1: 60 },
    onSaveMinutes: vi.fn(),
    localTeamName: "Local FC",
    visitorTeamName: "Visitor FC",
    scoreLocal: 1,
    scoreVisitor: 0,
    onSetScore: vi.fn(),
    matchDurationMinutes: null,
    defaultMatchDurationMinutes: 80,
    onSetMatchDuration: vi.fn(),
    goals: [],
    onAddGoal: vi.fn(),
    onUpdateGoal: vi.fn(),
    onRemoveGoal: vi.fn(),
    cards: [],
    onAddCard: vi.fn(),
    onUpdateCard: vi.fn(),
    onRemoveCard: vi.fn(),
    ...overrides,
  };
  render(<LiveMatchManualEditDialog {...props} />);
  return props;
}

const durationInput = () => screen.getByLabelText("Duración del partido (min)");

describe("LiveMatchManualEditDialog - duración del partido", () => {
  it("muestra la duración guardada", () => {
    renderDialog({ matchDurationMinutes: 76 });
    expect(durationInput()).toHaveValue(76);
  });

  it("sin duración guardada propone 2 × los minutos por parte", () => {
    renderDialog();
    expect(durationInput()).toHaveValue(80);
  });

  it("explica que 0 usa la duración de la categoría", () => {
    renderDialog();
    expect(screen.getByText("Si lo dejas en 0 se usa la duración de la categoría")).toBeInTheDocument();
  });

  it("guarda la duración editada", () => {
    const props = renderDialog({ matchDurationMinutes: 76 });

    fireEvent.change(durationInput(), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(props.onSetMatchDuration).toHaveBeenCalledWith(70);
    expect(props.onClose).toHaveBeenCalled();
  });

  it.each(["", "-1", "201"])("rechaza la duración '%s' sin guardar", (value) => {
    const props = renderDialog();

    fireEvent.change(durationInput(), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByText("Revisa la duración del partido (debe ser un número entre 0 y 200).")).toBeInTheDocument();
    expect(props.onSetMatchDuration).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
