import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EventCard from "../EventCard";
import type { SportEventResponse } from "../../../services/sportEventService";
import styles from "../EventCard.module.css";

function baseEvent(overrides: Partial<SportEventResponse> = {}): SportEventResponse {
  return {
    id: "event-1",
    title: "Entreno semanal",
    startTime: "2026-09-01T18:00:00",
    teamId: "team-1",
    ...overrides,
  };
}

function renderCard(compact: boolean, eventTypeName: string | null = "Entrenamiento", event = baseEvent()) {
  return render(
    <MemoryRouter>
      <EventCard event={event} eventTypeName={eventTypeName} compact={compact} />
    </MemoryRouter>
  );
}

describe("EventCard — etiqueta y franja de color del tipo de evento", () => {
  it("muestra el tipo de evento en la fila superior de la tarjeta", () => {
    renderCard(false);
    expect(screen.getByText("Entrenamiento")).toBeInTheDocument();
  });

  it("muestra la misma etiqueta en la tarjeta compacta", () => {
    renderCard(true);
    expect(screen.getByText("Entrenamiento")).toBeInTheDocument();
  });

  it("no muestra etiqueta de tipo cuando el evento no tiene tipo", () => {
    const { container } = renderCard(false, null);
    expect(container.querySelector(`.${styles.typeLabel}`)).toBeNull();
  });

  it("muestra la etiqueta Local en un partido en casa", () => {
    renderCard(false, "Partido", baseEvent({ isHomeMatch: true }));
    expect(screen.getByText("Local")).toBeInTheDocument();
  });

  it("da a entrenamientos, partidos y otros tipos franjas de color distintas", () => {
    const stripeClassOf = (container: HTMLElement) =>
      (container.querySelector(`.${styles.stripe}`) as HTMLElement).className;

    const training = stripeClassOf(renderCard(false, "Entrenamiento").container);
    const match = stripeClassOf(renderCard(false, "Partido").container);
    const tournament = stripeClassOf(renderCard(false, "Torneo").container);
    const friendly = stripeClassOf(renderCard(false, "Amistoso").container);

    expect(training).toContain(styles.stripeTraining);
    expect(match).toContain(styles.stripeMatch);
    expect(tournament).toContain(styles.stripeTournament);
    expect(friendly).toContain(styles.stripeDefault);
  });
});
