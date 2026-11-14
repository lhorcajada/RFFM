import type { FitPosition, TraitWeight } from "../pages/squad/rating/ratingTraits";
import type { TraitTrend } from "./traitRating";

export type PositionFitCandidate = {
  teamPlayerId: string;
  name: string;
  /** Lugar en el orden devuelto por el servidor (desde 1). */
  place: number;
  /** Encaje de 1 a 5, o null si el jugador no tiene rasgos valorados que cuenten para el puesto. */
  fit: number | null;
  trend: TraitTrend;
};

export type PositionFit = {
  position: FitPosition;
  /** Lunes de la semana del último orden confirmado; null si no hay ninguno. */
  confirmedWeekStart: string | null;
  /** True si el entrenador corrigió el orden propuesto. */
  isManual: boolean;
  candidates: PositionFitCandidate[];
  weights: Record<string, TraitWeight>;
};
