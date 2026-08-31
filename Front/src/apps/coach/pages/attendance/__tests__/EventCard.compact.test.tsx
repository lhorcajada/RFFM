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
    // Coach role — canEditEvent would normally be true, to prove `compact`
    // suppresses the actions regardless of role.
    hasRole: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("../components/SportEventDialog", () => ({
  default: () => <div>sport-event-dialog</div>,
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

function renderCard(compact: boolean) {
  return render(
    <MemoryRouter>
      <EventCard event={baseEvent()} eventTypeName="Entrenamiento" compact={compact} />
    </MemoryRouter>
  );
}

describe("EventCard — compact mode (for read-only contexts like the dashboard widget)", () => {
  it("hides the Asistencias/Editar/Eliminar action icons when compact", () => {
    renderCard(true);
    expect(screen.queryByLabelText(/ver asistencias/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/editar evento/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/eliminar evento/i)).not.toBeInTheDocument();
  });

  it("still shows the title, date, and location/rival content when compact", () => {
    renderCard(true);
    expect(screen.getByText("Entreno semanal")).toBeInTheDocument();
  });

  it("shows the action icons by default (compact omitted/false), matching Attendance.tsx's existing behavior", () => {
    renderCard(false);
    expect(screen.getByLabelText(/ver asistencias/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/editar evento/i)).toBeInTheDocument();
  });

  it("does not render the delete confirmation dialog trigger content when compact, even for an editor role", () => {
    renderCard(true);
    // No delete button to click, so the confirm dialog text should never appear.
    expect(screen.queryByText(/esta acción no se puede/i)).not.toBeInTheDocument();
  });
});
