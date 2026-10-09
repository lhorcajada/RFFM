import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import UpcomingEventsWidget from "../UpcomingEventsWidget";

vi.mock("../../../../services/sportEventService", () => ({
  default: { getSportEvents: vi.fn() },
}));

vi.mock("../../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../../services/convocationService", () => ({
  default: { updateConvocationStatus: vi.fn() },
}));

vi.mock("../../../../services/availabilityService", () => ({
  default: { respondAvailability: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../../../services/excuseTypeService", () => ({
  default: {
    getExcuseTypes: vi.fn().mockResolvedValue([
      { id: 3, name: "Enfermedad", justified: true },
      { id: 7, name: "Decisión técnica", justified: false },
      { id: 8, name: "Sanción deportiva", justified: true },
    ]),
  },
}));

vi.mock("../../../../hooks/useEventAttendanceSummaries", () => ({
  default: vi.fn(),
}));

vi.mock("../../../attendance/EventCard", () => ({
  default: (props: { event: { id: string } }) => <div data-testid={`event-card-${props.event.id}`} />,
}));

import sportEventService from "../../../../services/sportEventService";
import availabilityService from "../../../../services/availabilityService";
import useEventAttendanceSummaries from "../../../../hooks/useEventAttendanceSummaries";

const mockTeam = { id: "team-1", name: "Equipo 1", club: { id: "club-1" } };

function renderWidget(summary: Record<string, unknown>, refetch = vi.fn()) {
  vi.mocked(sportEventService.getSportEvents).mockResolvedValue({
    items: [{ id: "e1", title: "Jornada 5", startTime: "2099-09-01T18:00:00", teamId: "team-1" }],
    totalPages: 1,
  } as never);
  vi.mocked(useEventAttendanceSummaries).mockReturnValue({
    summaries: { e1: summary },
    loading: false,
    error: null,
    refetch,
  } as never);
  render(
    <MemoryRouter>
      <UpcomingEventsWidget team={mockTeam as never} isPlayer />
    </MemoryRouter>
  );
  return refetch;
}

const requestedSummary = {
  eventId: "e1",
  convocados: 0,
  going: 0,
  pending: 0,
  notGoing: 0,
  attendancePercentage: 0,
  myStatus: null,
  myStatusId: null,
  myConvocationId: null,
  myAvailabilityRequestId: "req-1",
  myAvailabilityStatus: "Requested",
};

describe("UpcomingEventsWidget — respuesta de disponibilidad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra «¿Disponible?» con Sí y No cuando hay una petición sin responder", async () => {
    renderWidget(requestedSummary);
    await screen.findByTestId("event-card-e1");

    expect(screen.getByText("¿Disponible?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sí" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("no muestra la pregunta si ya ha respondido que está disponible", async () => {
    renderWidget({ ...requestedSummary, myAvailabilityStatus: "Available" });
    await screen.findByTestId("event-card-e1");

    expect(screen.queryByText("¿Disponible?")).not.toBeInTheDocument();
  });

  it("responde que sí y refresca el resumen", async () => {
    const refetch = renderWidget(requestedSummary);
    await screen.findByTestId("event-card-e1");

    await userEvent.click(screen.getByRole("button", { name: "Sí" }));

    await waitFor(() => expect(availabilityService.respondAvailability).toHaveBeenCalledWith("e1", "req-1", true));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("al responder que no pide un motivo que no es de entrenador", async () => {
    renderWidget(requestedSummary);
    await screen.findByTestId("event-card-e1");

    await userEvent.click(screen.getByRole("button", { name: "No" }));
    await screen.findByText("¿Por qué no está disponible?");
    expect(screen.queryByText("Decisión técnica")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Enfermedad"));
    await userEvent.click(screen.getByRole("button", { name: "No disponible" }));

    await waitFor(() =>
      expect(availabilityService.respondAvailability).toHaveBeenCalledWith("e1", "req-1", false, 3)
    );
  });
});
