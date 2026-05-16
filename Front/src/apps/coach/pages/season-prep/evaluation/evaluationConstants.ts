import type { PoolPlayer } from "../SeasonPrep";
import {
  FIELD_PLAYER_CHARACTERISTICS,
  GOALKEEPER_CHARACTERISTICS,
  getCategoryLabel,
  getCharacteristicDef,
  getConceptForLevel,
  type CategoryKey,
  type CharacteristicDef,
} from "../../squad/rating/ratingConcepts";

export type { CategoryKey, CharacteristicDef };

export function playerIsGk(player: PoolPlayer): boolean {
  if (player.isGoalkeeper) return true;
  const pos = player.position?.toLowerCase() ?? "";
  return pos.includes("portero") || pos.includes("keeper") || pos.includes("arquero");
}

export const FP_GROUPS = [
  { title: "Físico", concepts: FIELD_PLAYER_CHARACTERISTICS.filter((c) => c.categoryKey === "physical") },
  { title: "Técnica", concepts: FIELD_PLAYER_CHARACTERISTICS.filter((c) => c.categoryKey === "technical") },
  { title: "Táctica", concepts: FIELD_PLAYER_CHARACTERISTICS.filter((c) => c.categoryKey === "tactical") },
  { title: "Competitividad", concepts: FIELD_PLAYER_CHARACTERISTICS.filter((c) => c.categoryKey === "competitiveness") },
];

export const GK_GROUPS = [
  { title: "Físico", concepts: GOALKEEPER_CHARACTERISTICS.filter((c) => c.categoryKey === "physical") },
  { title: "Técnica", concepts: GOALKEEPER_CHARACTERISTICS.filter((c) => c.categoryKey === "technical") },
  { title: "Táctica", concepts: GOALKEEPER_CHARACTERISTICS.filter((c) => c.categoryKey === "tactical") },
  { title: "Competitividad", concepts: GOALKEEPER_CHARACTERISTICS.filter((c) => c.categoryKey === "competitiveness") },
];

export const FP_ALL_KEYS = FIELD_PLAYER_CHARACTERISTICS.map((c) => c.key);
export const GK_ALL_KEYS = GOALKEEPER_CHARACTERISTICS.map((c) => c.key);
export const FP_ALL_CONCEPTS = FIELD_PLAYER_CHARACTERISTICS;
export const GK_ALL_CONCEPTS = GOALKEEPER_CHARACTERISTICS;

export { getCategoryLabel, getCharacteristicDef, getConceptForLevel };
