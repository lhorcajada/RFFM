import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MinutesReasonsListDialog from "../MinutesReasonsListDialog";

const players = [
  { id: "p1", label: "Jugador Uno", reason: null },
  { id: "p2", label: "Jugador Dos", reason: "Vuelta de vacaciones" },
];

describe("MinutesReasonsListDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no renderiza nada cuando está cerrado", () => {
    render(
      <MinutesReasonsListDialog open={false} players={players} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lista todos los jugadores con su motivo actual o 'Sin motivo'", () => {
    render(
      <MinutesReasonsListDialog open players={players} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    expect(screen.getByText("Jugador Uno")).toBeInTheDocument();
    expect(screen.getByText("Jugador Dos")).toBeInTheDocument();
    expect(screen.getByText("Sin motivo")).toBeInTheDocument();
    expect(screen.getByText("Vuelta de vacaciones")).toBeInTheDocument();
  });

  it("abre la edición inline de una fila al pulsar su botón de editar", () => {
    render(
      <MinutesReasonsListDialog open players={players} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /editar motivo de jugador dos/i }));

    expect(screen.getByRole("textbox", { name: /motivo de jugador dos/i })).toHaveValue(
      "Vuelta de vacaciones",
    );
  });

  it("guarda el nuevo motivo de la fila editada sin cerrar el diálogo", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <MinutesReasonsListDialog open players={players} onClose={vi.fn()} onSave={onSave} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /editar motivo de jugador uno/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivo de jugador uno/i }), {
      target: { value: "Molestias musculares leves" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("p1", "Molestias musculares leves"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: /motivo de jugador uno/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("borra un motivo existente enviando null, sin cerrar el diálogo", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <MinutesReasonsListDialog open players={players} onClose={vi.fn()} onSave={onSave} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /editar motivo de jugador dos/i }));
    fireEvent.click(screen.getByRole("button", { name: /^borrar motivo$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("p2", null));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("no ofrece borrar motivo para una fila que todavía no tiene ninguno", () => {
    render(
      <MinutesReasonsListDialog open players={players} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /editar motivo de jugador uno/i }));

    expect(screen.queryByRole("button", { name: /^borrar motivo$/i })).not.toBeInTheDocument();
  });

  it("cancela la edición de una fila sin guardar", () => {
    const onSave = vi.fn();
    render(
      <MinutesReasonsListDialog open players={players} onClose={vi.fn()} onSave={onSave} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /editar motivo de jugador dos/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivo de jugador dos/i }), {
      target: { value: "Un texto que no se debe guardar" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Vuelta de vacaciones")).toBeInTheDocument();
  });

  it("muestra un error inline en la fila si falla el guardado, sin cerrar el diálogo", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("network error"));
    render(
      <MinutesReasonsListDialog open players={players} onClose={vi.fn()} onSave={onSave} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /editar motivo de jugador uno/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivo de jugador uno/i }), {
      target: { value: "Molestias" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(await screen.findByText(/error al guardar el motivo/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /motivo de jugador uno/i })).toBeInTheDocument();
  });

  it("cierra el diálogo completo al pulsar el botón Cerrar del pie", async () => {
    const onClose = vi.fn();
    render(<MinutesReasonsListDialog open players={players} onClose={onClose} onSave={vi.fn()} />);

    const closeButtons = screen.getAllByRole("button", { name: /^cerrar$/i });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cierra el diálogo completo al pulsar la X", async () => {
    const onClose = vi.fn();
    render(<MinutesReasonsListDialog open players={players} onClose={onClose} onSave={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: /^cerrar$/i })[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cierra el diálogo completo al pulsar Escape", async () => {
    const onClose = vi.fn();
    render(<MinutesReasonsListDialog open players={players} onClose={onClose} onSave={vi.fn()} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
