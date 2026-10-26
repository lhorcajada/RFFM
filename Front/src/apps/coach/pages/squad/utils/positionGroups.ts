import {
  DEFENDER_CATEGORY,
  FORWARD_CATEGORY,
  GOALKEEPER_CATEGORY,
  MIDFIELDER_CATEGORY,
  UNKNOWN_CATEGORY,
} from "../rating/positionCategory";

const CATEGORY_LABELS: Record<number, string> = {
  [GOALKEEPER_CATEGORY]: "Porteros",
  [DEFENDER_CATEGORY]: "Defensas",
  [MIDFIELDER_CATEGORY]: "Centrocampistas",
  [FORWARD_CATEGORY]: "Delanteros",
  [UNKNOWN_CATEGORY]: "Sin posición",
};

export const CATEGORY_ORDER = [
  GOALKEEPER_CATEGORY,
  DEFENDER_CATEGORY,
  MIDFIELDER_CATEGORY,
  FORWARD_CATEGORY,
  UNKNOWN_CATEGORY,
];

export function positionCategoryLabel(category: number): string {
  return CATEGORY_LABELS[category] ?? CATEGORY_LABELS[UNKNOWN_CATEGORY];
}
