import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import TraitBoardView from "../TraitBoardView";
import type { TraitDraft } from "../../useTraitRating";

const players = [
  { id: "juan", name: "Juan", lastName: "Pérez", alias: "", position: "Medio Centro", dorsal: 8, activePositionId: 6 },
  { id: "pedro", name: "Pedro", lastName: "Ruiz", alias: "", position: "Defensa Central", dorsal: 4, activePositionId: 4 },
  { id: "luis", name: "Luis", lastName: "Gil", alias: "", position: "Delantero Centro", dorsal: 9, activePositionId: 11 },
];

const draft: TraitDraft = {
  juan: { levels: { traitCoverage: 4, traitOccupiesZone: 2 }, trend: "same" },
  pedro: { levels: { traitCoverage: 4 }, trend: "same" },
  luis: { levels: {}, trend: "same" },
};

function renderBoard(props: Partial<React.ComponentProps<typeof TraitBoardView>> = {}) {
  const onPlace = vi.fn();
  render(<TraitBoardView players={players} draft={draft} readOnly={false} onPlace={onPlace} {...props} />);
  return onPlace;
}

function level(n: number) {
  return screen.getByRole("group", { name: `Nivel ${n}` });
}

async function selectTrait(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(label) }));
}

describe("TraitBoardView", () => {
  it("lista los rasgos agrupados por fase con el progreso de jugadores valorados", () => {
    renderBoard();

    for (const phase of ["Con balón", "Sin balón", "Transiciones", "Transversales"]) {
      expect(screen.getByText(phase)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /Posición y cobertura.*2\/3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ocupa su zona y da apoyo.*1\/3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cumple su rol.*0\/3/ })).toBeInTheDocument();
  });

  it("muestra los cinco niveles y la bandeja «Sin colocar» del rasgo seleccionado", () => {
    renderBoard();

    for (const n of [1, 2, 3, 4, 5]) expect(level(n)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Sin colocar" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Nivel 6" })).not.toBeInTheDocument();
  });

  it("selecciona por defecto el primer rasgo", () => {
    renderBoard();

    expect(screen.getByRole("button", { name: /Ocupa su zona y da apoyo/ })).toHaveAttribute("aria-current", "true");
    expect(within(level(2)).getByRole("button", { name: /Juan Pérez/ })).toBeInTheDocument();
  });

  it("coloca a cada jugador en su nivel y a quien no tiene nivel en «Sin colocar»", async () => {
    const user = userEvent.setup();
    renderBoard();

    await selectTrait(user, "Posición y cobertura");

    expect(within(level(4)).getByRole("button", { name: /Juan Pérez/ })).toBeInTheDocument();
    expect(within(level(4)).getByRole("button", { name: /Pedro Ruiz/ })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Sin colocar" })).getByRole("button", { name: /Luis Gil/ })).toBeInTheDocument();
  });

  it("coloca varios jugadores a la vez en un nivel", async () => {
    const user = userEvent.setup();
    const onPlace = renderBoard();
    await selectTrait(user, "Posición y cobertura");

    await user.click(screen.getByRole("button", { name: /Luis Gil/ }));
    await user.click(screen.getByRole("button", { name: /Pedro Ruiz/ }));
    await user.click(within(level(5)).getAllByRole("button")[0]);

    expect(onPlace).toHaveBeenCalledWith(expect.arrayContaining(["luis", "pedro"]), "traitCoverage", 5);
  });

  it("quita el nivel al colocar en «Sin colocar»", async () => {
    const user = userEvent.setup();
    const onPlace = renderBoard();
    await selectTrait(user, "Posición y cobertura");

    await user.click(screen.getByRole("button", { name: /Juan Pérez/ }));
    await user.click(within(screen.getByRole("group", { name: "Sin colocar" })).getAllByRole("button")[0]);

    expect(onPlace).toHaveBeenCalledWith(["juan"], "traitCoverage", null);
  });

  it("limpia la selección al cambiar de rasgo", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(screen.getByRole("button", { name: /Luis Gil/ }));

    await selectTrait(user, "Posición y cobertura");

    expect(screen.getByRole("button", { name: /Luis Gil/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("no hace nada al elegir un nivel sin jugadores seleccionados", async () => {
    const user = userEvent.setup();
    const onPlace = renderBoard();

    await user.click(within(level(3)).getAllByRole("button")[0]);

    expect(onPlace).not.toHaveBeenCalled();
  });

  it("es de solo lectura: los jugadores no se pueden seleccionar", () => {
    renderBoard({ readOnly: true });

    expect(screen.getByRole("button", { name: /Juan Pérez/ })).toBeDisabled();
  });

  it("muestra un mensaje cuando no hay jugadores", () => {
    renderBoard({ players: [], draft: {} });

    expect(screen.getByText("No hay jugadores de campo en la plantilla.")).toBeInTheDocument();
  });
});
