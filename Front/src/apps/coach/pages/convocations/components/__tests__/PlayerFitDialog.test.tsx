import { describe, expect, it, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import PlayerFitDialog from "../PlayerFitDialog";
import type { FitInfo } from "../../utils/deconvocationFunnel";
import type { PositionFit } from "../../../../types/positionFit";

const fit: FitInfo = { share: 0, place: 3, total: 3, positionLabel: "Mediocentro", position: "midfielder", value: 3.4 };

const positionFit: PositionFit = {
  position: "midfielder",
  confirmedWeekStart: null,
  isManual: false,
  weights: { traitBreaksLines: "key", traitArrivesAndFinishes: "key", traitOccupiesZone: "sum", traitBuildsUnderPressure: "indifferent" },
  candidates: [
    { teamPlayerId: "a", name: "Ana", place: 1, fit: 4.5, trend: "same" },
    { teamPlayerId: "b", name: "Bea", place: 2, fit: 4.0, trend: "same" },
    { teamPlayerId: "c", name: "Cris", place: 3, fit: 3.4, trend: "same" },
  ],
};

const levels = [
  { traitKey: "traitBreaksLines", level: 5 },
  { traitKey: "traitArrivesAndFinishes", level: 2 },
  { traitKey: "traitOccupiesZone", level: 3 },
];

function renderDialog(overrides: Partial<React.ComponentProps<typeof PlayerFitDialog>> = {}) {
  const onClose = vi.fn();
  render(
    <PlayerFitDialog
      open
      onClose={onClose}
      playerId="c"
      playerName="Cris"
      fit={fit}
      positionFit={positionFit}
      levels={levels}
      {...overrides}
    />,
  );
  return { onClose };
}

describe("PlayerFitDialog", () => {
  it("indica el puesto, el encaje y el lugar entre los convocados", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: /Encaje de Cris como Mediocentro/i })).toBeInTheDocument();
    expect(screen.getByText("3.º de 3 en Mediocentro (3,4)")).toBeInTheDocument();
  });

  it("explica cómo se calcula el encaje", () => {
    renderDialog();

    expect(screen.getByText(/Los rasgos clave pesan ×3 y los de suma ×1/)).toBeInTheDocument();
  });

  it("lista cada rasgo que cuenta con su peso, su nivel y sus puntos", () => {
    renderDialog();
    const list = screen.getByRole("list", { name: "Rasgos que cuentan en el puesto" });

    const item = within(list).getByText("Rompe líneas").closest("li") as HTMLElement;
    expect(within(item).getByText("Clave ×3")).toBeInTheDocument();
    expect(within(item).getByText("Nivel 5 de 5")).toBeInTheDocument();
    expect(within(item).getByText("15 pts")).toBeInTheDocument();
  });

  it("no lista los rasgos indiferentes para el puesto", () => {
    renderDialog();

    expect(screen.queryByText("Sale jugando bajo presión")).not.toBeInTheDocument();
  });

  it("muestra la cuenta final de la media ponderada", () => {
    renderDialog();

    expect(screen.getByText("(15 + 6 + 3) ÷ 7 = 3,4")).toBeInTheDocument();
  });

  it("destaca los puntos débiles en rasgos clave", () => {
    renderDialog();

    expect(screen.getByText(/Puntos débiles en rasgos clave:/)).toHaveTextContent("Llega al área y finaliza");
  });

  it("marca los rasgos sin valorar", () => {
    renderDialog({ levels: [{ traitKey: "traitBreaksLines", level: 4 }] });
    const list = screen.getByRole("list", { name: "Rasgos que cuentan en el puesto" });

    const item = within(list).getByText("Ocupa su zona y da apoyo").closest("li") as HTMLElement;
    expect(within(item).getByText("Sin valorar")).toBeInTheDocument();
  });

  it("muestra el orden de los jugadores del puesto y resalta al jugador", () => {
    renderDialog();
    const ranking = screen.getByRole("list", { name: "Orden en el puesto" });

    expect(within(ranking).getAllByRole("listitem")).toHaveLength(3);
    expect(within(ranking).getByText("Cris").closest("li")).toHaveAttribute("data-current", "true");
    expect(within(ranking).getByText("Ana").closest("li")).not.toHaveAttribute("data-current");
  });

  it("avisa cuando el entrenador corrigió el orden a mano", () => {
    renderDialog({ positionFit: { ...positionFit, isManual: true } });

    expect(screen.getByText(/El entrenador corrigió el orden a mano/)).toBeInTheDocument();
  });

  it("avisa si el jugador aún no tiene valoraciones de rasgos", () => {
    renderDialog({ levels: [] });

    expect(screen.getByText(/Aún no hay valoraciones de rasgos de este jugador/)).toBeInTheDocument();
  });

  it("se cierra con el botón Cerrar", () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalled();
  });
});
