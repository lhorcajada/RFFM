import type { SportEventResponse } from "../../../services/sportEventService";

export function toIsoDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfWeekIso(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - offset);
  return toIsoDay(date.toISOString());
}

export function endOfWeekIso(isoDate: string): string {
  const start = new Date(`${startOfWeekIso(isoDate)}T00:00:00`);
  start.setDate(start.getDate() + 6);
  return toIsoDay(start.toISOString());
}

export async function getAllSportEventsInRange(
  teamId: string,
  startDate: string,
  endDate: string,
): Promise<SportEventResponse[]> {
  const pageSize = 200;
  let page = 1;
  const all: SportEventResponse[] = [];

  while (true) {
    const resp = await import("../../../services/sportEventService").then((mod) =>
      mod.default.getSportEvents(teamId, page, pageSize, startDate, endDate, false),
    );
    all.push(...(resp.items ?? []));

    const reachedLastPageByCount = (resp.items?.length ?? 0) < pageSize;
    const reachedLastPageByMeta = resp.totalPages > 0 && page >= resp.totalPages;
    if (reachedLastPageByCount || reachedLastPageByMeta) break;

    page += 1;
    if (page > 50) break;
  }

  const byId = new Map<string, SportEventResponse>();
  all.forEach((ev) => byId.set(ev.id, ev));
  return Array.from(byId.values());
}