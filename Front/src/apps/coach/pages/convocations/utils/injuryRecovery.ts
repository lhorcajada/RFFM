import type { GridCell } from "../components/convocationMatchDetail.types";

export const LONG_INJURY_MIN_DAYS = 14;
export const RECOVERY_WINDOW_DAYS = 7;

const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);

function diffDays(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

export function isInjuryAbsence(cell: GridCell | undefined): boolean {
  if (!cell) return false;
  if (!NOT_CALLED_NAMES.has(cell.statusName)) return false;
  if (cell.statusName === "No disponible") return true;
  return cell.excuseTypeId === 1 || !!cell.excuseName?.toLowerCase().includes("lesi");
}

export function isLongInjury(startIso: string | null | undefined, endIso: string | null | undefined): boolean {
  if (!startIso || !endIso) return false;
  return diffDays(startIso.slice(0, 10), endIso.slice(0, 10)) >= LONG_INJURY_MIN_DAYS;
}

/** Days elapsed since the injury discharge, or null when outside the recovery week. */
export function daysIntoRecovery(endIso: string | null | undefined, currentIso: string | null): number | null {
  if (!endIso || !currentIso) return null;
  const days = diffDays(endIso.slice(0, 10), currentIso);
  return days >= 0 && days <= RECOVERY_WINDOW_DAYS ? days : null;
}

/** A player discharged from an injury of two weeks or more stays "En recuperación" for one week. */
export function isInInjuryRecovery(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  currentIso: string | null,
): boolean {
  return isLongInjury(startIso, endIso) && daysIntoRecovery(endIso, currentIso) !== null;
}
