/**
 * Métricas de estado de forma del jugador: "Ef" (Estado de forma) = Rodaje − Cansancio,
 * calculado en el frontend a partir de `readiness` y `fatigue` (ya devueltos por
 * `teamPlayerStatisticsService.getTeamPlayerStatistics`). No se calcula en backend.
 *
 * Ver openspec/changes/player-physical-condition-fatigue/design.md — Addendum 3.
 */

export type FormTone = "high" | "mid" | "low";

/**
 * Ef = Rodaje × (1 − Cansancio / 200). Descuento proporcional (no una resta directa): el
 * Cansancio nunca resta más del 50% del Rodaje (a Cansancio=100, factor=0.5), así que un
 * jugador con buen Rodaje nunca puede caer a 0 solo por estar cansado — el Rodaje pesa más
 * que el Cansancio en el resultado. `null` si `readiness` es `null` (sin Rodaje no hay dato
 * del que partir). Clamp defensivo a [0,100] por si algún valor de entrada llega fuera de rango.
 */
export function computeEf(readiness: number | null | undefined, fatigue: number): number | null {
  if (readiness == null) return null;
  const ef = readiness * (1 - fatigue / 200);
  return Math.max(0, Math.min(100, ef));
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
