import type { Exercise, ExerciseModelRelation } from "../../../types/training";

export function relation(overrides: Partial<ExerciseModelRelation> = {}): ExerciseModelRelation {
  return {
    id: "rel-1",
    subprincipioId: "s-23",
    subprincipioNumero: "2.3",
    subprincipioTitulo: "Circular para desordenar",
    isFoco: true,
    habilidadesImprescindibles: ["Pase", "Percepción"],
    items: [{ id: "it-1", subSubPrincipioId: "ssp-231", subSubPrincipioNumero: "2.3.1", subSubPrincipioRol: "Extremo", isFoco: true }],
    ...overrides,
  };
}

export function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Rondo 4x4+3",
    tipo: "Situacional",
    objetivo: "Circular con paciencia",
    modelRelations: [relation()],
    nivelesColumnas: ["Espacio", "Toques"],
    niveles: [
      { nivel: 2, valores: { Espacio: "20x20", Toques: "2" } },
      { nivel: 1, valores: { Espacio: "30x30", Toques: "Libre" } },
    ],
    logistica: "Conos y petos",
    durationMinutes: 15,
    descripcion: "Mantener la posesión hasta encontrar el hombre libre.",
    urlImage: null,
    boardStateJson: null,
    isAssociatedToGameModel: true,
    ...overrides,
  };
}
