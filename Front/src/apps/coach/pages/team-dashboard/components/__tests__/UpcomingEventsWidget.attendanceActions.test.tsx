import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    getSportEventTypes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../services/convocationService", () => ({
  default: {
    updateConvocationStatus: vi.fn(),
  },
}));

vi.mock("../../../../hooks/useEventAttendanceSummaries", () => ({
  default: vi.fn(),
}));

// The EventCard mock exposes the exact myStatus it was given, so tests can
// assert on the *prop* the widget computed (optimistic/real) rather than
// EventCard's own internal badge rendering (covered by EventCard's own
// tests).
vi.mock("../../../attendance/EventCard", () => ({
  default: (props: any) => (
    <div data-testid={`event-card-${props.event.id}`}>
      <span data-testid="my-status">{props.attendanceSummary?.myStatus ?? "none"}</span>
    </div>
  ),
}));

import sportEventService from "../../../../services/sportEventService";
import convocationService from "../../../../services/convocationService";
import useEventAttendanceSummaries from "../../../../hooks/useEventAttendanceSummaries";

const mockTeam = { id: "team-1", name: "Equipo 1", club: { id: "club-1" } };

const mockEvents = [
  { id: "e1", title: "Evento 1", startTime: "2099-09-01T18:00:00", teamId: "team-1" },
  { id: "e2", title: "Evento 2", startTime: "2099-09-02T18:00:00", teamId: "team-1" },
];

type SummaryOverrides = Record<string, any>;

function renderWidget(isPlayer: boolean, summaries: SummaryOverrides, refetch = vi.fn()) {
  vi.mocked(sportEventService.getSportEvents).mockResolvedValue({
    items: mockEvents,
    totalPages: 1,
  } as any);
  vi.mocked(useEventAttendanceSummaries).mockReturnValue({
    summaries,
    loading: false,
    error: null,
    refetch,
  });
  return render(
    <MemoryRouter>
      <UpcomingEventsWidget team={mockTeam as any} isPlayer={isPlayer} />
    </MemoryRouter>
  );
}

const pendingSummary = (eventId: string) => ({
  eventId,
  convocados: 1,
  going: 0,
  pending: 1,
  notGoing: 0,
  attendancePercentage: 0,
  myStatus: "Pending",
  myStatusId: 1,
  myConvocationId: `conv-${eventId}`,
});

describe("UpcomingEventsWidget attendance actions — gating by convocation status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("not convoked (myStatus null) — no Voy/No voy buttons", async () => {
    renderWidget(true, {
      e1: { ...pendingSummary("e1"), myStatus: null, myStatusId: null, myConvocationId: null },
    });
    await screen.findByTestId("event-card-e1");
    expect(screen.queryByRole("button", { name: /^voy$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /no voy/i })).not.toBeInTheDocument();
  });

  it("convoked and pending — shows Voy/No voy buttons", async () => {
    renderWidget(true, { e1: pendingSummary("e1") });
    await screen.findByTestId("event-card-e1");
    expect(screen.getByRole("button", { name: /^voy$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /no voy/i })).toBeInTheDocument();
  });

  it("convoked and already Accepted — no buttons", async () => {
    renderWidget(true, { e1: { ...pendingSummary("e1"), myStatus: "Accepted", myStatusId: 2 } });
    await screen.findByTestId("event-card-e1");
    expect(screen.queryByRole("button", { name: /^voy$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /no voy/i })).not.toBeInTheDocument();
  });

  it("convoked and already Deconvoked — no buttons", async () => {
    renderWidget(true, { e1: { ...pendingSummary("e1"), myStatus: "Deconvoke", myStatusId: 5 } });
    await screen.findByTestId("event-card-e1");
    expect(screen.queryByRole("button", { name: /^voy$/i })).not.toBeInTheDocument();
  });

  it("convoked and already Justified — no buttons", async () => {
    renderWidget(true, { e1: { ...pendingSummary("e1"), myStatus: "Justified", myStatusId: 4 } });
    await screen.findByTestId("event-card-e1");
    expect(screen.queryByRole("button", { name: /^voy$/i })).not.toBeInTheDocument();
  });

  it("clicking Voy calls convocationService.updateConvocationStatus with statusId 2 (Accepted) and the convocation id, and optimistically updates the summary", async () => {
    let resolveConfirm: () => void = () => {};
    vi.mocked(convocationService.updateConvocationStatus).mockImplementation(
      () => new Promise((resolve) => { resolveConfirm = () => resolve(undefined); })
    );
    renderWidget(true, { e1: pendingSummary("e1") });
    const card = await screen.findByTestId("event-card-e1");

    fireEvent.click(screen.getByRole("button", { name: /^voy$/i }));

    expect(convocationService.updateConvocationStatus).toHaveBeenCalledWith("e1", "conv-e1", 2);

    await waitFor(() => {
      expect(card.querySelector('[data-testid="my-status"]')).toHaveTextContent("Accepted");
    });

    resolveConfirm();
  });

  it("clicking No voy calls convocationService.updateConvocationStatus with statusId 5 (Deconvoke), no excuseTypeId (backend defaults it)", async () => {
    let resolveConfirm: () => void = () => {};
    vi.mocked(convocationService.updateConvocationStatus).mockImplementation(
      () => new Promise((resolve) => { resolveConfirm = () => resolve(undefined); })
    );
    renderWidget(true, { e1: pendingSummary("e1") });
    const card = await screen.findByTestId("event-card-e1");

    fireEvent.click(screen.getByRole("button", { name: /no voy/i }));

    expect(convocationService.updateConvocationStatus).toHaveBeenCalledWith("e1", "conv-e1", 5);

    await waitFor(() => {
      expect(card.querySelector('[data-testid="my-status"]')).toHaveTextContent("Deconvoke");
    });

    resolveConfirm();
  });

  it("shows a per-card loading state while the request is in flight; navigating to the other card leaves it interactive", async () => {
    let resolveConfirm: () => void = () => {};
    vi.mocked(convocationService.updateConvocationStatus).mockImplementation(
      () => new Promise((resolve) => { resolveConfirm = () => resolve(undefined); })
    );
    renderWidget(true, { e1: pendingSummary("e1"), e2: pendingSummary("e2") });
    await screen.findByTestId("event-card-e1");

    const voyButton = screen.getByRole("button", { name: /^voy$/i });
    fireEvent.click(voyButton);

    await waitFor(() => {
      expect(voyButton).toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    await screen.findByTestId("event-card-e2");
    expect(screen.getByRole("button", { name: /^voy$/i })).not.toBeDisabled();

    resolveConfirm();
  });

  it("on request failure, reverts to the pre-click status and dispatches rffm.show_snackbar", async () => {
    vi.mocked(convocationService.updateConvocationStatus).mockRejectedValue(new Error("network error"));
    const listener = vi.fn();
    window.addEventListener("rffm.show_snackbar", listener);

    renderWidget(true, { e1: pendingSummary("e1") });
    const card = await screen.findByTestId("event-card-e1");

    fireEvent.click(screen.getByRole("button", { name: /^voy$/i }));

    await waitFor(() => {
      expect(listener).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(card.querySelector('[data-testid="my-status"]')).toHaveTextContent("Pending");
    });

    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("coach/administrator view never renders the buttons, even when pending", async () => {
    renderWidget(false, { e1: pendingSummary("e1") });
    await screen.findByTestId("event-card-e1");
    expect(screen.queryByRole("button", { name: /voy/i })).not.toBeInTheDocument();
  });
});
