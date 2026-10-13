import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LiveMatchManualEditDialog from "../simulation/LiveMatchManualEditDialog";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";
import type { SubstitutionWindow } from "../simulation/simulation.types";

const lineupPlayers: SquadPlayer[] = [
  { id: "p0", displayName: "Portero Uno", alias: null, dorsal: 1 },
  { id: "p1", displayName: "Defensa Dos", alias: null, dorsal: 2 },
  { id: "p2", displayName: "Medio Tres", alias: null, dorsal: 3 },
  { id: "p3", displayName: "Suplente Cuatro", alias: null, dorsal: 4 },
];

const secondHalfWindow: SubstitutionWindow = {
  windowIndex: 1,
  minute: 60,
  half: 2,
  swaps: [{ inPlayerId: "p2", outPlayerId: "p1", slotIndex: 1 }],
  slotsAfter: { 0: "p0", 1: "p2" },
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof LiveMatchManualEditDialog>> = {}) {
  const onSaveMinutes = vi.fn();
  const onSetWindows = vi.fn();
  render(
    <LiveMatchManualEditDialog
      open
      onClose={vi.fn()}
      lineupPlayers={lineupPlayers}
      currentMinutes={{ p0: 90, p1: 60, p2: 30, p3: 0 }}
      onSaveMinutes={onSaveMinutes}
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
      cards={[]}
      onAddCard={vi.fn()}
      onUpdateCard={vi.fn()}
      onRemoveCard={vi.fn()}
      windows={[secondHalfWindow]}
      starterIds={["p0", "p1"]}
      onSetWindows={onSetWindows}
      {...overrides}
    />,
  );
  return { onSaveMinutes, onSetWindows };
}

async function chooseOption(user: ReturnType<typeof userEvent.setup>, comboboxName: RegExp, optionName: RegExp) {
  await user.click(screen.getByRole("combobox", { name: comboboxName }));
  await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: optionName }));
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Guardar" }));
}

describe("LiveMatchManualEditDialog - ventanas de cambios", () => {
  it("muestra las ventanas de cambios registradas con su minuto", () => {
    renderDialog();

    expect(screen.getByText("Ventanas de cambios (1)")).toBeInTheDocument();
    expect(screen.getByLabelText("Minuto")).toHaveValue(60);
  });

  it("muestra un mensaje cuando no hay ventanas de cambios", () => {
    renderDialog({ windows: [] });

    expect(screen.getByText("No hay cambios registrados")).toBeInTheDocument();
  });

  it("guarda el minuto corregido de una ventana", async () => {
    const user = userEvent.setup();
    const { onSetWindows } = renderDialog();

    await user.clear(screen.getByLabelText("Minuto"));
    await user.type(screen.getByLabelText("Minuto"), "70");
    await save(user);

    expect(onSetWindows).toHaveBeenCalledWith([expect.objectContaining({ minute: 70, windowIndex: 1 })]);
  });

  it("guarda el jugador que entra corregido", async () => {
    const user = userEvent.setup();
    const { onSetWindows } = renderDialog();

    await chooseOption(user, /entra/i, /Suplente Cuatro/);
    await save(user);

    expect(onSetWindows).toHaveBeenCalledWith([
      expect.objectContaining({
        swaps: [{ inPlayerId: "p3", outPlayerId: "p1", slotIndex: 1 }],
        slotsAfter: { 0: "p0", 1: "p3" },
      }),
    ]);
  });

  it("guarda el jugador que sale corregido", async () => {
    const user = userEvent.setup();
    const { onSetWindows } = renderDialog();

    await chooseOption(user, /sale/i, /Portero Uno/);
    await save(user);

    expect(onSetWindows).toHaveBeenCalledWith([
      expect.objectContaining({ swaps: [{ inPlayerId: "p2", outPlayerId: "p0", slotIndex: 1 }] }),
    ]);
  });

  it("guarda la parte corregida de una ventana", async () => {
    const user = userEvent.setup();
    const { onSetWindows } = renderDialog();

    await chooseOption(user, /parte/i, /Descanso/);
    await save(user);

    expect(onSetWindows).toHaveBeenCalledWith([expect.objectContaining({ isHalftime: true, windowIndex: 0, half: 1 })]);
  });

  it("elimina la ventana cuando se elimina su único cambio", async () => {
    const user = userEvent.setup();
    const { onSetWindows } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Eliminar cambio" }));
    await save(user);

    expect(onSetWindows).toHaveBeenCalledWith([]);
  });

  it("elimina una ventana completa", async () => {
    const user = userEvent.setup();
    const { onSetWindows } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Eliminar ventana" }));

    expect(screen.getByText("Ventanas de cambios (0)")).toBeInTheDocument();
    await save(user);
    expect(onSetWindows).toHaveBeenCalledWith([]);
  });

  it("entrega las ventanas corregidas junto al resto de valores finales del guardado", async () => {
    const user = userEvent.setup();
    const { onSaveMinutes } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Eliminar ventana" }));
    await save(user);

    expect(onSaveMinutes.mock.calls[0][1]).toMatchObject({ windows: [] });
  });

  it("recalcula los minutos de los jugadores afectados al corregir el minuto del cambio", async () => {
    const user = userEvent.setup();
    const { onSaveMinutes } = renderDialog();

    await user.clear(screen.getByLabelText("Minuto"));
    await user.type(screen.getByLabelText("Minuto"), "70");
    await save(user);

    expect(onSaveMinutes.mock.calls[0][0]).toEqual({ p0: 90, p1: 70, p2: 20, p3: 0 });
  });

  it("recalcula los minutos al corregir el jugador que entra", async () => {
    const user = userEvent.setup();
    const { onSaveMinutes } = renderDialog();

    await chooseOption(user, /entra/i, /Suplente Cuatro/);
    await save(user);

    expect(onSaveMinutes.mock.calls[0][0]).toEqual({ p0: 90, p1: 60, p2: 0, p3: 30 });
  });

  it("no toca los minutos de los jugadores que no participan en el cambio corregido", async () => {
    const user = userEvent.setup();
    const { onSaveMinutes } = renderDialog({ currentMinutes: { p0: 85, p1: 60, p2: 30, p3: 0 } });

    await user.click(screen.getByRole("button", { name: "Eliminar ventana" }));
    await save(user);

    expect(onSaveMinutes.mock.calls[0][0]).toEqual({ p0: 85, p1: 90, p2: 0, p3: 0 });
  });

  it("no aplica las correcciones si se cancela", async () => {
    const user = userEvent.setup();
    const { onSetWindows } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Eliminar ventana" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onSetWindows).not.toHaveBeenCalled();
  });

  it("no deja guardar un cambio en el que entra y sale el mismo jugador", async () => {
    const user = userEvent.setup();
    const { onSetWindows } = renderDialog();

    await chooseOption(user, /entra/i, /Defensa Dos/);
    await save(user);

    expect(screen.getByRole("alert")).toHaveTextContent(/no puede entrar y salir/i);
    expect(onSetWindows).not.toHaveBeenCalled();
  });

  it("no deja guardar una ventana con un minuto no válido", async () => {
    const user = userEvent.setup();
    const { onSetWindows } = renderDialog();

    await user.clear(screen.getByLabelText("Minuto"));
    await save(user);

    expect(screen.getByRole("alert")).toHaveTextContent(/minuto de las ventanas de cambios/i);
    expect(onSetWindows).not.toHaveBeenCalled();
  });
});
