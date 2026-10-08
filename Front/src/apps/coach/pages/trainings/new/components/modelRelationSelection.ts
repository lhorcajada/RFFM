import type { ExerciseModelRelationItemRequest, ExerciseModelRelationRequest } from "../../../../types/training";

// The exercise's model relations are edited as a set of selected Sub-subprincipios; each
// Subprincipio relation is derived from its items: FOCO when any item is FOCO, and its
// habilidadesImprescindibles are the union of its items' habilidades. Relations without items
// (saved before per-item habilidades existed) are kept untouched.

function deriveRelation(
  relation: ExerciseModelRelationRequest,
  items: ExerciseModelRelationItemRequest[]
): ExerciseModelRelationRequest {
  return {
    ...relation,
    isFoco: items.some((i) => i.isFoco),
    habilidadesImprescindibles: Array.from(new Set(items.flatMap((i) => i.habilidades))),
    items,
  };
}

function updateItem(
  relations: ExerciseModelRelationRequest[],
  subSubPrincipioId: string,
  change: (item: ExerciseModelRelationItemRequest) => ExerciseModelRelationItemRequest
): ExerciseModelRelationRequest[] {
  return relations.map((relation) =>
    relation.items.some((i) => i.subSubPrincipioId === subSubPrincipioId)
      ? deriveRelation(
          relation,
          relation.items.map((i) => (i.subSubPrincipioId === subSubPrincipioId ? change(i) : i))
        )
      : relation
  );
}

export function findSelectedItem(
  relations: ExerciseModelRelationRequest[],
  subSubPrincipioId: string
): ExerciseModelRelationItemRequest | undefined {
  for (const relation of relations) {
    const item = relation.items.find((i) => i.subSubPrincipioId === subSubPrincipioId);
    if (item) return item;
  }
  return undefined;
}

export function toggleSubSubPrincipio(
  relations: ExerciseModelRelationRequest[],
  subprincipioId: string,
  subSubPrincipioId: string
): ExerciseModelRelationRequest[] {
  const isSelected = findSelectedItem(relations, subSubPrincipioId) !== undefined;

  if (isSelected) {
    return relations.flatMap((relation) => {
      const items = relation.items.filter((i) => i.subSubPrincipioId !== subSubPrincipioId);
      if (items.length === relation.items.length) return [relation];
      return items.length === 0 ? [] : [deriveRelation(relation, items)];
    });
  }

  const newItem: ExerciseModelRelationItemRequest = { subSubPrincipioId, isFoco: true, habilidades: [] };
  const relationIndex = relations.findIndex((r) => r.subprincipioId === subprincipioId && r.items.length > 0);
  if (relationIndex === -1) {
    return [...relations, deriveRelation({ subprincipioId, isFoco: true, habilidadesImprescindibles: [], items: [] }, [newItem])];
  }
  return relations.map((relation, index) =>
    index === relationIndex ? deriveRelation(relation, [...relation.items, newItem]) : relation
  );
}

export function setSubSubPrincipioFoco(
  relations: ExerciseModelRelationRequest[],
  subSubPrincipioId: string,
  isFoco: boolean
): ExerciseModelRelationRequest[] {
  return updateItem(relations, subSubPrincipioId, (item) => ({ ...item, isFoco }));
}

export function toggleSubSubPrincipioHabilidad(
  relations: ExerciseModelRelationRequest[],
  subSubPrincipioId: string,
  habilidad: string
): ExerciseModelRelationRequest[] {
  return updateItem(relations, subSubPrincipioId, (item) => ({
    ...item,
    habilidades: item.habilidades.includes(habilidad)
      ? item.habilidades.filter((h) => h !== habilidad)
      : [...item.habilidades, habilidad],
  }));
}
