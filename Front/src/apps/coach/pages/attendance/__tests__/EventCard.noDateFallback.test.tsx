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
    title: "Entreno sin fecha",
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

describe("EventCard - evento sin fecha", () => {
  it("muestra 'Por confirmar' cuando eveDateTime y startTime son null", () => {
    const event = baseEvent({ eveDateTime: null, startTime: null, start: undefined });
    renderCard(event, "Entrenamiento");

    expect(screen.getByText("Por confirmar")).toBeInTheDocument();
  });

  it("no muestra ninguna hora de inicio cuando el evento no tiene fecha", () => {
    const event = baseEvent({ eveDateTime: null, startTime: null, start: undefined });
    renderCard(event, "Partido");

    expect(screen.queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument();
  });
});
