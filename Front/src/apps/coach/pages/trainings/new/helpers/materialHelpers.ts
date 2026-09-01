import type { MaterialKind } from "../types";
import { MATERIAL_OPTIONS } from "../constants";

export const getMaterialSizePercent = (kind: MaterialKind) => {
  switch (kind) {
    case "balones":
      return { width: 3.368, height: 2.6 };
    case "setas":
      return { width: 2.2, height: 2.8 };
    case "conos":
      return { width: 2.8, height: 3.2 };
    case "vallas":
      return { width: 6.2, height: 2.8 };
    case "aros":
      return { width: 3.2, height: 3.2 };
    case "miniporterias":
      return { width: 6, height: 3.8 };
    case "picas":
      return { width: 1.8, height: 6.8 };
    case "porterias-f11":
      return { width: 11, height: 6.5 };
    case "escalera":
      return { width: 9, height: 3 };
    default:
      return { width: 3, height: 3 };
  }
};

export const isMaterialKind = (value: string): value is MaterialKind =>
  MATERIAL_OPTIONS.some((material) => material.key === value);

export const getChapaSizePercent = () => {
  // Base visual size for a player token on the pitch (as percent of pitch width)
  return { width: 4.4, height: 4.4 };
};
