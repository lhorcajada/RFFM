import { describe, expect, it } from "vitest";
import { cleanSheetFields, exerciseToRequest } from "../exerciseRequest";
import { emptyExercise } from "../constants";
import type { Exercise } from "../../../../types/training";

const exercise: Exercise = {
  id: "ex-1",
  name: "Rondo",
  tipo: "Global",
  objetivo: "Objetivo",
  nivelesColumnas: ["Palanca 1"],
  niveles: [
    { nivel: 1, valores: {} },
    { nivel: 2, valores: {} },
  ],
  logistica: "",
  descripcion: "",
};

describe("exerciseToRequest — campos de la ficha", () => {
  it("copia los campos de la ficha del ejercicio", () => {
    const request = exerciseToRequest(
      {
        ...exercise,
        espacio: "20x30 m",
        turnoMinutos: 3,
        nivelDibujo: 2,
        descripcion: "Se juega 4v2",
        reglas: ["Regla"],
        puntos: ["Punto"],
        rotaciones: ["Rotación"],
        montaje: ["Montaje"],
      },
      "club-1",
    );

    expect(request.espacio).toBe("20x30 m");
    expect(request.turnoMinutos).toBe(3);
    expect(request.nivelDibujo).toBe(2);
    expect(request.descripcion).toBe("Se juega 4v2");
    expect(request.reglas).toEqual(["Regla"]);
    expect(request.puntos).toEqual(["Punto"]);
    expect(request.rotaciones).toEqual(["Rotación"]);
    expect(request.montaje).toEqual(["Montaje"]);
  });

  it("no envía los campos retirados de la ficha", () => {
    const request = exerciseToRequest(
      {
        ...exercise,
        ...({
          secuencia: ["Paso"],
          queSeVe: ["Ritmo"],
          porteros: "Portero suplente",
          jugadores: [{ color: "blue", nombre: "Azules", cantidad: 4, roles: null, objetivos: ["Posesión"] }],
        } as object),
      },
      "club-1",
    );

    expect(request).not.toHaveProperty("secuencia");
    expect(request).not.toHaveProperty("queSeVe");
    expect(request).not.toHaveProperty("porteros");
    expect(request).not.toHaveProperty("jugadores");
  });

  it("deja vacíos los campos de la ficha de un ejercicio que no los trae", () => {
    const request = exerciseToRequest(exercise, "club-1");

    expect(request.espacio).toBeNull();
    expect(request.turnoMinutos).toBeNull();
    expect(request.nivelDibujo).toBeNull();
    expect(request.reglas).toEqual([]);
    expect(request.puntos).toEqual([]);
    expect(request.rotaciones).toEqual([]);
    expect(request.montaje).toEqual([]);
  });

  it("no arrastra el nivel del dibujo cuando se recurre a los niveles vacíos por defecto", () => {
    const request = exerciseToRequest({ ...exercise, niveles: [], nivelDibujo: 3 }, "club-1");

    expect(request.nivelDibujo).toBeNull();
    expect(request.niveles).toEqual(emptyExercise.niveles);
  });

  it("copia las listas para no compartir el array con el ejercicio", () => {
    const puntos = ["Gol"];
    const request = exerciseToRequest({ ...exercise, puntos }, "club-1");

    expect(request.puntos).not.toBe(puntos);
  });
});

describe("cleanSheetFields", () => {
  it("quita las líneas en blanco de las listas", () => {
    const cleaned = cleanSheetFields({
      ...emptyExercise,
      reglas: ["", "b"],
      puntos: ["a", " ", ""],
      rotaciones: ["  "],
      montaje: ["c", ""],
    });

    expect(cleaned.reglas).toEqual(["b"]);
    expect(cleaned.puntos).toEqual(["a"]);
    expect(cleaned.rotaciones).toEqual([]);
    expect(cleaned.montaje).toEqual(["c"]);
  });

  it("deja el espacio en blanco como ausente y conserva uno con texto", () => {
    expect(cleanSheetFields({ ...emptyExercise, espacio: "   " }).espacio).toBeNull();
    expect(cleanSheetFields({ ...emptyExercise, espacio: "20x30" }).espacio).toBe("20x30");
  });
});
