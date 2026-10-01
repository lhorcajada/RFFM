import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlayerObservationCard from "../PlayerObservationCard";
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
  comment: "Busca siempre el pase vertical",
  createdAt: "2026-10-14T18:00:00Z",
  trainingSessionId: null,
  trainingSessionName: null,
  attitudeKey: null,
  attitudeLabel: null,
  habilidades: [],
};

function renderCard(onUpdate = vi.fn().mockResolvedValue(undefined), onDelete = vi.fn()) {
  render(<PlayerObservationCard observation={OBSERVATION} onUpdate={onUpdate} onDelete={onDelete} />);
  return { onUpdate, onDelete };
}

describe("PlayerObservationCard", () => {
  it("al editar precarga la valoración y el comentario", async () => {
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: "Editar observación" }));

    expect(screen.getByRole("button", { name: "No lo hace" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/comentario/i)).toHaveValue("Busca siempre el pase vertical");
  });

  it("cancelar vuelve a la tarjeta sin enviar nada", async () => {
    const { onUpdate } = renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Editar observación" }));
    await userEvent.click(screen.getByRole("button", { name: "A veces" }));

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText("No lo hace")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });

  it("guardar envía la valoración y el comentario y sale de la edición", async () => {
    const { onUpdate } = renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Editar observación" }));
    await userEvent.click(screen.getByRole("button", { name: "A veces" }));
    await userEvent.clear(screen.getByLabelText(/comentario/i));
    await userEvent.type(screen.getByLabelText(/comentario/i), "Mejora tras la charla");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onUpdate).toHaveBeenCalledWith("obs-1", {
      assessment: "Partial",
      comment: "Mejora tras la charla",
      habilidades: [],
    });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument());
  });

  it("si falla el guardado se queda en edición con lo escrito", async () => {
    renderCard(vi.fn().mockRejectedValue(new Error("400")));
    await userEvent.click(screen.getByRole("button", { name: "Editar observación" }));
    await userEvent.click(screen.getByRole("button", { name: "Lo hace" }));

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Lo hace" })).toHaveAttribute("aria-pressed", "true");
  });

  it("eliminar delega la confirmación en quien la contiene", async () => {
    const { onDelete } = renderCard();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar observación" }));

    expect(onDelete).toHaveBeenCalledWith(OBSERVATION);
  });

  it("una observación de actitud muestra «Actitud» y el rasgo", () => {
    render(
      <PlayerObservationCard
        observation={{
          ...OBSERVATION,
          kind: "Attitude",
          subprincipioId: null,
          momentName: null,
          principleLabel: null,
          subprincipioLabel: null,
          attitudeKey: "courage-in-duels",
          attitudeLabel: "Valentía en los duelos",
        }}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Actitud")).toBeInTheDocument();
    expect(screen.getByText("Valentía en los duelos")).toBeInTheDocument();
  });

  it("muestra las habilidades como chips", () => {
    render(
      <PlayerObservationCard
        observation={{ ...OBSERVATION, habilidades: ["Percepción", "Pase"] }}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Percepción")).toBeInTheDocument();
    expect(screen.getByText("Pase")).toBeInTheDocument();
  });

  it("al editar permite cambiar las habilidades", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayerObservationCard observation={{ ...OBSERVATION, habilidades: ["Pase"] }} onUpdate={onUpdate} onDelete={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Editar observación" }));

    await userEvent.click(screen.getByRole("combobox", { name: /habilidades/i }));
    await userEvent.click(await screen.findByRole("option", { name: "Desmarque" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onUpdate).toHaveBeenCalledWith("obs-1", expect.objectContaining({ habilidades: ["Pase", "Desmarque"] }));
  });

  it("al editar una actitud no ofrece habilidades ni las envía", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayerObservationCard
        observation={{
          ...OBSERVATION,
          kind: "Attitude",
          subprincipioId: null,
          subprincipioLabel: null,
          attitudeKey: "patience",
          attitudeLabel: "Paciencia con balón",
        }}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Editar observación" }));

    expect(screen.queryByRole("combobox", { name: /habilidades/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onUpdate).toHaveBeenCalledWith("obs-1", { assessment: "NotAchieved", comment: "Busca siempre el pase vertical" });
  });
});
