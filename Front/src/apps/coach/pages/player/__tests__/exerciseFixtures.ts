import type { Exercise } from "../../../types/training";

export function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Rondo 4x4+3",
    tipo: "Situacional",
    objetivo: "Circular con paciencia",
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
    ...overrides,
  };
}
