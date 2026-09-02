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
    location: "Campo Municipal Norte",
    ...overrides,
  };
}

describe("EventCard - enlace de mapa en la ubicación", () => {
  it("renderiza la ubicación como enlace cuando locationMapUrl está presente", () => {
    const event = baseEvent({
      locationMapUrl: "https://maps.google.com/?q=Campo+Municipal+Norte",
    });
    render(
      <MemoryRouter>
        <EventCard event={event} eventTypeName="Entrenamiento" />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /campo municipal norte/i });
    expect(link).toHaveAttribute("href", "https://maps.google.com/?q=Campo+Municipal+Norte");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renderiza la ubicación como texto plano cuando no hay locationMapUrl", () => {
    const event = baseEvent();
    render(
      <MemoryRouter>
        <EventCard event={event} eventTypeName="Entrenamiento" />
      </MemoryRouter>
    );

    expect(screen.getByText(/campo municipal norte/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /campo municipal norte/i })).not.toBeInTheDocument();
  });
});
