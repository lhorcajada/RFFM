import type { Rule, RuleResult, RuleContext } from "./types";

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

// Combined metric rule — compone una puntuación normalizada a partir de:
// - 45% `rating` (weightedRating)
// - 45% `necessity` (ahora basada únicamente en `competitiveness`, rango 0..1)
// - hasta 25 pts por `training` (asistencia ponderada a entrenos y amistosos en la temporada)
// Nota: `ctx.necessity` ya no combina titularidades/convocatorias; es la competitividad.
const SEASON_ATTENDANCE_MAX_POINTS = 25;

export default function combinedRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const weightedAttendedSeason = Number.isFinite(ctx.weekStats.weightedAttendedTrainingsSeason)
    ? ctx.weekStats.weightedAttendedTrainingsSeason
    : 0;
  const totalTrainingsSeason = Number.isFinite(ctx.weekStats.totalTrainingsSeason)
    ? Math.max(0, ctx.weekStats.totalTrainingsSeason)
    : 0;
  const seasonAttendanceRate = totalTrainingsSeason > 0
    ? clamp01(weightedAttendedSeason / totalTrainingsSeason)
    : 0;

  // Derive necessity from the player's competitiveness level (0-10).
  // Accept decimal competitiveness (e.g. 5.3). If `ctx.competitiveness` is
  // missing, fall back to `ctx.necessity` (0..1) scaled to 0..10.
  const rawLevel = Number.isFinite(Number(ctx.competitiveness))
    ? Number(ctx.competitiveness)
    : (Number(ctx.necessity ?? 0) * 10);
  const level = Math.max(0, Math.min(10, rawLevel));
  const boostedNecessity = clamp01(level / 10);

  const ratingNorm = clamp01(ctx.weightedRating / 10);
  const COMBINED_MAX = 100;

  // Compute impacts as floats to preserve small differences between players
  // (e.g. 59 vs 62 entrenamientos). Round only the final combined delta so
  // the sum of fractional contributions decides tie-breakers.
  const ratingImpactF = ratingNorm * 0.45 * COMBINED_MAX;
  const necessityImpactF = boostedNecessity * 0.45 * COMBINED_MAX;
  const trainingImpactF = seasonAttendanceRate * SEASON_ATTENDANCE_MAX_POINTS;
  const combinedDelta = Math.round(ratingImpactF + necessityImpactF + trainingImpactF);

  const ratingFactor = {
    key: "rating",
    label: "Nivel ponderado (Comp > Fis > Tac > Tec)",
    value: Number(ctx.weightedRating.toFixed(2)),
    impact: Number(ratingImpactF.toFixed(2)),
  };

  const necessityFactor = {
    key: "necessity",
    label: "Necesidad para el equipo: basada únicamente en competitividad",
    // value reports the competitiveness level with one decimal
    value: Number(level.toFixed(1)),
    impact: Number(necessityImpactF.toFixed(2)),
  };

  const trainingFactor = {
    key: "weeklyTrainingAccum",
    label: "Asistencia a entrenamientos y amistosos (temporada)",
    value: Number((seasonAttendanceRate * 100).toFixed(2)),
    impact: Number(trainingImpactF.toFixed(2)),
  };

  return { factors: [ratingFactor, necessityFactor, trainingFactor], delta: combinedDelta };
}
