import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import type { SportEventResponse } from "../../../services/sportEventService";
import type { EventAttendanceSummaryDto } from "../../../services/eventAttendanceSummaryService";

export type StatusTone = "accepted" | "pending" | "declined" | "waiting" | "available";

export type StatusLabel = { text: string; tone: StatusTone };

type EventDates = Pick<SportEventResponse, "startTime" | "eveDateTime" | "start" | "arrivalDate" | "arrival">;

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startValue(event: EventDates): string | null {
  return [event.startTime, event.eveDateTime, event.start].find((v) => parse(v)) ?? null;
}

function esFormat(date: Date, pattern: string): string {
  return format(date, pattern, { locale: es }).replace(/\./g, "");
}

const MATCH_CATEGORY_LABELS: Record<NonNullable<SportEventResponse["matchCategory"]>, string> = {
  League: "Partido de liga",
  Friendly: "Amistoso",
  Tournament: "Torneo",
};

export function eventTitle(event: Pick<SportEventResponse, "title" | "name" | "rivalName">): string {
  if (event.title) return event.title;
  if (event.name) return event.name;
  return event.rivalName ? `vs ${event.rivalName}` : "Evento";
}

export function eventKindLabel(
  event: Pick<SportEventResponse, "matchCategory">,
  eventTypeName: string | null,
): string | null {
  return (event.matchCategory && MATCH_CATEGORY_LABELS[event.matchCategory]) || eventTypeName || null;
}

export function matchSideLabel(event: Pick<SportEventResponse, "rivalName" | "isHomeMatch">): string | null {
  if (!event.rivalName || event.isHomeMatch == null) return null;
  return event.isHomeMatch ? "Local" : "Visitante";
}

export function eventStart(event: EventDates): Date | null {
  return parse(startValue(event));
}

export function dateBadge(date: Date) {
  return {
    weekday: esFormat(date, "EEE").toUpperCase(),
    day: esFormat(date, "dd"),
    month: esFormat(date, "MMM").toUpperCase(),
  };
}

export function relativeDayLabel(date: Date, today: Date): string {
  const days = differenceInCalendarDays(date, today);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days > 1 && days < 7) return esFormat(date, "EEEE");
  return esFormat(date, "d MMM");
}

export function timeLine(event: EventDates): string {
  const value = startValue(event);
  if (!value || !value.includes("T")) return "Hora por confirmar";
  const start = esFormat(new Date(value), "HH:mm");
  const arrival = parse(event.arrivalDate ?? event.arrival);
  return arrival ? `${start} · Llegada ${esFormat(arrival, "HH:mm")}` : start;
}

export function myStatusLabel(summary: EventAttendanceSummaryDto | undefined): StatusLabel | null {
  if (!summary) return null;
  if (summary.myConvocationId && summary.myIsInjured) return { text: "Lesionado", tone: "declined" };
  switch (summary.myStatus) {
    case "Pending":
      return { text: "Estás convocado · sin responder", tone: "pending" };
    case "Accepted":
      return { text: "Vas", tone: "accepted" };
    case "Deconvoke":
    case "Justified":
      return { text: "No vas", tone: "declined" };
  }
  if (!summary.myAvailabilityRequestId) return null;
  switch (summary.myAvailabilityStatus) {
    case "Requested":
      return { text: "¿Estás disponible?", tone: "waiting" };
    case "Available":
      return { text: "Disponible", tone: "available" };
    case "Unavailable":
      return { text: "No disponible", tone: "declined" };
    default:
      return null;
  }
}
