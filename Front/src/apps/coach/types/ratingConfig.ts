import type { CategoryKey } from "./playerRating";
import type { TraitPhase } from "../pages/squad/rating/ratingTraits";

export type SheetKind = "field" | "goalkeeper";

/** Personalización de un rasgo por el equipo: un valor por defecto editado/oculto o un rasgo propio. */
export type TraitConfigRow = {
  key: string;
  isCustom: boolean;
  isHidden: boolean;
  label: string | null;
  phase: TraitPhase | null;
  anchor1: string | null;
  anchor3: string | null;
  anchor5: string | null;
};

/** Personalización de una capacidad por el equipo: un valor por defecto editado/oculto o una capacidad propia. */
export type CapacityConfigRow = {
  key: string;
  isCustom: boolean;
  isHidden: boolean;
  sheet: SheetKind;
  categoryKey: CategoryKey;
  label: string | null;
  levelTexts: string[] | null;
};

export type RatingConfig = {
  capacities: CapacityConfigRow[];
  traits: TraitConfigRow[];
};

export const EMPTY_RATING_CONFIG: RatingConfig = { capacities: [], traits: [] };
