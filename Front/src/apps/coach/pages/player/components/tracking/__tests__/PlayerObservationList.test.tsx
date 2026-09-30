import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlayerObservationList from "../PlayerObservationList";
import type { PlayerObservation } from "../../../../../services/playerTrackingService";

const OBSERVATION: PlayerObservation = {
  id: "obs-1",
  date: "2026-10-14",
  kind: "GameModel",
  subprincipioId: "s-23",
  momentName: "Ataque organizado",
  principleLabel: "2. Ataque posicional",
  subprincipioLabel: "2.3 Circular para desordenar",
  assessment: "NotAchieved",
  comment: "Busca siempre el pase vertical sin que el rival esté descolocado",
  createdAt: "2026-10-14T18:00:00Z",
};

describe("PlayerObservationList", () => {
  it("muestra cada observación en una tarjeta con fecha, valoración, fase, principio, subprincipio y comentario", () => {
    render(<PlayerObservationList observations={[OBSERVATION]} loading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText("14/10/2026")).toBeInTheDocument();
    expect(screen.getByText("No lo hace")).toBeInTheDocument();
    expect(screen.getByText("Ataque organizado · 2. Ataque posicional")).toBeInTheDocument();
    expect(screen.getByText("2.3 Circular para desordenar")).toBeInTheDocument();
    expect(screen.getByText(/pase vertical sin que el rival/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío", () => {
    render(<PlayerObservationList observations={[]} loading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText("Aún no hay observaciones para este jugador")).toBeInTheDocument();
  });

  it("muestra un indicador de carga", () => {
    render(<PlayerObservationList observations={[]} loading error={null} onRetry={vi.fn()} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("muestra el error y permite reintentar", async () => {
    const onRetry = vi.fn();
    render(
      <PlayerObservationList
        observations={[]}
        loading={false}
        error="No se pudieron cargar las observaciones"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("No se pudieron cargar las observaciones")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
