const MS_PER_DAY = 24 * 60 * 60 * 1000;

const UNIT_DAYS: Record<string, number> = {
  dia: 1,
  dias: 1,
  día: 1,
  días: 1,
  semana: 7,
  semanas: 7,
  mes: 30,
  meses: 30,
};

const RECOVERY_PATTERN =
  /^\s*(\d+)(?:\s*(?:-|–|a)\s*(\d+))?\s*(días?|dias?|semanas?|mes(?:es)?)\s*$/i;

export function parseRecoveryDays(text?: string | null): number | null {
  if (!text) return null;
  const match = RECOVERY_PATTERN.exec(text);
  if (!match) return null;
  const amount = Number(match[2] ?? match[1]);
  const unitDays = UNIT_DAYS[match[3].toLowerCase()];
  const days = amount * unitDays;
  return days > 0 ? days : null;
}

export function recoveryProgress(
  startDate: string,
  estimatedRecovery: string | null | undefined,
  now: Date
): number | null {
  const totalDays = parseRecoveryDays(estimatedRecovery);
  if (totalDays === null) return null;
  const start = new Date(startDate).getTime();
  if (Number.isNaN(start)) return null;
  const elapsedDays = (now.getTime() - start) / MS_PER_DAY;
  const percent = Math.round((elapsedDays / totalDays) * 100);
  return Math.min(99, Math.max(0, percent));
}
