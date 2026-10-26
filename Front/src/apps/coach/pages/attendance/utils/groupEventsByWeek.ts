const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface DatedEvent {
  startTime?: string | null;
  start?: string | null;
  eveDateTime?: string | null;
}

export interface EventWeekGroup<T> {
  key: string;
  label: string;
  range: string;
  events: T[];
}

function mondayOf(date: Date): Date {
  const day = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
}

function formatDay(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function eventDate(event: DatedEvent): Date | null {
  const raw = event.startTime ?? event.start ?? event.eveDateTime ?? null;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function weekLabel(monday: Date, currentMonday: Date): string {
  const weeksFromNow = Math.round((monday.getTime() - currentMonday.getTime()) / WEEK_MS);
  if (weeksFromNow === 0) return "Esta semana";
  if (weeksFromNow === 1) return "Próxima semana";
  if (weeksFromNow === -1) return "Semana pasada";
  return `Semana del ${formatDay(monday)}`;
}

export function groupEventsByWeek<T extends DatedEvent>(
  events: T[],
  now: Date = new Date()
): EventWeekGroup<T>[] {
  const currentMonday = mondayOf(now);
  const groups: EventWeekGroup<T>[] = [];

  for (const event of events) {
    const date = eventDate(event);
    const monday = date ? mondayOf(date) : null;
    const key = monday ? monday.toISOString() : "sin-fecha";
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
      continue;
    }
    if (!monday) {
      groups.push({ key, label: "Fecha por confirmar", range: "", events: [event] });
      continue;
    }
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    groups.push({
      key,
      label: weekLabel(monday, currentMonday),
      range: `${formatDay(monday)} – ${formatDay(sunday)}`,
      events: [event],
    });
  }

  return groups;
}
