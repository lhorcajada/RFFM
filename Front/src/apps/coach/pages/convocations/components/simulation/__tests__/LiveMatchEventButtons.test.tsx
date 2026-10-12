import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LiveMatchEventButtons from "../LiveMatchEventButtons";
import type { LiveMatchPhase } from "../liveMatch.types";
import type { SimSlotPlayer } from "../SimulationPlayerSlot";

const fieldPlayers: SimSlotPlayer[] = [
  { teamPlayerId: "p1", displayName: "Jugador Uno", alias: null, photoSrc: null, dorsal: 9, competitiveness: null },
];

function renderButtons({
  matchPhase = "firstHalf",
  currentMinute = 0,
}: {
  matchPhase?: LiveMatchPhase;
  currentMinute?: number;
} = {}) {
  const onAddGoal = vi.fn();
  const onAddCard = vi.fn();
  render(
    <LiveMatchEventButtons
      matchPhase={matchPhase}
      fieldPlayers={fieldPlayers}
      currentMinute={currentMinute}
      onAddGoal={onAddGoal}
      onAddCard={onAddCard}
    />,
  );
  return { onAddGoal, onAddCard };
}

describe("LiveMatchEventButtons - botones", () => {
  it("muestra los cuatro botones de eventos", () => {
    renderButtons();

    expect(screen.getByRole("button", { name: "Gol a favor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gol en contra" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tarjeta nuestra" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tarjeta rival" })).toBeInTheDocument();
  });

  it.each(["preMatch", "finished"] as const)("los desactiva cuando el partido está en %s", (matchPhase) => {
    renderButtons({ matchPhase });

    for (const name of ["Gol a favor", "Gol en contra", "Tarjeta nuestra", "Tarjeta rival"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("los activa durante el descanso", () => {
    renderButtons({ matchPhase: "halftime" });

    expect(screen.getByRole("button", { name: "Gol a favor" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tarjeta nuestra" })).toBeEnabled();
  });
});

describe("LiveMatchEventButtons - goles", () => {
  it("el botón de gol en contra abre el diálogo sin registrar el gol todavía", async () => {
    const { onAddGoal } = renderButtons();

    await userEvent.click(screen.getByRole("button", { name: "Gol en contra" }));

    expect(onAddGoal).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("el gol en contra se registra como gol del rival con dorsal, zona y parte del cuerpo", async () => {
    const { onAddGoal } = renderButtons();
    await userEvent.click(screen.getByRole("button", { name: "Gol en contra" }));

    await userEvent.type(screen.getByLabelText(/dorsal/i), "9");
    await userEvent.click(screen.getAllByRole("button", { name: "" })[0]);
    await userEvent.click(screen.getByRole("button", { name: /cabeza/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(onAddGoal).toHaveBeenCalledWith(null, null, 9, false, { col: 0, row: 0 }, "head", 0);
  });

  it("el gol a favor se registra como gol propio eligiendo al goleador entre los jugadores del campo", async () => {
    const { onAddGoal } = renderButtons();
    await userEvent.click(screen.getByRole("button", { name: "Gol a favor" }));

    await userEvent.click(screen.getByText("Jugador Uno"));
    await userEvent.click(screen.getAllByRole("button", { name: "" })[3]);
    await userEvent.click(screen.getByRole("button", { name: /pie/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(onAddGoal).toHaveBeenCalledWith("p1", "Jugador Uno", 9, true, { col: 3, row: 0 }, "foot", 0);
  });

  it("rellena el minuto del gol con el minuto actual y permite corregirlo", async () => {
    const { onAddGoal } = renderButtons({ currentMinute: 37 });
    await userEvent.click(screen.getByRole("button", { name: "Gol en contra" }));

    const minuteInput = screen.getByLabelText(/minuto/i) as HTMLInputElement;
    expect(minuteInput.value).toBe("37");
    await userEvent.clear(minuteInput);
    await userEvent.type(minuteInput, "40");
    await userEvent.type(screen.getByLabelText(/dorsal/i), "9");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(onAddGoal).toHaveBeenCalledWith(null, null, 9, false, null, null, 40);
  });
});

describe("LiveMatchEventButtons - tarjetas", () => {
  it("la tarjeta nuestra lista los jugadores propios y no pide dorsal rival", async () => {
    renderButtons();

    await userEvent.click(screen.getByRole("button", { name: "Tarjeta nuestra" }));

    expect(screen.getByText("Jugador Uno")).toBeInTheDocument();
    expect(screen.queryByText("Rival")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/dorsal/i)).not.toBeInTheDocument();
  });

  it("la tarjeta nuestra se registra para el jugador elegido", async () => {
    const { onAddCard } = renderButtons();
    await userEvent.click(screen.getByRole("button", { name: "Tarjeta nuestra" }));

    await userEvent.click(screen.getByText("Jugador Uno"));
    await userEvent.click(screen.getByRole("button", { name: "Roja" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onAddCard).toHaveBeenCalledWith("p1", "Jugador Uno", false, null, "red");
  });

  it("la tarjeta rival pide solo el dorsal, sin la lista de jugadores propios", async () => {
    renderButtons();

    await userEvent.click(screen.getByRole("button", { name: "Tarjeta rival" }));

    expect(screen.getByLabelText(/dorsal/i)).toBeInTheDocument();
    expect(screen.queryByText("Jugador Uno")).not.toBeInTheDocument();
  });

  it("la tarjeta rival se registra con el dorsal del rival", async () => {
    const { onAddCard } = renderButtons();
    await userEvent.click(screen.getByRole("button", { name: "Tarjeta rival" }));

    await userEvent.type(screen.getByLabelText(/dorsal/i), "4");
    await userEvent.click(screen.getByRole("button", { name: "Amarilla" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onAddCard).toHaveBeenCalledWith(null, null, true, 4, "yellow");
  });
});
