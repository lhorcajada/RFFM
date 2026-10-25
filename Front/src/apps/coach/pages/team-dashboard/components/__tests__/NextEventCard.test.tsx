import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import NextEventCard from "../NextEventCard";
import type { SportEventResponse } from "../../../../services/sportEventService";
import type { EventAttendanceSummaryDto } from "../../../../services/eventAttendanceSummaryService";

const today = new Date(2099, 9, 27, 9, 0);

const event: SportEventResponse = {
  id: "e1",
  title: "vs CF Majadahonda B",
  startTime: "2099-10-31T10:30:00",
  arrivalDate: "2099-10-31T09:45:00",
  location: "Campo Municipal Navalcarbón",
  locationMapUrl: "https://maps.example/navalcarbon",
};

const summary: EventAttendanceSummaryDto = {
  eventId: "e1",
  convocados: 14,
  going: 9,
  pending: 3,
  notGoing: 2,
  attendancePercentage: 64,
  myStatus: "Pending",
  myStatusId: 1,
  myConvocationId: "conv-1",
};

const href = "/coach/attendance/e1?teamId=team-1";

function renderCard(props: Partial<React.ComponentProps<typeof NextEventCard>> = {}) {
  return render(
    <MemoryRouter>
      <NextEventCard
        event={event}
        eventTypeName="Partidos"
        summary={summary}
        variant="player"
        detailHref={href}
        actions={null}
        today={today}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("NextEventCard", () => {
  it("muestra el día, el nombre enlazado al detalle, el horario y el tipo", () => {
    renderCard();
    const card = screen.getByRole("region", { name: "Próximo evento" });
    expect(card).toHaveTextContent("Próximo · sábado");
    expect(card).toHaveTextContent("Partido");
    expect(screen.getByRole("link", { name: "vs CF Majadahonda B" })).toHaveAttribute("href", href);
    expect(card).toHaveTextContent("10:30 · Llegada 09:45");
  });

  it("usa el nombre del evento y describe el partido de liga con el campo", () => {
    renderCard({
      event: { ...event, title: undefined as unknown as string, name: "vs A.D.C.R. LEMANS 'D'", rivalName: "A.D.C.R. LEMANS 'D'", isHomeMatch: true, matchCategory: "League" },
      eventTypeName: "Partido",
    });
    expect(screen.getByRole("link", { name: "vs A.D.C.R. LEMANS 'D'" })).toBeInTheDocument();
    expect(screen.getByText("Partido de liga · Local")).toBeInTheDocument();
  });

  it("enlaza el lugar al mapa cuando hay enlace", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Campo Municipal Navalcarbón" })).toHaveAttribute(
      "href",
      "https://maps.example/navalcarbon",
    );
  });

  it("muestra el lugar como texto sin enlace al mapa", () => {
    renderCard({ event: { ...event, locationMapUrl: null } });
    expect(screen.getByText("Campo Municipal Navalcarbón")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Campo Municipal Navalcarbón" })).not.toBeInTheDocument();
  });

  it("muestra el estado del jugador y responde con «Voy» / «No voy»", async () => {
    const onYes = vi.fn();
    const onNo = vi.fn();
    renderCard({ actions: { kind: "convocation", onYes, onNo, busy: false } });

    expect(screen.getByText("Estás convocado · sin responder")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voy" }));
    await userEvent.click(screen.getByRole("button", { name: "No voy" }));

    expect(onYes).toHaveBeenCalledTimes(1);
    expect(onNo).toHaveBeenCalledTimes(1);
  });

  it("usa «Sí» / «No» para responder a la disponibilidad", () => {
    renderCard({
      summary: { ...summary, myStatus: null, myConvocationId: null, myAvailabilityRequestId: "r1", myAvailabilityStatus: "Requested" },
      actions: { kind: "availability", onYes: vi.fn(), onNo: vi.fn(), busy: false },
    });
    expect(screen.getByText("¿Estás disponible?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sí" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("desactiva los botones mientras la respuesta está en curso", () => {
    renderCard({ actions: { kind: "convocation", onYes: vi.fn(), onNo: vi.fn(), busy: true } });
    expect(screen.getByRole("button", { name: "Voy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "No voy" })).toBeDisabled();
  });

  it("enlaza a la convocatoria con el número de convocados para el jugador", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Ver convocatoria · 14 convocados" })).toHaveAttribute("href", href);
  });

  it("muestra al entrenador las cifras, la barra y «Gestionar convocatoria»", () => {
    renderCard({ variant: "coach" });
    expect(screen.getByRole("img", { name: "14 convocados: 9 van, 3 pendientes, 2 no van" })).toBeInTheDocument();
    const counts = screen.getByRole("list", { name: "Resumen de la convocatoria" });
    expect(counts).toHaveTextContent("14Convocados");
    expect(counts).toHaveTextContent("9Van");
    expect(counts).toHaveTextContent("3Pendientes");
    expect(counts).toHaveTextContent("2No van");
    expect(screen.getByRole("link", { name: "Gestionar convocatoria" })).toHaveAttribute("href", href);
    expect(screen.queryByText("Estás convocado · sin responder")).not.toBeInTheDocument();
  });

  it("dice «Aún no hay convocados» al entrenador sin convocados", () => {
    renderCard({ variant: "coach", summary: { ...summary, convocados: 0, going: 0, pending: 0, notGoing: 0 } });
    expect(screen.getByText("Aún no hay convocados")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
