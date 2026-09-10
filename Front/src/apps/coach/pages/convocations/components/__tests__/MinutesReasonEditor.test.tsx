import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MinutesReasonEditor from "../MinutesReasonEditor";

const players = [
  { id: "p1", label: "Jugador Uno", reason: null },
  { id: "p2", label: "Jugador Dos", reason: "Vuelta de vacaciones" },
];

describe("MinutesReasonEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra un único botón para todos los jugadores, no uno por jugador", () => {
    render(<MinutesReasonEditor players={players} onSave={vi.fn()} />);

    expect(screen.getAllByRole("button", { name: /motivos de minutos/i })).toHaveLength(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("indica en el botón cuántos jugadores ya tienen un motivo guardado", () => {
    render(<MinutesReasonEditor players={players} onSave={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: /motivos de minutos.*1 con motivo guardado/i }),
    ).toBeInTheDocument();
  });

  it("no indica ningún contador cuando ningún jugador tiene motivo guardado", () => {
    render(
      <MinutesReasonEditor
        players={[{ id: "p1", label: "Jugador Uno", reason: null }]}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^motivos de minutos$/i }),
    ).toBeInTheDocument();
  });

  it("abre un único diálogo con el listado completo de jugadores al pulsar el botón", () => {
    render(<MinutesReasonEditor players={players} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /motivos de minutos/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Jugador Uno")).toBeInTheDocument();
    expect(screen.getByText("Jugador Dos")).toBeInTheDocument();
  });

  it("cierra el diálogo al pulsar Cerrar", async () => {
    render(<MinutesReasonEditor players={players} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /motivos de minutos/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const closeButtons = screen.getAllByRole("button", { name: /^cerrar$/i });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("propaga el guardado de un motivo de un jugador concreto del listado", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<MinutesReasonEditor players={players} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /motivos de minutos/i }));
    fireEvent.click(screen.getByRole("button", { name: /editar motivo de jugador uno/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivo de jugador uno/i }), {
      target: { value: "Molestias" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("p1", "Molestias"));
  });

  it("no requiere ningún motivo para funcionar — nunca bloquea nada por sí mismo", () => {
    const onSave = vi.fn();
    render(<MinutesReasonEditor players={players} onSave={onSave} />);

    expect(onSave).not.toHaveBeenCalled();
  });

  it("respeta la prop disabled deshabilitando el botón", () => {
    render(<MinutesReasonEditor players={players} onSave={vi.fn()} disabled />);

    expect(screen.getByRole("button", { name: /motivos de minutos/i })).toBeDisabled();
  });
});
