import type { CapacityConfigRow, SheetKind, TraitConfigRow } from "../../../types/ratingConfig";
import {
  FIELD_PLAYER_CHARACTERISTICS,
  GOALKEEPER_CHARACTERISTICS,
  type CharacteristicDef,
} from "./ratingConcepts";
import { type TraitDefinition } from "./ratingTraits";

export type EffectiveTrait = TraitDefinition & { isCustom: boolean; isHidden: boolean };

export type EffectiveCapacity = CharacteristicDef & { isCustom: boolean; isHidden: boolean };

/** Capacidades de cada hoja (campo y porteros). */
export type SheetCatalog = Record<SheetKind, CharacteristicDef[]>;

export type EffectiveCapacities = Record<SheetKind, EffectiveCapacity[]>;

export const DEFAULT_SHEET_CATALOG: SheetCatalog = {
  field: FIELD_PLAYER_CHARACTERISTICS,
  goalkeeper: GOALKEEPER_CHARACTERISTICS,
};

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "es");

/** Valores por defecto + personalizaciones del equipo + rasgos propios (al final, por etiqueta). */
export function mergeTraits(defaults: TraitDefinition[], rows: TraitConfigRow[]): EffectiveTrait[] {
  const rowByKey = new Map(rows.map((row) => [row.key, row]));

  const merged: EffectiveTrait[] = defaults.map((trait) => {
    const row = rowByKey.get(trait.key);
    return {
      key: trait.key,
      label: row?.label ?? trait.label,
      phase: row?.phase ?? trait.phase,
      anchors: {
        1: row?.anchor1 ?? trait.anchors[1],
        3: row?.anchor3 ?? trait.anchors[3],
        5: row?.anchor5 ?? trait.anchors[5],
      },
      isCustom: false,
      isHidden: row?.isHidden ?? false,
    };
  });

  const custom: EffectiveTrait[] = rows
    .filter((row) => row.isCustom)
    .map((row) => ({
      key: row.key,
      label: row.label ?? "",
      phase: row.phase ?? "transversal",
      anchors: { 1: row.anchor1 ?? "", 3: row.anchor3 ?? "", 5: row.anchor5 ?? "" },
      isCustom: true,
      isHidden: row.isHidden,
    }))
    .sort(byLabel);

  return [...merged, ...custom];
}

function levelsFrom(texts: string[]): CharacteristicDef["levels"] {
  return texts.map((concept, index) => ({ level: index + 1, concept }));
}

function mergeSheet(defaults: CharacteristicDef[], rows: CapacityConfigRow[], sheet: SheetKind): EffectiveCapacity[] {
  const rowByKey = new Map(rows.filter((row) => !row.isCustom && row.sheet === sheet).map((row) => [row.key, row]));

  const merged: EffectiveCapacity[] = defaults.map((capacity) => {
    const row = rowByKey.get(capacity.key);
    return {
      ...capacity,
      label: row?.label ?? capacity.label,
      levels: row?.levelTexts ? levelsFrom(row.levelTexts) : capacity.levels,
      isCustom: false,
      isHidden: row?.isHidden ?? false,
    };
  });

  const custom: EffectiveCapacity[] = rows
    .filter((row) => row.isCustom && row.sheet === sheet)
    .map((row) => ({
      key: row.key,
      label: row.label ?? "",
      categoryKey: row.categoryKey,
      isGoalkeeper: sheet === "goalkeeper",
      levels: levelsFrom(row.levelTexts ?? []),
      isCustom: true,
      isHidden: row.isHidden,
    }))
    .sort(byLabel);

  return [...merged, ...custom];
}

export function mergeCapacities(defaults: SheetCatalog, rows: CapacityConfigRow[]): EffectiveCapacities {
  return {
    field: mergeSheet(defaults.field, rows, "field"),
    goalkeeper: mergeSheet(defaults.goalkeeper, rows, "goalkeeper"),
  };
}

export function visibleTraits(traits: EffectiveTrait[]): EffectiveTrait[] {
  return traits.filter((trait) => !trait.isHidden);
}

export function visibleCapacities(capacities: EffectiveCapacity[]): EffectiveCapacity[] {
  return capacities.filter((capacity) => !capacity.isHidden);
}
