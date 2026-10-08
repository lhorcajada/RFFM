import { describe, expect, it } from "vitest";
import {
  findSelectedItem,
  setSubSubPrincipioFoco,
  toggleSubSubPrincipio,
  toggleSubSubPrincipioHabilidad,
} from "../modelRelationSelection";
import type { ExerciseModelRelationRequest } from "../../../../../types/training";

const legacyRelation: ExerciseModelRelationRequest = {
  subprincipioId: "sub-legacy",
  isFoco: true,
  habilidadesImprescindibles: ["Pase"],
  items: [],
};

describe("modelRelationSelection", () => {
  it("al marcar un sub-subprincipio crea la relación de su subprincipio como FOCO y sin habilidades", () => {
    const result = toggleSubSubPrincipio([], "sub-1", "ssp-1");

    expect(result).toEqual([
      {
        subprincipioId: "sub-1",
        isFoco: true,
        habilidadesImprescindibles: [],
        items: [{ subSubPrincipioId: "ssp-1", isFoco: true, habilidades: [] }],
      },
    ]);
  });

  it("al marcar otro sub-subprincipio del mismo subprincipio lo añade a la misma relación", () => {
    const first = toggleSubSubPrincipio([], "sub-1", "ssp-1");

    const result = toggleSubSubPrincipio(first, "sub-1", "ssp-2");

    expect(result).toHaveLength(1);
    expect(result[0].items.map((i) => i.subSubPrincipioId)).toEqual(["ssp-1", "ssp-2"]);
  });

  it("al desmarcar el último sub-subprincipio elimina la relación del subprincipio", () => {
    const selected = toggleSubSubPrincipio([], "sub-1", "ssp-1");

    expect(toggleSubSubPrincipio(selected, "sub-1", "ssp-1")).toEqual([]);
  });

  it("conserva las relaciones antiguas sin sub-subprincipios al cambiar la selección", () => {
    const result = toggleSubSubPrincipio([legacyRelation], "sub-1", "ssp-1");

    expect(result[0]).toEqual(legacyRelation);
  });

  it("las habilidades de la relación son la unión de las habilidades de sus sub-subprincipios", () => {
    let relations = toggleSubSubPrincipio([], "sub-1", "ssp-1");
    relations = toggleSubSubPrincipio(relations, "sub-1", "ssp-2");
    relations = toggleSubSubPrincipioHabilidad(relations, "ssp-1", "Pase");
    relations = toggleSubSubPrincipioHabilidad(relations, "ssp-2", "Pase");
    relations = toggleSubSubPrincipioHabilidad(relations, "ssp-2", "Perfilamiento");

    expect(relations[0].habilidadesImprescindibles).toEqual(["Pase", "Perfilamiento"]);
    expect(findSelectedItem(relations, "ssp-2")?.habilidades).toEqual(["Pase", "Perfilamiento"]);
  });

  it("desmarcar una habilidad la quita del sub-subprincipio", () => {
    let relations = toggleSubSubPrincipio([], "sub-1", "ssp-1");
    relations = toggleSubSubPrincipioHabilidad(relations, "ssp-1", "Pase");

    relations = toggleSubSubPrincipioHabilidad(relations, "ssp-1", "Pase");

    expect(findSelectedItem(relations, "ssp-1")?.habilidades).toEqual([]);
    expect(relations[0].habilidadesImprescindibles).toEqual([]);
  });

  it("la relación es INTEGRADO solo cuando todos sus sub-subprincipios son INTEGRADO", () => {
    let relations = toggleSubSubPrincipio([], "sub-1", "ssp-1");
    relations = toggleSubSubPrincipio(relations, "sub-1", "ssp-2");

    relations = setSubSubPrincipioFoco(relations, "ssp-1", false);
    expect(relations[0].isFoco).toBe(true);

    relations = setSubSubPrincipioFoco(relations, "ssp-2", false);
    expect(relations[0].isFoco).toBe(false);
  });
});
