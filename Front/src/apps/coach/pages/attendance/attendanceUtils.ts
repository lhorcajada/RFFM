export const eventTypeColorMap: Record<string, string> = {
  Partidos: "#1976d2",
  Entrenamiento: "#2e7d32",
  "Torneo/Competición": "#d32f2f",
  Otro: "#6a1b9a",
};

export function getEventTypeColor(name?: string | null): string {
  if (!name) return "#607d8b";
  return eventTypeColorMap[name] ?? "#607d8b";
}

export interface AttendanceDateRange {
  start: string;
  end: string;
}

function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateOnly(parsed);
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Computes the default "Desde"/"Hasta" date range for the attendance filters:
 * - "Desde" is always today.
 * - "Hasta" is the season's end date, unless that date has already passed
 *   (today > season end date), in which case it falls back to December 31st
 *   of the current year.
 */
export function getDefaultAttendanceDateRange(
  seasonEndDate?: string | null,
  now: Date = new Date()
): AttendanceDateRange {
  const today = toDateOnly(now);
  const start = formatDateOnly(today);

  const seasonEnd = seasonEndDate ? parseDateOnly(seasonEndDate) : null;
  const seasonEndHasNotPassed = seasonEnd !== null && seasonEnd.getTime() >= today.getTime();

  const endOfYearFallback = new Date(today.getFullYear(), 11, 31);
  const end = seasonEndHasNotPassed
    ? formatDateOnly(seasonEnd as Date)
    : formatDateOnly(endOfYearFallback);

  return { start, end };
}
