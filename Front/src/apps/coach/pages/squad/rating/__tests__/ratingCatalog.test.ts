import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHEET_CATALOG,
  mergeCapacities,
  mergeTraits,
  visibleCapacities,
  visibleTraits,
} from "../ratingCatalog";
import { FIELD_PLAYER_CHARACTERISTICS, GOALKEEPER_CHARACTERISTICS } from "../ratingConcepts";
import { TRAIT_CATALOG } from "../ratingTraits";
import type { CapacityConfigRow, TraitConfigRow } from "../../../../types/ratingConfig";

function traitRow(partial: Partial<TraitConfigRow> & { key: string }): TraitConfigRow {
  return { isCustom: false, isHidden: false, label: null, phase: null, anchor1: null, anchor3: null, anchor5: null, ...partial };
}

function capacityRow(partial: Partial<CapacityConfigRow> & { key: string }): CapacityConfigRow {
  return { isCustom: false, isHidden: false, sheet: "field", categoryKey: "technical", label: null, levelTexts: null, ...partial };
}

const texts = Array.from({ length: 10 }, (_, i) => `Texto ${i + 1}`);

describe("mergeTraits", () => {
  it("sin personalizaciones devuelve los 12 rasgos por defecto visibles", () => {
    const traits = mergeTraits(TRAIT_CATALOG, []);

    expect(traits).toHaveLength(12);
    expect(traits.map((t) => t.key)).toEqual(TRAIT_CATALOG.map((t) => t.key));
    expect(traits.every((t) => !t.isHidden && !t.isCustom)).toBe(true);
    expect(traits[0].label).toBe(TRAIT_CATALOG[0].label);
  });

  it("aplica solo los textos personalizados de un rasgo por defecto", () => {
    const traits = mergeTraits(TRAIT_CATALOG, [traitRow({ key: "traitPressing", label: "Presiona alto", anchor3: "Intermedio" })]);

    const pressing = traits.find((t) => t.key === "traitPressing")!;
    const original = TRAIT_CATALOG.find((t) => t.key === "traitPressing")!;
    expect(pressing.label).toBe("Presiona alto");
    expect(pressing.anchors[3]).toBe("Intermedio");
    expect(pressing.anchors[1]).toBe(original.anchors[1]);
    expect(pressing.phase).toBe(original.phase);
  });

  it("puede cambiar la fase de un rasgo por defecto", () => {
    const traits = mergeTraits(TRAIT_CATALOG, [traitRow({ key: "traitPressing", phase: "transitions" })]);

    expect(traits.find((t) => t.key === "traitPressing")!.phase).toBe("transitions");
  });

  it("marca como oculto un rasgo por defecto oculto", () => {
    const traits = mergeTraits(TRAIT_CATALOG, [traitRow({ key: "traitDuels", isHidden: true })]);

    expect(traits.find((t) => t.key === "traitDuels")!.isHidden).toBe(true);
    expect(visibleTraits(traits)).toHaveLength(11);
  });

  it("añade al final los rasgos propios con sus textos", () => {
    const traits = mergeTraits(TRAIT_CATALOG, [
      traitRow({ key: "custom-b", isCustom: true, label: "Zurda", phase: "withBall", anchor1: "a", anchor3: "b", anchor5: "c" }),
      traitRow({ key: "custom-a", isCustom: true, label: "Juego aéreo", phase: "withoutBall", anchor1: "x", anchor3: "y", anchor5: "z" }),
    ]);

    expect(traits).toHaveLength(14);
    expect(traits.slice(12).map((t) => t.label)).toEqual(["Juego aéreo", "Zurda"]);
    const custom = traits[12];
    expect(custom).toMatchObject({ key: "custom-a", isCustom: true, phase: "withoutBall", anchors: { 1: "x", 3: "y", 5: "z" } });
  });

  it("un rasgo propio oculto no es visible", () => {
    const traits = mergeTraits(TRAIT_CATALOG, [
      traitRow({ key: "custom-a", isCustom: true, isHidden: true, label: "Juego aéreo", phase: "withBall", anchor1: "x", anchor3: "y", anchor5: "z" }),
    ]);

    expect(visibleTraits(traits)).toHaveLength(12);
  });

  it("ignora una personalización de una clave que no es un valor por defecto ni propia", () => {
    const traits = mergeTraits(TRAIT_CATALOG, [traitRow({ key: "traitMadeUp", label: "Fantasma" })]);

    expect(traits).toHaveLength(12);
  });
});

describe("mergeCapacities", () => {
  it("sin personalizaciones devuelve las capacidades por defecto de cada hoja", () => {
    const merged = mergeCapacities(DEFAULT_SHEET_CATALOG, []);

    expect(merged.field.map((c) => c.key)).toEqual(FIELD_PLAYER_CHARACTERISTICS.map((c) => c.key));
    expect(merged.goalkeeper.map((c) => c.key)).toEqual(GOALKEEPER_CHARACTERISTICS.map((c) => c.key));
    expect(merged.field.every((c) => !c.isHidden && !c.isCustom)).toBe(true);
  });

  it("cambia la etiqueta y los textos de nivel de una capacidad por defecto", () => {
    const merged = mergeCapacities(DEFAULT_SHEET_CATALOG, [
      capacityRow({ key: "technicalDribbling", label: "Regate en corto", levelTexts: texts }),
    ]);

    const dribbling = merged.field.find((c) => c.key === "technicalDribbling")!;
    expect(dribbling.label).toBe("Regate en corto");
    expect(dribbling.levels).toHaveLength(10);
    expect(dribbling.levels[0]).toEqual({ level: 1, concept: "Texto 1" });
    expect(dribbling.levels[9]).toEqual({ level: 10, concept: "Texto 10" });
  });

  it("conserva los textos por defecto cuando solo se cambia la etiqueta", () => {
    const merged = mergeCapacities(DEFAULT_SHEET_CATALOG, [capacityRow({ key: "technicalDribbling", label: "Regate en corto" })]);

    const original = FIELD_PLAYER_CHARACTERISTICS.find((c) => c.key === "technicalDribbling")!;
    expect(merged.field.find((c) => c.key === "technicalDribbling")!.levels).toEqual(original.levels);
  });

  it("marca como oculta una capacidad por defecto oculta", () => {
    const merged = mergeCapacities(DEFAULT_SHEET_CATALOG, [capacityRow({ key: "physicalSpeed", categoryKey: "physical", isHidden: true })]);

    expect(merged.field.find((c) => c.key === "physicalSpeed")!.isHidden).toBe(true);
    expect(visibleCapacities(merged.field)).toHaveLength(FIELD_PLAYER_CHARACTERISTICS.length - 1);
  });

  it("añade una capacidad propia de campo a la hoja de campo", () => {
    const merged = mergeCapacities(DEFAULT_SHEET_CATALOG, [
      capacityRow({ key: "custom-a", isCustom: true, label: "Juego aéreo ofensivo", levelTexts: texts }),
    ]);

    const custom = merged.field[merged.field.length - 1];
    expect(custom).toMatchObject({ key: "custom-a", label: "Juego aéreo ofensivo", categoryKey: "technical", isGoalkeeper: false, isCustom: true });
    expect(custom.levels).toHaveLength(10);
    expect(merged.goalkeeper).toHaveLength(GOALKEEPER_CHARACTERISTICS.length);
  });

  it("añade una capacidad propia de porteros a la hoja de porteros", () => {
    const merged = mergeCapacities(DEFAULT_SHEET_CATALOG, [
      capacityRow({ key: "custom-g", isCustom: true, sheet: "goalkeeper", categoryKey: "tactical", label: "Juego con los pies", levelTexts: texts }),
    ]);

    const custom = merged.goalkeeper[merged.goalkeeper.length - 1];
    expect(custom).toMatchObject({ key: "custom-g", isGoalkeeper: true, categoryKey: "tactical" });
    expect(merged.field).toHaveLength(FIELD_PLAYER_CHARACTERISTICS.length);
  });

  it("ordena las capacidades propias por etiqueta", () => {
    const merged = mergeCapacities(DEFAULT_SHEET_CATALOG, [
      capacityRow({ key: "custom-b", isCustom: true, label: "Zurda", levelTexts: texts }),
      capacityRow({ key: "custom-a", isCustom: true, label: "Juego aéreo", levelTexts: texts }),
    ]);

    expect(merged.field.slice(-2).map((c) => c.label)).toEqual(["Juego aéreo", "Zurda"]);
  });

  it("ignora una personalización de una clave por defecto desconocida", () => {
    const merged = mergeCapacities(DEFAULT_SHEET_CATALOG, [capacityRow({ key: "madeUp", label: "Fantasma" })]);

    expect(merged.field).toHaveLength(FIELD_PLAYER_CHARACTERISTICS.length);
  });
});
