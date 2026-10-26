import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import EventCard from "../EventCard";
import type { SportEventResponse } from "../../../services/sportEventService";

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    hasRole: vi.fn().mockReturnValue(true),
  },
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

function renderCard(event: SportEventResponse, eventTypeName: string, path = "/coach/attendance") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EventCard event={event} eventTypeName={eventTypeName} />
    </MemoryRouter>
  );
}

describe("EventCard — tarjeta enlazada al evento", () => {
  it("enlaza a la página del evento con una ruta absoluta", () => {
    renderCard(baseEvent(), "Entrenamiento", "/coach/dashboard");
    expect(screen.getByRole("link", { name: /abrir evento entreno semanal/i })).toHaveAttribute(
      "href",
      "/coach/attendance/event-1"
    );
  });

  it.each([
    ["Entrenamiento"],
    ["Partido"],
  ])("no muestra botones de acción en un evento de tipo %s aunque el usuario pueda editar", (type) => {
    renderCard(baseEvent(), type);
    for (const name of [/editar/i, /eliminar/i, /asistencias/i, /ir al partido/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});
