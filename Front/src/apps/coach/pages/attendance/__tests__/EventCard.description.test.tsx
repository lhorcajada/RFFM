import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import EventCard from "../EventCard";
import type { SportEventResponse } from "../../../services/sportEventService";

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

describe("EventCard - descripción del evento", () => {
  it("muestra la descripción del evento cuando existe", () => {
    const event = baseEvent({ description: "Trabajo de posesión y presión alta" });
    render(
      <MemoryRouter>
        <EventCard event={event} eventTypeName="Entrenamiento" />
      </MemoryRouter>
    );

    expect(screen.getByText("Trabajo de posesión y presión alta")).toBeInTheDocument();
  });

  it("no muestra nada de descripción cuando el evento no tiene descripción", () => {
    const event = baseEvent();
    const { container } = render(
      <MemoryRouter>
        <EventCard event={event} eventTypeName="Entrenamiento" />
      </MemoryRouter>
    );

    expect(container.textContent).not.toMatch(/undefined|null/);
  });
});
