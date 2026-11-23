import { describe, expect, it } from "vitest";
import { buildSessionPrintHtml, listSessionSheets } from "../sessionPrint";
import type { Exercise, SessionBlock, TrainingSessionDetail } from "../../../types/training";

function buildExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex1",
    name: "Rondo 4v2",
    tipo: "Analitico",
    objetivo: "Mantener la posesión bajo presión",
    modelRelations: [],
    nivelesColumnas: [],
    niveles: [],
    logistica: "",
    descripcion: "",
    isAssociatedToGameModel: false,
    ...overrides,
  };
}

function buildBlock(overrides: Partial<SessionBlock> = {}): SessionBlock {
  return {
    id: "b1",
    order: 1,
    nombre: "Activación",
    exercises: [{ id: "be1", exerciseId: "ex1", position: 1, exerciseName: "Rondo 4v2" }],
    ...overrides,
  };
}

function buildSession(overrides: Partial<TrainingSessionDetail> = {}): TrainingSessionDetail {
  return {
    id: "sess-1",
    name: "Sesión de presión alta",
    description: "",
    date: "2026-09-10",
    startTime: "18:00:00",
    endTime: "19:30:00",
    location: "Campo 2",
    isAssociatedToPlan: false,
    blocks: [buildBlock()],
    targets: [],
    ...overrides,
  };
}

const sheetsIn = (html: string) => html.match(/<section class="ficha">/g)?.length ?? 0;

describe("buildSessionPrintHtml", () => {
  it("imprime en hojas A4 apaisadas", () => {
    const html = buildSessionPrintHtml(buildSession(), new Map([["ex1", buildExercise()]]));
    expect(html).toContain("@page { size: A4 landscape");
  });

  it("genera una hoja por ejercicio, sin portada ni resumen", () => {
    const session = buildSession({
      objetivoGeneral: "Objetivo general de la sesión",
      mapaCampoTexto: "Mapa de campo",
      blocks: [
        buildBlock({
          exercises: [
            { id: "be1", exerciseId: "ex1", position: 1 },
            { id: "be2", exerciseId: "ex2", position: 2 },
          ],
        }),
        buildBlock({ id: "b2", order: 2, nombre: "Principal", exercises: [{ id: "be3", exerciseId: "ex3", position: 1 }] }),
      ],
    });
    const exercisesById = new Map([
      ["ex1", buildExercise({ id: "ex1", name: "Uno" })],
      ["ex2", buildExercise({ id: "ex2", name: "Dos" })],
      ["ex3", buildExercise({ id: "ex3", name: "Tres" })],
    ]);

    const html = buildSessionPrintHtml(session, exercisesById);

    expect(sheetsIn(html)).toBe(3);
    expect(html).not.toContain("Objetivo general de la sesión");
    expect(html).not.toContain("Mapa de campo");
  });

  it("da su propia hoja a un ejercicio repetido en la sesión", () => {
    const session = buildSession({
      blocks: [
        buildBlock({
          exercises: [
            { id: "be1", exerciseId: "ex1", position: 1 },
            { id: "be2", exerciseId: "ex1", position: 2 },
          ],
        }),
      ],
    });

    const html = buildSessionPrintHtml(session, new Map([["ex1", buildExercise()]]));

    expect(sheetsIn(html)).toBe(2);
  });

  it("ordena las hojas por bloque y por posición dentro del bloque", () => {
    const session = buildSession({
      blocks: [
        buildBlock({ id: "b2", order: 2, nombre: "Principal", exercises: [{ id: "be3", exerciseId: "ex3", position: 1 }] }),
        buildBlock({
          exercises: [
            { id: "be2", exerciseId: "ex2", position: 2 },
            { id: "be1", exerciseId: "ex1", position: 1 },
          ],
        }),
      ],
    });
    const exercisesById = new Map([
      ["ex1", buildExercise({ id: "ex1", name: "Uno" })],
      ["ex2", buildExercise({ id: "ex2", name: "Dos" })],
      ["ex3", buildExercise({ id: "ex3", name: "Tres" })],
    ]);

    const names = listSessionSheets(session, exercisesById).map((sheet) => sheet.exercise.name);

    expect(names).toEqual(["Uno", "Dos", "Tres"]);
  });

  it("muestra en el pie de cada hoja el nombre de la sesión y su bloque", () => {
    const session = buildSession({
      blocks: [
        buildBlock({ nombre: "Activación" }),
        buildBlock({ id: "b2", order: 2, nombre: "Principal", exercises: [{ id: "be2", exerciseId: "ex2", position: 1 }] }),
      ],
    });
    const exercisesById = new Map([
      ["ex1", buildExercise({ id: "ex1" })],
      ["ex2", buildExercise({ id: "ex2", name: "Dos" })],
    ]);

    const html = buildSessionPrintHtml(session, exercisesById);

    expect(html).toContain("Sesión: Sesión de presión alta · Bloque: Activación");
    expect(html).toContain("Sesión: Sesión de presión alta · Bloque: Principal");
  });

  it("incluye el contenido estructurado de cada ejercicio", () => {
    const html = buildSessionPrintHtml(
      buildSession(),
      new Map([
        [
          "ex1",
          buildExercise({
            espacio: "20x30 m",
            secuencia: ["Pase y desmarque"],
            reglas: ["Dos toques"],
            queSeVe: ["Ritmo alto"],
            jugadores: [{ color: "blue", nombre: "Azules", cantidad: 4, roles: null, objetivos: ["Mantener la posesión"] }],
          }),
        ],
      ]),
    );

    expect(html).toContain("Espacio: 20x30 m");
    expect(html).toContain("Pase y desmarque");
    expect(html).toContain("Dos toques");
    expect(html).toContain("Ritmo alto");
    expect(html).toContain("Azules");
    expect(html).toContain("Mantener la posesión");
  });

  it("recorta el dibujo de la pizarra al medio campo cuando solo se usa una mitad", () => {
    const boardStateJson = JSON.stringify({ placedChapas: { p1: { x: 30, y: 30 }, p2: { x: 70, y: 60 } } });

    const html = buildSessionPrintHtml(buildSession(), new Map([["ex1", buildExercise({ boardStateJson })]]));

    expect(html).toContain("ficha-drawing--half");
    expect(html).toContain('data-viewport="right"');
  });

  it("imprime el campo completo cuando el dibujo usa las dos mitades", () => {
    const boardStateJson = JSON.stringify({ placedChapas: { p1: { x: -30, y: 30 }, p2: { x: 30, y: 60 } } });

    const html = buildSessionPrintHtml(buildSession(), new Map([["ex1", buildExercise({ boardStateJson })]]));

    expect(html).toContain("ficha-drawing--full");
    expect(html).not.toContain("data-viewport=");
  });

  it("incluye la imagen del ejercicio cuando tiene urlImage", () => {
    const html = buildSessionPrintHtml(
      buildSession(),
      new Map([["ex1", buildExercise({ urlImage: "exercises/rondo.png" })]]),
    );

    expect(html).toContain("<img");
    expect(html).toContain("rondo.png");
  });

  it("resuelve dorsal y alias del jugador en el dibujo cuando se provee el roster", () => {
    const boardStateJson = JSON.stringify({ placedChapas: { "player-1": { x: 10, y: 10 } } });
    const playersById = new Map([["player-1", { id: "player-1", name: "Ana", alias: "Ani", dorsal: 9 } as never]]);

    const html = buildSessionPrintHtml(buildSession(), new Map([["ex1", buildExercise({ boardStateJson })]]), playersById);

    expect(html).toContain("Ani");
    expect(html).toContain(">9<");
  });

  it("recurre al nombre del ejercicio cuando no se provee su detalle completo", () => {
    const session = buildSession({
      blocks: [
        buildBlock({
          exercises: [{ id: "be1", exerciseId: "ex1", position: 1, exerciseName: "Rondo 4v2", exerciseDurationMinutes: 15 }],
        }),
      ],
    });

    const html = buildSessionPrintHtml(session);

    expect(sheetsIn(html)).toBe(1);
    expect(html).toContain("Rondo 4v2");
    expect(html).toContain("15 min");
    expect(html).toContain("Sin dibujo");
  });

  it("avisa cuando la sesión no tiene ejercicios", () => {
    const html = buildSessionPrintHtml(buildSession({ blocks: [] }));

    expect(sheetsIn(html)).toBe(0);
    expect(html).toContain("Esta sesión no tiene ejercicios.");
  });

  it("escapa HTML en los campos de texto libre", () => {
    const html = buildSessionPrintHtml(
      buildSession({ name: "<script>alert(1)</script>" }),
      new Map([["ex1", buildExercise()]]),
    );

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
