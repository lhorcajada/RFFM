import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import UpcomingEventRow from "../UpcomingEventRow";
import type { SportEventResponse } from "../../../../services/sportEventService";
import type { EventAttendanceSummaryDto } from "../../../../services/eventAttendanceSummaryService";

const event: SportEventResponse = { id: "e2", title: undefined as unknown as string, name: "Entrenamiento Martes", startTime: "2099-11-03T18:00:00" };

const summary: EventAttendanceSummaryDto = {
  eventId: "e2",
  convocados: 16,
  going: 15,
  pending: 1,
  notGoing: 0,
  attendancePercentage: 83,
  myStatus: "Accepted",
  myStatusId: 2,
  myConvocationId: "conv-2",
};

const href = "/coach/attendance/e2?teamId=team-1";

function renderRow(props: Partial<React.ComponentProps<typeof UpcomingEventRow>> = {}) {
  return render(
    <MemoryRouter>
      <ul>
        <UpcomingEventRow event={event} eventTypeName="Entrenamiento" summary={summary} variant="player" detailHref={href} actions={null} {...props} />
      </ul>
    </MemoryRouter>,
  );
}

describe("UpcomingEventRow", () => {
  it("muestra la fecha y el nombre enlazado al detalle", () => {
    renderRow();
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("NOV");
    expect(row).toHaveTextContent("03");
    expect(screen.getByRole("link", { name: "Entrenamiento Martes" })).toHaveAttribute("href", href);
    expect(row).toHaveTextContent("Entrenamiento · 18:00");
  });

  it("describe el partido de liga con el rival y el campo", () => {
    renderRow({
      event: { id: "e3", title: "", name: "vs A.D.C.R. LEMANS 'D'", rivalName: "A.D.C.R. LEMANS 'D'", isHomeMatch: false, matchCategory: "League", startTime: "2099-10-31T10:30:00" },
      eventTypeName: "Partido",
    });
    expect(screen.getByRole("link", { name: "vs A.D.C.R. LEMANS 'D'" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Partido de liga · Visitante · 10:30");
  });

  it("muestra al jugador su estado", () => {
    renderRow();
    expect(screen.getByText("Vas")).toBeInTheDocument();
  });

  it("muestra al entrenador el porcentaje de asistencia", () => {
    renderRow({ variant: "coach" });
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("83%");
    expect(screen.queryByText("Vas")).not.toBeInTheDocument();
  });

  it("dice «Sin convocar» al entrenador sin convocados", () => {
    renderRow({ variant: "coach", summary: { ...summary, convocados: 0, going: 0, pending: 0 } });
    expect(screen.getByRole("listitem")).toHaveTextContent("Sin convocar");
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("dice «Sin abrir disponibilidad» al entrenador en un partido de liga sin convocados", () => {
    renderRow({
      variant: "coach",
      event: { id: "e3", title: "", name: "vs A.D.C.R. LEMANS 'D'", rivalName: "A.D.C.R. LEMANS 'D'", matchCategory: "League", startTime: "2099-10-31T10:30:00" },
      summary: { ...summary, convocados: 0, going: 0, pending: 0 },
    });
    expect(screen.getByRole("listitem")).toHaveTextContent("Sin abrir disponibilidad");
    expect(screen.queryByText("Sin convocar")).not.toBeInTheDocument();
  });

  it("ofrece al jugador botones de icono «Voy» y «No voy»", async () => {
    const onYes = vi.fn();
    const onNo = vi.fn();
    renderRow({
      summary: { ...summary, myStatus: "Pending" },
      actions: { kind: "convocation", onYes, onNo, busy: false },
    });

    await userEvent.click(screen.getByRole("button", { name: "Voy" }));
    await userEvent.click(screen.getByRole("button", { name: "No voy" }));

    expect(onYes).toHaveBeenCalledTimes(1);
    expect(onNo).toHaveBeenCalledTimes(1);
  });

  it("ofrece «Sí» y «No» para la disponibilidad", () => {
    renderRow({ actions: { kind: "availability", onYes: vi.fn(), onNo: vi.fn(), busy: true } });
    expect(screen.getByRole("button", { name: "Sí" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "No" })).toBeDisabled();
  });
});
