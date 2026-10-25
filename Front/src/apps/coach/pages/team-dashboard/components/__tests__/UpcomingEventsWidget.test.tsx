import { render, screen, within } from "@testing-library/react";
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

import sportEventService from "../../../../services/sportEventService";
import sportEventTypeService from "../../../../services/sportEventTypeService";
import useEventAttendanceSummaries from "../../../../hooks/useEventAttendanceSummaries";

const mockTeam = { id: "team-1", name: "Equipo 1", club: { id: "club-1" } };

const threeEvents = [
  { id: "e1", title: "Evento 1", startTime: "2099-09-01T18:00:00", teamId: "team-1", eventTypeId: 1 },
  { id: "e2", title: "Evento 2", startTime: "2099-09-02T18:00:00", teamId: "team-1" },
  { id: "e3", title: "Evento 3", startTime: "2099-09-03T18:00:00", teamId: "team-1" },
];

function renderWidget(events: unknown[], isPlayer = false) {
  vi.mocked(sportEventService.getSportEvents).mockResolvedValue({ items: events, totalPages: 1 } as never);
  return render(
    <MemoryRouter>
      <UpcomingEventsWidget team={mockTeam as never} isPlayer={isPlayer} />
    </MemoryRouter>
  );
}

describe("UpcomingEventsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sportEventTypeService.getSportEventTypes).mockResolvedValue([
      { id: 1, name: "Partidos" },
      { id: 2, name: "Entrenamiento" },
    ] as never);
    vi.mocked(useEventAttendanceSummaries).mockReturnValue({
      summaries: {},
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("destaca el primer evento y lista los siguientes en «Después»", async () => {
    renderWidget(threeEvents);

    const next = await screen.findByRole("region", { name: "Próximo evento" });
    expect(within(next).getByRole("link", { name: "Evento 1" })).toBeInTheDocument();

    const later = screen.getByRole("list", { name: "Después" });
    expect(within(later).getAllByRole("listitem")).toHaveLength(2);
    expect(within(later).getByRole("link", { name: "Evento 2" })).toBeInTheDocument();
    expect(within(later).getByRole("link", { name: "Evento 3" })).toBeInTheDocument();
  });

  it("pide los tres próximos eventos del equipo", async () => {
    renderWidget(threeEvents);
    await screen.findByRole("region", { name: "Próximo evento" });
    expect(sportEventService.getSportEvents).toHaveBeenCalledWith("team-1", 1, 3, expect.any(String));
  });

  it("no muestra «Después» con un solo evento", async () => {
    renderWidget(threeEvents.slice(0, 1));
    await screen.findByRole("region", { name: "Próximo evento" });
    expect(screen.queryByRole("list", { name: "Después" })).not.toBeInTheDocument();
  });

  it("muestra el nombre del tipo de evento resuelto", async () => {
    renderWidget(threeEvents);
    const next = await screen.findByRole("region", { name: "Próximo evento" });
    expect(await within(next).findByText("Partidos")).toBeInTheDocument();
  });

  it("no es un carrusel: no hay flechas ni puntos", async () => {
    renderWidget(threeEvents);
    await screen.findByRole("region", { name: "Próximo evento" });
    expect(screen.queryByRole("button", { name: /siguiente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ir a la diapositiva/i })).not.toBeInTheDocument();
  });

  it("enlaza cada evento a su detalle con el equipo", async () => {
    renderWidget(threeEvents);
    const link = await screen.findByRole("link", { name: "Evento 2" });
    expect(link).toHaveAttribute("href", "/coach/attendance/e2?teamId=team-1");
  });

  it("enlaza «Ver calendario» a la lista de eventos del equipo", async () => {
    renderWidget(threeEvents);
    expect(await screen.findByRole("link", { name: "Ver calendario" })).toHaveAttribute(
      "href",
      "/coach/attendance?teamId=team-1"
    );
  });

  it("muestra al entrenador las cifras de la convocatoria del próximo evento", async () => {
    vi.mocked(useEventAttendanceSummaries).mockReturnValue({
      summaries: {
        e1: {
          eventId: "e1",
          convocados: 14,
          going: 9,
          pending: 3,
          notGoing: 2,
          attendancePercentage: 64,
          myStatus: null,
          myStatusId: null,
          myConvocationId: null,
        },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderWidget(threeEvents);
    expect(await screen.findByRole("link", { name: "Gestionar convocatoria" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no upcoming events", async () => {
    renderWidget([]);
    expect(await screen.findByText(/No hay próximos eventos/i)).toBeInTheDocument();
  });

  it("shows a loading state while fetching", () => {
    vi.mocked(sportEventService.getSportEvents).mockImplementation(() => new Promise(() => {}));
    render(
      <MemoryRouter>
        <UpcomingEventsWidget team={mockTeam as never} isPlayer={false} />
      </MemoryRouter>
    );

    expect(screen.getByText("Próximos eventos")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
