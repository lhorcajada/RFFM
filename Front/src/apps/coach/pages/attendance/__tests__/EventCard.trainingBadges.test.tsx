import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import EventCard from "../EventCard";
import type { SportEventResponse } from "../../../services/sportEventService";
import styles from "../EventCard.module.css";

vi.mock("../../../services/sportEventService", () => ({
  deleteSportEvent: vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    hasRole: vi.fn().mockReturnValue(false),
  },
}));

vi.mock("../components/SportEventDialog", () => ({
  default: () => null,
}));

function baseEvent(overrides: Partial<SportEventResponse> = {}): SportEventResponse {
  return {
    id: "event-1",
    title: "Entreno semanal",
    startTime: "2026-09-01T18:00:00",
    teamId: "team-1",
    ...overrides,
  };
}

function renderCard(event: SportEventResponse, eventTypeName?: string | null) {
  return render(
    <MemoryRouter>
      <EventCard event={event} eventTypeName={eventTypeName} />
    </MemoryRouter>
  );
}

describe("EventCard - badges de Entrenamiento", () => {
  it("muestra el chip de hora de llegada cuando el entrenamiento tiene arrivalDate", () => {
    const event = baseEvent({ arrivalDate: "2026-09-01T17:30:00" });
    renderCard(event, "Entrenamiento");

    expect(screen.getByText(/Llegada 17:30/)).toBeInTheDocument();
  });

  it("no muestra el chip de hora de llegada cuando el entrenamiento no tiene arrivalDate", () => {
    const event = baseEvent();
    renderCard(event, "Entrenamiento");

    expect(screen.queryByText(/Llegada/)).not.toBeInTheDocument();
  });

  it("muestra 'Convocatoria abierta' y el borde correspondiente cuando hasConvokedPlayers es true", () => {
    const event = baseEvent({ hasConvokedPlayers: true });
    const { container } = renderCard(event, "Entrenamiento");

    expect(screen.getByText("Convocatoria abierta")).toBeInTheDocument();
    expect(container.querySelector(`.${styles.card}`)).toHaveClass(styles.cardConvocationOpen);
  });

  it("muestra 'Convocatoria sin iniciar' y el borde correspondiente cuando hasConvokedPlayers es false/undefined", () => {
    const event = baseEvent({ hasConvokedPlayers: undefined });
    const { container } = renderCard(event, "Entrenamiento");

    expect(screen.getByText("Convocatoria sin iniciar")).toBeInTheDocument();
    expect(container.querySelector(`.${styles.card}`)).toHaveClass(styles.cardConvocationPending);
  });

  it("muestra el chip de Llegada en tarjetas de Partido, pero no los chips de Convocatoria (solo Entrenamiento)", () => {
    const event = baseEvent({ hasConvokedPlayers: true, arrivalDate: "2026-09-01T17:30:00" });
    renderCard(event, "Partido");

    expect(screen.getByText(/Llegada 17:30/)).toBeInTheDocument();
    expect(screen.queryByText("Convocatoria abierta")).not.toBeInTheDocument();
    expect(screen.queryByText("Convocatoria sin iniciar")).not.toBeInTheDocument();
  });

  it("muestra el chip de Llegada para cualquier tipo de evento (p.ej. Torneo) cuando hay arrivalDate", () => {
    const event = baseEvent({ arrivalDate: "2026-09-01T09:15:00" });
    renderCard(event, "Torneo");

    expect(screen.getByText(/Llegada 9:15/)).toBeInTheDocument();
  });
});
