/**
 * Métricas de estado de forma del jugador: "Ef" (Estado de forma) = Rodaje − Cansancio,
 * calculado en el frontend a partir de `readiness` y `fatigue` (ya devueltos por
 * `teamPlayerStatisticsService.getTeamPlayerStatistics`). No se calcula en backend.
 *
 * Ver openspec/changes/player-physical-condition-fatigue/design.md — Addendum 3.
 */

export type FormTone = "high" | "mid" | "low";

/**
 * Ef = max(0, min(100, Rodaje - Cansancio)). `null` si `readiness` es `null`
 * (sin Rodaje no hay dato del que partir).
 */
export function computeEf(readiness: number | null | undefined, fatigue: number): number | null {
  if (readiness == null) return null;
  return Math.max(0, Math.min(100, readiness - fatigue));
}

/** Ef y Rodaje: valores altos son buenos (verde >=80, ámbar 50-79, rojo <50). */
export function formTier(value: number): FormTone {
  if (value >= 80) return "high";
  if (value >= 50) return "mid";
  return "low";
}

/** Cansancio: valores altos son malos, criterio invertido (rojo >=70, ámbar 40-69, verde <40). */
export function fatigueTier(value: number): FormTone {
  if (value >= 70) return "low";
  if (value >= 40) return "mid";
  return "high";
}
