import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AssignBookSheet from "../AssignBookSheet";
import type { AssignBookValues } from "../AssignBookSheet";

const players = [
  { id: "p7", name: "Pablo", lastName: "García", alias: "Pablito", dorsal: 7 },
  { id: "p11", name: "Leo", lastName: "Ruiz", alias: "Leo", dorsal: 11 },
];

const initial: AssignBookValues = { teamPlayerId: null, bookNumber: 14, firstTicketNumber: 196, lastTicketNumber: 210 };

function renderSheet(overrides: Partial<React.ComponentProps<typeof AssignBookSheet>> = {}) {
  const onSubmit = vi.fn();
  render(
    <AssignBookSheet
      open
      mode="assign"
      title="Asignar taco"
      submitLabel="Asignar taco"
      players={players}
      initial={initial}
      ticketsPerBook={15}
      processing={false}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return onSubmit;
}

describe("AssignBookSheet", () => {
  it("muestra el número, la primera y la última papeleta sugeridos", () => {
    renderSheet();
    expect(screen.getByLabelText("Nº de taco")).toHaveValue("14");
    expect(screen.getByLabelText("Primera papeleta")).toHaveValue("196");
    expect(screen.getByLabelText("Última papeleta")).toHaveValue("210");
  });

  it("no permite asignar hasta elegir un jugador", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: /^asignar taco$/i })).toBeDisabled();
  });

  it("asigna el taco al jugador elegido con los tres números", async () => {
    const user = userEvent.setup();
    const onSubmit = renderSheet();

    await user.click(screen.getByRole("combobox", { name: /jugador/i }));
    await user.click(await screen.findByRole("option", { name: /pablito/i }));
    await user.click(screen.getByRole("button", { name: /^asignar taco$/i }));

    expect(onSubmit).toHaveBeenCalledWith({ teamPlayerId: "p7", bookNumber: 14, firstTicketNumber: 196, lastTicketNumber: 210 });
  });

  it("al cambiar la primera papeleta recalcula la última con el tamaño de la campaña", () => {
    renderSheet({ initial: { ...initial, teamPlayerId: "p7" } });
    fireEvent.change(screen.getByLabelText("Primera papeleta"), { target: { value: "300" } });
    expect(screen.getByLabelText("Última papeleta")).toHaveValue("314");
  });

  it("deja de recalcular la última papeleta cuando se ha editado a mano", () => {
    renderSheet({ initial: { ...initial, teamPlayerId: "p7" } });
    fireEvent.change(screen.getByLabelText("Última papeleta"), { target: { value: "205" } });
    fireEvent.change(screen.getByLabelText("Primera papeleta"), { target: { value: "300" } });
    expect(screen.getByLabelText("Última papeleta")).toHaveValue("205");
  });

  it("no permite una última papeleta menor que la primera", () => {
    renderSheet({ initial: { ...initial, teamPlayerId: "p7" } });
    fireEvent.change(screen.getByLabelText("Última papeleta"), { target: { value: "100" } });
    expect(screen.getByRole("button", { name: /^asignar taco$/i })).toBeDisabled();
  });

  it("en modo edición no pide jugador y guarda solo los números", () => {
    const onSubmit = renderSheet({ mode: "edit", title: "Editar taco 14", submitLabel: "Guardar", initial: { ...initial, teamPlayerId: "p7" } });
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).queryByRole("combobox", { name: /jugador/i })).not.toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith({ teamPlayerId: "p7", bookNumber: 14, firstTicketNumber: 196, lastTicketNumber: 210 });
  });
});
