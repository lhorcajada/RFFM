import { describe, expect, it } from "vitest";
import {
  dateBadge,
  eventKindLabel,
  eventStart,
  eventTitle,
  matchSideLabel,
  myStatusLabel,
  relativeDayLabel,
  timeLine,
} from "../eventDisplay";
import type { EventAttendanceSummaryDto } from "../../../../services/eventAttendanceSummaryService";

const baseSummary: EventAttendanceSummaryDto = {
  eventId: "e1",
  convocados: 0,
  going: 0,
  pending: 0,
  notGoing: 0,
  attendancePercentage: 0,
  myStatus: null,
  myStatusId: null,
  myConvocationId: null,
};

describe("eventTitle", () => {
  it("usa el nombre del evento si no tiene título", () => {
    expect(eventTitle({ title: undefined as unknown as string, name: "Entrenamiento Martes" })).toBe("Entrenamiento Martes");
  });

  it("usa «vs rival» si no tiene título ni nombre", () => {
    expect(eventTitle({ title: "", name: null, rivalName: "A.D.C.R. LEMANS 'D'" })).toBe("vs A.D.C.R. LEMANS 'D'");
  });

  it("usa «Evento» como último recurso", () => {
    expect(eventTitle({ title: "", name: null })).toBe("Evento");
  });
});

describe("eventKindLabel", () => {
  it.each([
    ["League", "Partido de liga"],
    ["Friendly", "Amistoso"],
    ["Tournament", "Torneo"],
  ] as const)("partido %s → %s", (matchCategory, label) => {
    expect(eventKindLabel({ matchCategory }, "Partido")).toBe(label);
  });

  it("usa el nombre del tipo de evento si no es un partido", () => {
    expect(eventKindLabel({ matchCategory: null }, "Entrenamiento")).toBe("Entrenamiento");
  });

  it("devuelve null sin categoría ni tipo", () => {
    expect(eventKindLabel({ matchCategory: null }, null)).toBeNull();
  });
});

describe("matchSideLabel", () => {
  it("indica si el partido es en casa o fuera", () => {
    expect(matchSideLabel({ rivalName: "Rival", isHomeMatch: true })).toBe("Local");
    expect(matchSideLabel({ rivalName: "Rival", isHomeMatch: false })).toBe("Visitante");
  });

  it("no dice nada si no es un partido", () => {
    expect(matchSideLabel({ rivalName: null, isHomeMatch: true })).toBeNull();
  });
});

describe("eventStart", () => {
  it("usa startTime antes que eveDateTime y start", () => {
    const date = eventStart({ startTime: "2099-10-31T10:30:00", eveDateTime: "2099-11-01T10:00:00", start: "2099-11-02" });
    expect(date?.getDate()).toBe(31);
  });

  it("devuelve null si no hay ninguna fecha válida", () => {
    expect(eventStart({ startTime: "no es fecha" })).toBeNull();
  });
});

describe("dateBadge", () => {
  it("devuelve día de la semana, día y mes abreviados en mayúsculas", () => {
    expect(dateBadge(new Date(2099, 9, 31, 10, 30))).toEqual({ weekday: "SÁB", day: "31", month: "OCT" });
  });
});

describe("relativeDayLabel", () => {
  const today = new Date(2099, 9, 27, 9, 0);

  it("dice «Hoy» para el mismo día", () => {
    expect(relativeDayLabel(new Date(2099, 9, 27, 20, 0), today)).toBe("Hoy");
  });

  it("dice «Mañana» para el día siguiente", () => {
    expect(relativeDayLabel(new Date(2099, 9, 28, 8, 0), today)).toBe("Mañana");
  });

  it("dice el día de la semana dentro de los próximos seis días", () => {
    expect(relativeDayLabel(new Date(2099, 9, 31, 10, 30), today)).toBe("sábado");
  });

  it("dice la fecha corta a partir de una semana", () => {
    expect(relativeDayLabel(new Date(2099, 10, 10, 10, 30), today)).toBe("10 nov");
  });
});

describe("timeLine", () => {
  it("muestra la hora y la llegada", () => {
    expect(timeLine({ startTime: "2099-10-31T10:30:00", arrivalDate: "2099-10-31T09:45:00" })).toBe("10:30 · Llegada 09:45");
  });

  it("muestra solo la hora sin llegada", () => {
    expect(timeLine({ startTime: "2099-10-31T10:30:00" })).toBe("10:30");
  });

  it("dice «Hora por confirmar» si el evento solo tiene fecha", () => {
    expect(timeLine({ start: "2099-10-31" })).toBe("Hora por confirmar");
  });
});

describe("myStatusLabel", () => {
  it.each([
    ["Pending", "Estás convocado · sin responder", "pending"],
    ["Accepted", "Vas", "accepted"],
    ["Deconvoke", "No vas", "declined"],
    ["Justified", "No vas", "declined"],
  ] as const)("convocatoria %s → %s", (myStatus, text, tone) => {
    expect(myStatusLabel({ ...baseSummary, myStatus, myConvocationId: "c1" })).toEqual({ text, tone });
  });

  it("muestra «Lesionado» si el jugador está lesionado", () => {
    expect(myStatusLabel({ ...baseSummary, myStatus: "Pending", myConvocationId: "c1", myIsInjured: true })).toEqual({
      text: "Lesionado",
      tone: "declined",
    });
  });

  it.each([
    ["Requested", "¿Estás disponible?", "waiting"],
    ["Available", "Disponible", "available"],
    ["Unavailable", "No disponible", "declined"],
  ] as const)("disponibilidad %s → %s", (myAvailabilityStatus, text, tone) => {
    expect(myStatusLabel({ ...baseSummary, myAvailabilityRequestId: "r1", myAvailabilityStatus })).toEqual({ text, tone });
  });

  it("devuelve null sin convocatoria ni disponibilidad", () => {
    expect(myStatusLabel(baseSummary)).toBeNull();
    expect(myStatusLabel(undefined)).toBeNull();
  });
});
