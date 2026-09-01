import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import EventCard from "../EventCard";
import type { SportEventResponse } from "../../../services/sportEventService";
import type { EventAttendanceSummaryDto } from "../../../services/eventAttendanceSummaryService";

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

function baseSummary(overrides: Partial<EventAttendanceSummaryDto> = {}): EventAttendanceSummaryDto {
  return {
    eventId: "event-1",
    convocados: 10,
    going: 7,
    pending: 2,
    notGoing: 1,
    attendancePercentage: 70,
    myStatus: null,
    myStatusId: null,
    ...overrides,
  };
}

function renderCard(
  event: SportEventResponse,
  eventTypeName?: string | null,
  attendanceSummary?: EventAttendanceSummaryDto,
  isPlayer = false
) {
  return render(
    <MemoryRouter>
      <EventCard
        event={event}
        eventTypeName={eventTypeName}
        attendanceSummary={attendanceSummary}
        isPlayer={isPlayer}
      />
    </MemoryRouter>
  );
}

describe("EventCard - attendance badges", () => {
  it("renders the badge when attendanceSummary is provided", () => {
    const event = baseEvent();
    const summary = baseSummary();

    renderCard(event, "Entrenamiento", summary, false);

    // Coach view should show attendance counts
    expect(screen.getByText(/Convocados.*10/i)).toBeInTheDocument();
  });

  it("renders the card without a badge when attendanceSummary is omitted", () => {
    const event = baseEvent();

    renderCard(event, "Entrenamiento", undefined, false);

    // Should not have the badge
    expect(screen.queryByText(/Convocados/i)).not.toBeInTheDocument();
  });

  it("keeps every chip in the DOM at once for a match with arrival time and a full attendance summary (no chip dropped while reorganizing the layout)", () => {
    const event = baseEvent({
      title: "Partido vs Rival",
      isHomeMatch: true,
      arrivalDate: "2026-09-01T17:00:00",
      localGoals: "2",
      visitorGoals: "1",
    });
    const summary = baseSummary();

    renderCard(event, "Partido", summary, false);

    // "Partido" now appears twice — the lateralized header type tag and the
    // body's chipsRow chip — so assert on count rather than a single match.
    expect(screen.getAllByText("Partido").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Llegada 17:00/)).toBeInTheDocument();
    expect(screen.getByText(/Convocados.*10/i)).toBeInTheDocument();
    expect(screen.getByText(/Van.*7/i)).toBeInTheDocument();
    expect(screen.getByText(/Pendientes.*2/i)).toBeInTheDocument();
    expect(screen.getByText(/No van.*1/i)).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
  });
});
