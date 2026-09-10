import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConvocationMatchActionBar from "../ConvocationMatchActionBar";

const baseProps = {
  teamId: "team-1",
  tab: 1,
  eventId: "event-1",
  lineupPlayersCount: 1,
  printing: false,
  convocationConfirmed: false,
  onBack: vi.fn(),
  onOpenEvent: vi.fn(),
  onSaveConvocation: vi.fn(),
  onSaveLineup: vi.fn(),
  onPrint: vi.fn(),
  onViewConvocation: vi.fn(),
};

const players = [
  { id: "p1", label: "Jugador Uno", reason: null },
  { id: "p2", label: "Jugador Dos", reason: "Vuelta de vacaciones" },
];

describe("ConvocationMatchActionBar — botón único de motivos de minutos", () => {
  it("no muestra el botón cuando no se proporcionan jugadores con motivos", () => {
    render(<ConvocationMatchActionBar {...baseProps} />);

    expect(screen.queryByRole("button", { name: /motivos de minutos/i })).not.toBeInTheDocument();
  });

  it("no muestra el botón fuera de la pestaña de Alineación aunque haya jugadores", () => {
    render(
      <ConvocationMatchActionBar
        {...baseProps}
        tab={2}
        minutesReasonsPlayers={players}
        onSaveMinutesReason={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /motivos de minutos/i })).not.toBeInTheDocument();
  });

  it("muestra un único botón de motivos de minutos junto al resto de botones de acción en la pestaña de Alineación", () => {
    render(
      <ConvocationMatchActionBar
        {...baseProps}
        tab={1}
        minutesReasonsPlayers={players}
        onSaveMinutesReason={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /motivos de minutos.*1 con motivo guardado/i }),
    ).toBeInTheDocument();
  });

  it("abre el diálogo de listado y guarda el motivo de un jugador concreto", async () => {
    const onSaveMinutesReason = vi.fn().mockResolvedValue(undefined);
    render(
      <ConvocationMatchActionBar
        {...baseProps}
        tab={1}
        minutesReasonsPlayers={players}
        onSaveMinutesReason={onSaveMinutesReason}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /motivos de minutos/i }));
    fireEvent.click(screen.getByRole("button", { name: /editar motivo de jugador uno/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivo de jugador uno/i }), {
      target: { value: "Molestias" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(onSaveMinutesReason).toHaveBeenCalledWith("p1", "Molestias"));
  });
});
