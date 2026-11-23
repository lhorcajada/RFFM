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
        secuencia: ["Paso"],
        reglas: ["Regla"],
        queSeVe: ["Ritmo"],
        jugadores: [{ color: "blue", nombre: "Azules", cantidad: 4, roles: null, objetivos: ["Posesión"] }],
      },
      "club-1",
    );

    expect(request.espacio).toBe("20x30 m");
    expect(request.turnoMinutos).toBe(3);
    expect(request.nivelDibujo).toBe(2);
    expect(request.secuencia).toEqual(["Paso"]);
    expect(request.reglas).toEqual(["Regla"]);
    expect(request.queSeVe).toEqual(["Ritmo"]);
    expect(request.jugadores).toEqual([{ color: "blue", nombre: "Azules", cantidad: 4, roles: null, objetivos: ["Posesión"] }]);
  });

  it("deja vacíos los campos de la ficha de un ejercicio que no los trae", () => {
    const request = exerciseToRequest(exercise, "club-1");

    expect(request.espacio).toBeNull();
    expect(request.turnoMinutos).toBeNull();
    expect(request.nivelDibujo).toBeNull();
    expect(request.secuencia).toEqual([]);
    expect(request.jugadores).toEqual([]);
  });

  it("no arrastra el nivel del dibujo cuando se recurre a los niveles vacíos por defecto", () => {
    const request = exerciseToRequest({ ...exercise, niveles: [], nivelDibujo: 3 }, "club-1");

    expect(request.nivelDibujo).toBeNull();
    expect(request.niveles).toEqual(emptyExercise.niveles);
  });

  it("copia los objetivos de los equipos para no compartir el array con el ejercicio", () => {
    const objetivos = ["Posesión"];
    const request = exerciseToRequest(
      { ...exercise, jugadores: [{ color: null, nombre: "A", cantidad: null, roles: null, objetivos }] },
      "club-1",
    );

    expect(request.jugadores[0].objetivos).not.toBe(objetivos);
  });
});

describe("cleanSheetFields", () => {
  it("quita las líneas en blanco de las listas", () => {
    const cleaned = cleanSheetFields({ ...emptyExercise, secuencia: ["a", " ", ""], reglas: ["", "b"], queSeVe: ["  "] });

    expect(cleaned.secuencia).toEqual(["a"]);
    expect(cleaned.reglas).toEqual(["b"]);
    expect(cleaned.queSeVe).toEqual([]);
  });

  it("deja el espacio en blanco como ausente y conserva uno con texto", () => {
    expect(cleanSheetFields({ ...emptyExercise, espacio: "   " }).espacio).toBeNull();
    expect(cleanSheetFields({ ...emptyExercise, espacio: "20x30" }).espacio).toBe("20x30");
  });

  it("descarta los equipos completamente vacíos y limpia los demás", () => {
    const cleaned = cleanSheetFields({
      ...emptyExercise,
      jugadores: [
        { color: null, nombre: "  ", cantidad: null, roles: " ", objetivos: [""] },
        { color: "gray", nombre: " Grises ", cantidad: 2, roles: " ", objetivos: ["Robar", " "] },
      ],
    });

    expect(cleaned.jugadores).toEqual([{ color: "gray", nombre: "Grises", cantidad: 2, roles: null, objetivos: ["Robar"] }]);
  });

  it("conserva un equipo que solo tiene color", () => {
    const cleaned = cleanSheetFields({
      ...emptyExercise,
      jugadores: [{ color: "yellow", nombre: "", cantidad: null, roles: null, objetivos: [] }],
    });

    expect(cleaned.jugadores).toHaveLength(1);
  });
});
