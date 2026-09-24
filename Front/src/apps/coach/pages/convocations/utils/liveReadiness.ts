import type { DailyLoadBreakdown } from "../../../services/teamPlayerStatisticsService";

/**
 * Proyecta el "Rodaje" (0-100) de un jugador sumando los minutos de un partido/simulación en
 * curso que todavía no están guardados en el backend, con la misma saturación exponencial que
 * `DailyLoadModel` (Back/ExtractionApi/.../Players/Services/DailyLoadModel.cs):
 * `100 − (100 − valor) · e^(−k · carga)`, con `carga = 1.5 · minutos / 70`.
 * La simulación no conoce el tipo de partido, así que cuenta como Liga (peso 1.00).
 */
export type LiveReadinessBreakdown = Pick<
  DailyLoadBreakdown,
  "value" | "gainRate" | "matchLoadPerReferenceMatch" | "referenceMatchMinutes"
>;

export function computeLiveReadiness(
  breakdown: LiveReadinessBreakdown | null | undefined,
  liveMatchMinutes: number,
): number | null {
  if (!breakdown) return null;

  const minutes = Math.max(0, liveMatchMinutes);
  const load =
    breakdown.referenceMatchMinutes > 0
      ? (breakdown.matchLoadPerReferenceMatch * minutes) / breakdown.referenceMatchMinutes
      : 0;
  const projected = 100 - (100 - breakdown.value) * Math.exp(-breakdown.gainRate * load);

  return Math.min(100, Math.round(projected));
}
