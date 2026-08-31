import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import UpcomingEventsWidget from "../UpcomingEventsWidget";

vi.mock("../../../../services/sportEventService", () => ({
  default: {
    getSportEvents: vi.fn(),
  },
}));

vi.mock("../../../../services/sportEventTypeService", () => ({
  default: {
    getSportEventTypes: vi.fn(),
  },
}));

vi.mock("../../../../hooks/useEventAttendanceSummaries", () => ({
  default: vi.fn(() => ({ summaries: {}, loading: false, error: null, refetch: vi.fn() })),
}));

// EventCard's own rendering is exhaustively tested in
// pages/attendance/__tests__/EventCard.*.test.tsx — here we only assert the
// widget passes it the right props (reused, per requirement 3, to match
// Attendance.tsx's card look) and wires the carousel/link around it.
vi.mock("../../../attendance/EventCard", () => ({
  default: (props: any) => (
    <div data-testid={`event-card-${props.event.id}`}>
      <span data-testid="event-title">{props.event.title}</span>
      <span data-testid="event-type">{props.eventTypeName ?? ""}</span>
      <span data-testid="event-compact">{String(!!props.compact)}</span>
      <span data-testid="event-is-player">{String(!!props.isPlayer)}</span>
      <span data-testid="event-summary">{props.attendanceSummary ? "has-summary" : "no-summary"}</span>
    </div>
  ),
}));

import sportEventService from "../../../../services/sportEventService";
import sportEventTypeService from "../../../../services/sportEventTypeService";
import useEventAttendanceSummaries from "../../../../hooks/useEventAttendanceSummaries";

const mockTeam = { id: "team-1", name: "Equipo 1", club: { id: "club-1" } };

function renderWidget(team = mockTeam, isPlayer = false) {
  return render(
    <MemoryRouter>
      <UpcomingEventsWidget team={team} isPlayer={isPlayer} />
    </MemoryRouter>
  );
}

describe("UpcomingEventsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sportEventTypeService.getSportEventTypes).mockResolvedValue([
      { id: 1, name: "Partidos" },
      { id: 2, name: "Entrenamiento" },
    ]);
  });

  it("renders up to 3 upcoming events (via EventCard) with their titles", async () => {
    const mockEvents = [
      { id: "e1", title: "Evento 1", startTime: "2099-09-01T18:00:00", teamId: "team-1" },
      { id: "e2", title: "Evento 2", startTime: "2099-09-02T18:00:00", teamId: "team-1" },
    ];

    vi.mocked(sportEventService.getSportEvents).mockResolvedValue({
      items: mockEvents,
      totalPages: 1,
    } as any);
    vi.mocked(useEventAttendanceSummaries).mockReturnValue({
      summaries: {},
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWidget();

    expect(await screen.findByTestId("event-card-e1")).toBeInTheDocument();
    // "Evento 2" is in the DOM (carousel slide) even if not the active one.
    expect(screen.getByTestId("event-card-e2")).toBeInTheDocument();
  });

  it("shows an empty state when there are no upcoming events", async () => {
    vi.mocked(sportEventService.getSportEvents).mockResolvedValue({
      items: [],
      totalPages: 1,
    } as any);
    vi.mocked(useEventAttendanceSummaries).mockReturnValue({
      summaries: {},
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWidget();

    expect(await screen.findByText(/No hay próximos eventos/i)).toBeInTheDocument();
  });

  it("shows a loading state while fetching", () => {
    vi.mocked(sportEventService.getSportEvents).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    vi.mocked(useEventAttendanceSummaries).mockReturnValue({
      summaries: {},
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    renderWidget();

    expect(screen.getByText("Próximos eventos")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("passes the resolved event type name, compact=true, isPlayer and the attendance summary to EventCard", async () => {
    vi.mocked(sportEventService.getSportEvents).mockResolvedValue({
      items: [
        { id: "e1", title: "Jornada 3", startTime: "2099-09-01T18:30:00", teamId: "team-1", eventTypeId: 1 },
      ],
      totalPages: 1,
    } as any);
    const summary = {
      eventId: "e1",
      convocados: 1,
      going: 0,
      pending: 1,
      notGoing: 0,
      attendancePercentage: 0,
      myStatus: null,
      myStatusId: null,
    };
    vi.mocked(useEventAttendanceSummaries).mockReturnValue({
      summaries: { e1: summary },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWidget(mockTeam, true);

    const card = await screen.findByTestId("event-card-e1");
    expect(card.querySelector('[data-testid="event-type"]')).toHaveTextContent("Partidos");
    expect(card.querySelector('[data-testid="event-compact"]')).toHaveTextContent("true");
    expect(card.querySelector('[data-testid="event-is-player"]')).toHaveTextContent("true");
    expect(card.querySelector('[data-testid="event-summary"]')).toHaveTextContent("has-summary");
  });

  it("each event links to the attendance detail page", async () => {
    vi.mocked(sportEventService.getSportEvents).mockResolvedValue({
      items: [{ id: "e1", title: "Evento 1", startTime: "2099-09-01T18:00:00", teamId: "team-1" }],
      totalPages: 1,
    } as any);
    vi.mocked(useEventAttendanceSummaries).mockReturnValue({
      summaries: {},
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWidget();

    await screen.findByTestId("event-card-e1");
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("/coach/attendance/e1"));
    expect(link).toHaveAttribute("href", expect.stringContaining("teamId=team-1"));
  });

  it("is navigable as a manual-only carousel: the Siguiente arrow moves to the next event", async () => {
    vi.mocked(sportEventService.getSportEvents).mockResolvedValue({
      items: [
        { id: "e1", title: "Evento 1", startTime: "2099-09-01T18:00:00", teamId: "team-1" },
        { id: "e2", title: "Evento 2", startTime: "2099-09-02T18:00:00", teamId: "team-1" },
      ],
      totalPages: 1,
    } as any);
    vi.mocked(useEventAttendanceSummaries).mockReturnValue({
      summaries: {},
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWidget();

    await screen.findByTestId("event-card-e1");
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    const dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });
});
